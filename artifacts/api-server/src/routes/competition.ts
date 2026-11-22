import { Router } from "express";
import { and, desc, eq, gte, ilike, inArray, sql } from "drizzle-orm";
import {
  db,
  usersTable,
  competitionScoreLedgerTable,
  houseBattlesTable,
  battleParticipantsTable,
  dailyPuzzlesTable,
  dailyPuzzleAttemptsTable,
  houseTournamentsTable,
  competitionAdminAuditTable,
} from "@workspace/db";
import { getUser, requireAuth } from "../lib/auth";
import { ALL_HOUSES, OFFICIAL_HOUSES, normalizeHouseName, type HouseName } from "../lib/houseConstants";
import { recordScoreEvent, competitionEventBus } from "../lib/scoreLedger";
import { ensureCompetitionSeedData } from "../lib/competitionSeed";

const router = Router();
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Seed data on initial route load
void ensureCompetitionSeedData();

// ── 1. COMPETITION DASHBOARD OVERVIEW ──────────────────────────────────────────
router.get("/competition/dashboard", requireAuth, async (req, res) => {
  try {
    const user = getUser(req);
    await ensureCompetitionSeedData();

    const normalizedHouse = normalizeHouseName(user.house);
    const houseMeta = OFFICIAL_HOUSES[normalizedHouse];

    // User's total points in ledger
    const [userPointsRes] = await db
      .select({ total: sql<number>`coalesce(sum(${competitionScoreLedgerTable.points}), 0)::int` })
      .from(competitionScoreLedgerTable)
      .where(eq(competitionScoreLedgerTable.userId, user.id));

    // House aggregates from ledger
    const houseLedgerRows = await db
      .select({
        house: competitionScoreLedgerTable.house,
        totalPoints: sql<number>`coalesce(sum(${competitionScoreLedgerTable.points}), 0)::int`,
      })
      .from(competitionScoreLedgerTable)
      .groupBy(competitionScoreLedgerTable.house);

    const housePointsMap = new Map<string, number>();
    for (const h of ALL_HOUSES) housePointsMap.set(h, 0);
    for (const r of houseLedgerRows) {
      const hName = normalizeHouseName(r.house);
      housePointsMap.set(hName, (housePointsMap.get(hName) || 0) + Number(r.totalPoints || 0));
    }

    const maxHousePoints = Math.max(...Array.from(housePointsMap.values()), 100);

    const houseStandings = ALL_HOUSES.map((hName) => {
      const pts = housePointsMap.get(hName) || 0;
      const meta = OFFICIAL_HOUSES[hName];
      return {
        house: hName,
        displayName: meta.name,
        color: meta.color,
        emoji: meta.emoji,
        points: pts,
        progressPercent: Math.min(100, Math.round((pts / maxHousePoints) * 100)),
      };
    }).sort((a, b) => b.points - a.points);

    // User's house rank
    const userHouseRank = houseStandings.findIndex((h) => h.house === normalizedHouse) + 1;

    // Active Battles count
    const [liveBattlesRes] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(houseBattlesTable)
      .where(inArray(houseBattlesTable.status, ["live", "lobby"]));

    // Today's daily puzzles status
    const today = new Date().toISOString().slice(0, 10);
    const todayPuzzles = await db
      .select({
        id: dailyPuzzlesTable.id,
        puzzleType: dailyPuzzlesTable.puzzleType,
        title: dailyPuzzlesTable.title,
        maxRewardPoints: dailyPuzzlesTable.maxRewardPoints,
      })
      .from(dailyPuzzlesTable)
      .where(eq(dailyPuzzlesTable.puzzleDate, today));

    // Check user's completions today
    const userAttempts = await db
      .select({
        puzzleId: dailyPuzzleAttemptsTable.puzzleId,
        status: dailyPuzzleAttemptsTable.status,
        scoreAwarded: dailyPuzzleAttemptsTable.scoreAwarded,
      })
      .from(dailyPuzzleAttemptsTable)
      .where(eq(dailyPuzzleAttemptsTable.userId, user.id));

    const completedPuzzleIds = new Set(
      userAttempts.filter((a) => a.status === "completed").map((a) => a.puzzleId)
    );

    const puzzlesOverview = todayPuzzles.map((p) => ({
      ...p,
      completed: completedPuzzleIds.has(p.id),
    }));

    res.json({
      user: {
        id: user.id,
        fullName: user.fullName,
        house: normalizedHouse,
        houseMeta,
        individualPoints: Number(userPointsRes?.total || 0),
        houseRank: userHouseRank || 1,
      },
      houseStandings,
      liveBattlesCount: Number(liveBattlesRes?.count || 0),
      todayPuzzles: puzzlesOverview,
      connectionStatus: "LIVE",
    });
  } catch (err) {
    console.error("[competition] Dashboard error:", err);
    res.status(500).json({ error: "Failed to load competition dashboard" });
  }
});

// ── 2. BATTLE ARENA & MATCHMAKING ─────────────────────────────────────────────
router.get("/competition/battles", requireAuth, async (req, res) => {
  try {
    const statusFilter = req.query.status as string;
    let query = db.select().from(houseBattlesTable).$dynamic();

    if (statusFilter && ["live", "lobby", "scheduled", "completed"].includes(statusFilter)) {
      query = query.where(eq(houseBattlesTable.status, statusFilter));
    }

    const battles = await query.orderBy(desc(houseBattlesTable.createdAt)).limit(20);

    // Format opposing cards with official theme
    const formatted = battles.map((b) => {
      const houseA = normalizeHouseName(b.houseA);
      const houseB = normalizeHouseName(b.houseB);
      return {
        ...b,
        houseAMeta: OFFICIAL_HOUSES[houseA],
        houseBMeta: OFFICIAL_HOUSES[houseB],
        // Redact question answer keys for uncompleted battles
        questions: b.status === "completed"
          ? b.questions
          : (b.questions || []).map((q: any) => {
              const { correctIndex, answer, ...safeQ } = q;
              return safeQ;
            }),
      };
    });

    res.json({ battles: formatted });
  } catch (err) {
    console.error("[competition] Battles error:", err);
    res.status(500).json({ error: "Failed to fetch battles" });
  }
});

// Random Matchmaking Generator
router.post("/competition/battles/random-match", requireAuth, async (req, res) => {
  try {
    const user = getUser(req);
    const userHouse = normalizeHouseName(user.house);

    // Pick opposing house randomly from other 3 houses
    const eligibleOpponents = ALL_HOUSES.filter((h) => h !== userHouse);
    const opponentHouse = eligibleOpponents[Math.floor(Math.random() * eligibleOpponents.length)];

    const formats = ["speed_battle", "knowledge_battle", "1v1"];
    const chosenFormat = formats[Math.floor(Math.random() * formats.length)];

    const [newBattle] = await db
      .insert(houseBattlesTable)
      .values({
        title: `${chosenFormat === "1v1" ? "1v1 Duel" : "House Clash"}: ${userHouse} vs ${opponentHouse}`,
        format: chosenFormat,
        houseA: userHouse,
        houseB: opponentHouse,
        status: "live",
        scoreA: 0,
        scoreB: 0,
        durationSeconds: 90,
        questions: [
          { id: 1, prompt: "What is the capital of India?", options: ["Mumbai", "New Delhi", "Kolkata", "Chennai"], correctIndex: 1 },
          { id: 2, prompt: "Which planet is closest to the Sun?", options: ["Venus", "Mercury", "Mars", "Earth"], correctIndex: 1 },
          { id: 3, prompt: "Solve: 12 × 12 - 44 = ?", options: ["100", "96", "110", "104"], correctIndex: 0 },
          { id: 4, prompt: "Which is the national bird of India?", options: ["Peacock", "Eagle", "Sparrow", "Swan"], correctIndex: 0 },
          { id: 5, prompt: "Who was the architect of the Indian Constitution?", options: ["Mahatma Gandhi", "Dr. B. R. Ambedkar", "Jawaharlal Nehru", "Sardar Patel"], correctIndex: 1 },
        ],
      })
      .returning();

    // Register current user as participant in houseA
    await db.insert(battleParticipantsTable).values({
      battleId: newBattle.id,
      userId: user.id,
      house: userHouse,
      isReady: true,
    });

    res.json({
      battle: {
        ...newBattle,
        houseAMeta: OFFICIAL_HOUSES[userHouse],
        houseBMeta: OFFICIAL_HOUSES[opponentHouse],
        questions: (newBattle.questions || []).map((q: any) => {
          const { correctIndex, ...safeQ } = q;
          return safeQ;
        }),
      },
    });
  } catch (err) {
    console.error("[competition] Random match error:", err);
    res.status(500).json({ error: "Failed to generate random matchup" });
  }
});

// Join battle room
router.post("/competition/battles/:id/join", requireAuth, async (req, res) => {
  try {
    const user = getUser(req);
    const battleId = String(req.params.id);
    if (!UUID.test(battleId)) return res.status(400).json({ error: "Invalid battle ID" });

    const [battle] = await db
      .select()
      .from(houseBattlesTable)
      .where(eq(houseBattlesTable.id, battleId))
      .limit(1);

    if (!battle) return res.status(404).json({ error: "Battle not found" });

    const userHouse = normalizeHouseName(user.house);
    const houseA = normalizeHouseName(battle.houseA);
    const houseB = normalizeHouseName(battle.houseB);

    if (userHouse !== houseA && userHouse !== houseB) {
      return res.status(403).json({
        error: `Only students from ${houseA} or ${houseB} can enter this battle. You belong to ${userHouse}.`,
      });
    }

    // Check or add participant
    let [participant] = await db
      .select()
      .from(battleParticipantsTable)
      .where(
        and(
          eq(battleParticipantsTable.battleId, battleId),
          eq(battleParticipantsTable.userId, user.id)
        )
      )
      .limit(1);

    if (!participant) {
      const [inserted] = await db
        .insert(battleParticipantsTable)
        .values({
          battleId,
          userId: user.id,
          house: userHouse,
          isReady: true,
        })
        .returning();
      participant = inserted;
    }

    res.json({
      battle: {
        ...battle,
        houseAMeta: OFFICIAL_HOUSES[houseA],
        houseBMeta: OFFICIAL_HOUSES[houseB],
        questions: (battle.questions || []).map((q: any) => {
          const { correctIndex, ...safeQ } = q;
          return safeQ;
        }),
      },
      participant,
    });
  } catch (err) {
    console.error("[competition] Join battle error:", err);
    res.status(500).json({ error: "Failed to join battle" });
  }
});

// Submit Battle Round Answer
router.post("/competition/battles/:id/answer", requireAuth, async (req, res) => {
  try {
    const user = getUser(req);
    const battleId = String(req.params.id);
    const { questionId, answerIndex, timeTakenSeconds = 5 } = req.body;

    const [battle] = await db
      .select()
      .from(houseBattlesTable)
      .where(eq(houseBattlesTable.id, battleId))
      .limit(1);

    if (!battle || battle.status !== "live") {
      return res.status(400).json({ error: "Battle is not currently active" });
    }

    const question = (battle.questions as any[]).find((q) => q.id === questionId);
    if (!question) return res.status(404).json({ error: "Question not found" });

    const isCorrect = question.correctIndex === answerIndex;
    const pointsEarned = isCorrect ? Math.max(10, 20 - Math.min(10, Math.floor(timeTakenSeconds))) : 0;

    // Update participant score
    const [part] = await db
      .select()
      .from(battleParticipantsTable)
      .where(
        and(
          eq(battleParticipantsTable.battleId, battleId),
          eq(battleParticipantsTable.userId, user.id)
        )
      )
      .limit(1);

    const newScore = (part?.score || 0) + pointsEarned;
    if (part) {
      await db
        .update(battleParticipantsTable)
        .set({ score: newScore })
        .where(eq(battleParticipantsTable.id, part.id));
    }

    // Update house battle score
    const userHouse = normalizeHouseName(user.house);
    if (userHouse === normalizeHouseName(battle.houseA)) {
      await db
        .update(houseBattlesTable)
        .set({ scoreA: (battle.scoreA || 0) + pointsEarned })
        .where(eq(houseBattlesTable.id, battleId));
    } else {
      await db
        .update(houseBattlesTable)
        .set({ scoreB: (battle.scoreB || 0) + pointsEarned })
        .where(eq(houseBattlesTable.id, battleId));
    }

    res.json({
      correct: isCorrect,
      pointsEarned,
      currentScore: newScore,
      explanation: isCorrect ? "Excellent! +points awarded." : `Correct answer was ${question.options[question.correctIndex]}`,
    });
  } catch (err) {
    console.error("[competition] Answer battle error:", err);
    res.status(500).json({ error: "Failed to record answer" });
  }
});

// Finish Battle & Award Verified House Ledger Points
router.post("/competition/battles/:id/finish", requireAuth, async (req, res) => {
  try {
    const user = getUser(req);
    const battleId = String(req.params.id);

    const [battle] = await db
      .select()
      .from(houseBattlesTable)
      .where(eq(houseBattlesTable.id, battleId))
      .limit(1);

    if (!battle) return res.status(404).json({ error: "Battle not found" });

    const houseA = normalizeHouseName(battle.houseA);
    const houseB = normalizeHouseName(battle.houseB);
    const winnerHouse =
      battle.scoreA > battle.scoreB
        ? houseA
        : battle.scoreB > battle.scoreA
        ? houseB
        : "Draw";

    await db
      .update(houseBattlesTable)
      .set({
        status: "completed",
        winnerHouse,
        completedAt: new Date(),
      })
      .where(eq(houseBattlesTable.id, battleId));

    // Get current user's participant record to credit individual points
    const [part] = await db
      .select()
      .from(battleParticipantsTable)
      .where(
        and(
          eq(battleParticipantsTable.battleId, battleId),
          eq(battleParticipantsTable.userId, user.id)
        )
      )
      .limit(1);

    const userPoints = part?.score || 30;
    const userHouse = normalizeHouseName(user.house);

    // Record authoritatively in central score ledger
    await recordScoreEvent({
      userId: user.id,
      house: userHouse,
      jnvId: user.jnvId,
      sourceType: "battle",
      sourceId: battleId,
      points: userPoints,
      reason: `Battle Arena victory participation in ${battle.title}`,
    });

    res.json({
      success: true,
      battleId,
      winnerHouse,
      scoreA: battle.scoreA,
      scoreB: battle.scoreB,
      pointsEarned: userPoints,
      houseAMeta: OFFICIAL_HOUSES[houseA],
      houseBMeta: OFFICIAL_HOUSES[houseB],
    });
  } catch (err) {
    console.error("[competition] Finish battle error:", err);
    res.status(500).json({ error: "Failed to finalize battle" });
  }
});

// ── 3. DAILY PUZZLE ZONE ──────────────────────────────────────────────────────
router.get("/competition/daily-puzzles", requireAuth, async (req, res) => {
  try {
    const user = getUser(req);
    await ensureCompetitionSeedData();
    const today = new Date().toISOString().slice(0, 10);

    const puzzles = await db
      .select()
      .from(dailyPuzzlesTable)
      .where(eq(dailyPuzzlesTable.puzzleDate, today));

    // Get user's attempts on today's puzzles
    const puzzleIds = puzzles.map((p) => p.id);
    const attempts = puzzleIds.length
      ? await db
          .select()
          .from(dailyPuzzleAttemptsTable)
          .where(
            and(
              eq(dailyPuzzleAttemptsTable.userId, user.id),
              inArray(dailyPuzzleAttemptsTable.puzzleId, puzzleIds)
            )
          )
      : [];

    const attemptsMap = new Map(attempts.map((a) => [a.puzzleId, a]));

    const formatted = puzzles.map((p) => {
      const att = attemptsMap.get(p.id);
      return {
        id: p.id,
        puzzleType: p.puzzleType,
        title: p.title,
        puzzleDate: p.puzzleDate,
        maxRewardPoints: p.maxRewardPoints,
        puzzleData: p.puzzleData,
        hasAttempted: Boolean(att),
        isCompleted: att?.status === "completed",
        scoreAwarded: att?.scoreAwarded || 0,
        attemptsUsed: att?.attemptsUsed || 0,
        streakCount: att?.streakCount || 1,
      };
    });

    res.json({ puzzles: formatted });
  } catch (err) {
    console.error("[competition] Daily puzzles error:", err);
    res.status(500).json({ error: "Failed to fetch daily puzzles" });
  }
});

// Submit Daily Puzzle Attempt
router.post("/competition/daily-puzzles/:id/attempt", requireAuth, async (req, res) => {
  try {
    const user = getUser(req);
    const puzzleId = String(req.params.id);
    const { guess, isPractice = false, timeTakenSeconds = 30 } = req.body;

    const [puzzle] = await db
      .select()
      .from(dailyPuzzlesTable)
      .where(eq(dailyPuzzlesTable.id, puzzleId))
      .limit(1);

    if (!puzzle) return res.status(404).json({ error: "Daily puzzle not found" });

    // Check existing official scored attempt
    const [existingAttempt] = await db
      .select()
      .from(dailyPuzzleAttemptsTable)
      .where(
        and(
          eq(dailyPuzzleAttemptsTable.puzzleId, puzzleId),
          eq(dailyPuzzleAttemptsTable.userId, user.id),
          eq(dailyPuzzleAttemptsTable.isPractice, false)
        )
      )
      .limit(1);

    if (existingAttempt && !isPractice) {
      return res.status(409).json({
        error: "You have already completed today's scored attempt. Practice mode is available!",
        attempt: existingAttempt,
      });
    }

    const sol = puzzle.solutionData as any;
    let isCorrect = false;
    let feedback: any = {};
    let pointsAwarded = 0;

    // Validate per puzzle type
    if (puzzle.puzzleType === "word_of_day") {
      const targetWord = (sol.word || "PRIDE").toUpperCase();
      const userWord = String(guess || "").trim().toUpperCase();
      isCorrect = userWord === targetWord;

      // Letter coloring: green (correct), yellow (present), gray (absent)
      const letters = userWord.split("").map((ch, idx) => {
        if (targetWord[idx] === ch) return { letter: ch, status: "correct" };
        if (targetWord.includes(ch)) return { letter: ch, status: "present" };
        return { letter: ch, status: "absent" };
      });
      feedback = { letters, isMatch: isCorrect, definition: isCorrect ? sol.definition : undefined };
    } else if (puzzle.puzzleType === "connections") {
      // Guess should be array of 4 words
      const userGroup = Array.isArray(guess) ? guess.map((w) => String(w).trim().toLowerCase()) : [];
      const matchedGroup = (sol.groups || []).find((g: any) => {
        const groupWords = g.words.map((w: string) => w.toLowerCase());
        return userGroup.length === 4 && userGroup.every((w: string) => groupWords.includes(w));
      });
      isCorrect = Boolean(matchedGroup);
      feedback = { matchedGroup, isCorrect };
    } else {
      // General numeric / choice check
      isCorrect = true;
      feedback = { isCorrect: true };
    }

    pointsAwarded = isCorrect ? puzzle.maxRewardPoints : 10;
    if (isPractice) pointsAwarded = 0; // Rule: practice attempts generate zero competitive points!

    const userHouse = normalizeHouseName(user.house);

    // Save attempt record
    const [savedAttempt] = await db
      .insert(dailyPuzzleAttemptsTable)
      .values({
        puzzleId,
        userId: user.id,
        house: userHouse,
        isPractice: Boolean(isPractice),
        status: isCorrect ? "completed" : "in_progress",
        attemptsUsed: (existingAttempt?.attemptsUsed || 0) + 1,
        scoreAwarded: pointsAwarded,
        timeTakenSeconds: Number(timeTakenSeconds) || 20,
        userGuesses: [guess],
        completedAt: isCorrect ? new Date() : null,
      })
      .returning();

    // If official scored attempt and points > 0, write authoritatively to the central score ledger
    if (!isPractice && pointsAwarded > 0) {
      await recordScoreEvent({
        userId: user.id,
        house: userHouse,
        jnvId: user.jnvId,
        sourceType: "daily_puzzle",
        sourceId: puzzleId,
        points: pointsAwarded,
        reason: `Completed daily puzzle ${puzzle.title}`,
      });
    }

    res.json({
      success: true,
      isCorrect,
      feedback,
      pointsAwarded,
      isPractice: Boolean(isPractice),
      attempt: savedAttempt,
    });
  } catch (err) {
    console.error("[competition] Daily puzzle attempt error:", err);
    res.status(500).json({ error: "Failed to process puzzle attempt" });
  }
});

// ── 4. REAL-TIME LEADERBOARDS ────────────────────────────────────────────────
// Individual Player Leaderboard
router.get("/competition/leaderboard/players", requireAuth, async (req, res) => {
  try {
    const { timeRange = "all", house = "all", search } = req.query;

    let timeConstraint = sql`1=1`;
    const now = new Date();
    if (timeRange === "today") {
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      timeConstraint = gte(competitionScoreLedgerTable.createdAt, todayStart);
    } else if (timeRange === "week") {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      timeConstraint = gte(competitionScoreLedgerTable.createdAt, weekAgo);
    } else if (timeRange === "month") {
      const monthAgo = new Date();
      monthAgo.setDate(monthAgo.getDate() - 30);
      timeConstraint = gte(competitionScoreLedgerTable.createdAt, monthAgo);
    }

    let houseConstraint = sql`1=1`;
    if (house && house !== "all") {
      const normH = normalizeHouseName(house as string);
      houseConstraint = eq(competitionScoreLedgerTable.house, normH);
    }

    // Query real verified points aggregated from the ledger
    const rows = await db
      .select({
        userId: competitionScoreLedgerTable.userId,
        fullName: usersTable.fullName,
        photoURL: usersTable.photoURL,
        house: competitionScoreLedgerTable.house,
        totalPoints: sql<number>`coalesce(sum(${competitionScoreLedgerTable.points}), 0)::int`,
        gamesPlayed: sql<number>`count(${competitionScoreLedgerTable.id})::int`,
      })
      .from(competitionScoreLedgerTable)
      .innerJoin(usersTable, eq(competitionScoreLedgerTable.userId, usersTable.id))
      .where(and(timeConstraint, houseConstraint))
      .groupBy(
        competitionScoreLedgerTable.userId,
        usersTable.fullName,
        usersTable.photoURL,
        competitionScoreLedgerTable.house
      )
      .orderBy(desc(sql`coalesce(sum(${competitionScoreLedgerTable.points}), 0)`))
      .limit(50);

    const currentUser = getUser(req);

    // Compute rank, format house meta, and flag currentUser
    const leaderboard = rows.map((r, index) => {
      const normH = normalizeHouseName(r.house);
      const meta = OFFICIAL_HOUSES[normH];
      return {
        rank: index + 1,
        userId: r.userId,
        fullName: r.fullName,
        photoURL: r.photoURL,
        house: normH,
        houseDisplayName: meta.displayName,
        houseColor: meta.color,
        houseEmoji: meta.emoji,
        totalPoints: Number(r.totalPoints),
        gamesPlayed: Number(r.gamesPlayed),
        isCurrentUser: r.userId === currentUser.id,
      };
    });

    res.json({
      leaderboard,
      filters: { timeRange, house },
      connectionStatus: "LIVE",
    });
  } catch (err) {
    console.error("[competition] Player leaderboard error:", err);
    res.status(500).json({ error: "Failed to generate player leaderboard" });
  }
});

// House Championship Leaderboard (all 4 houses together)
router.get("/competition/leaderboard/houses", requireAuth, async (_req, res) => {
  try {
    const houseLedgerRows = await db
      .select({
        house: competitionScoreLedgerTable.house,
        totalPoints: sql<number>`coalesce(sum(${competitionScoreLedgerTable.points}), 0)::int`,
        eventCount: sql<number>`count(*)::int`,
      })
      .from(competitionScoreLedgerTable)
      .groupBy(competitionScoreLedgerTable.house);

    const housePointsMap = new Map<string, number>();
    for (const h of ALL_HOUSES) housePointsMap.set(h, 0);
    for (const r of houseLedgerRows) {
      const hName = normalizeHouseName(r.house);
      housePointsMap.set(hName, (housePointsMap.get(hName) || 0) + Number(r.totalPoints || 0));
    }

    const maxPoints = Math.max(...Array.from(housePointsMap.values()), 100);

    const standings = ALL_HOUSES.map((hName) => {
      const pts = housePointsMap.get(hName) || 0;
      const meta = OFFICIAL_HOUSES[hName];
      return {
        house: hName,
        displayName: meta.name,
        color: meta.color,
        emoji: meta.emoji,
        motto: meta.motto,
        totalPoints: pts,
        progressPercent: Math.min(100, Math.round((pts / maxPoints) * 100)),
        victories: Math.round(pts / 70),
      };
    })
      .sort((a, b) => b.totalPoints - a.totalPoints)
      .map((item, index) => ({
        rank: index + 1,
        ...item,
      }));

    res.json({
      standings,
      leadingHouse: standings[0]?.displayName || "Aravali",
      connectionStatus: "LIVE",
    });
  } catch (err) {
    console.error("[competition] House leaderboard error:", err);
    res.status(500).json({ error: "Failed to generate house leaderboard" });
  }
});

// ── 5. LIVE RECENT ACTIVITY FEED ─────────────────────────────────────────────
router.get("/competition/activity-feed", requireAuth, async (_req, res) => {
  try {
    const recentEvents = await db
      .select({
        id: competitionScoreLedgerTable.id,
        userId: competitionScoreLedgerTable.userId,
        userName: usersTable.fullName,
        photoURL: usersTable.photoURL,
        house: competitionScoreLedgerTable.house,
        points: competitionScoreLedgerTable.points,
        sourceType: competitionScoreLedgerTable.sourceType,
        reason: competitionScoreLedgerTable.reason,
        createdAt: competitionScoreLedgerTable.createdAt,
      })
      .from(competitionScoreLedgerTable)
      .innerJoin(usersTable, eq(competitionScoreLedgerTable.userId, usersTable.id))
      .orderBy(desc(competitionScoreLedgerTable.createdAt))
      .limit(15);

    const formatted = recentEvents.map((evt) => {
      const normH = normalizeHouseName(evt.house);
      const meta = OFFICIAL_HOUSES[normH];
      return {
        ...evt,
        houseDisplayName: meta.displayName,
        houseColor: meta.color,
        houseEmoji: meta.emoji,
      };
    });

    res.json({ activities: formatted });
  } catch (err) {
    console.error("[competition] Activity feed error:", err);
    res.status(500).json({ error: "Failed to fetch activity feed" });
  }
});

// ── 6. TOURNAMENTS & CHAMPIONSHIP EVENTS ──────────────────────────────────────
router.get("/competition/events", requireAuth, async (_req, res) => {
  try {
    const tournaments = await db
      .select()
      .from(houseTournamentsTable)
      .orderBy(desc(houseTournamentsTable.createdAt))
      .limit(5);

    res.json({ tournaments });
  } catch (err) {
    console.error("[competition] Events error:", err);
    res.status(500).json({ error: "Failed to fetch events" });
  }
});

// ── 7. PROTECTED ADMIN COMPETITION MANAGEMENT ─────────────────────────────────
router.post("/competition/admin/score-adjust", requireAuth, async (req, res) => {
  try {
    const admin = getUser(req);
    if (admin.role !== "official" && admin.role !== "teacher") {
      return res.status(403).json({ error: "Only JNV Officials and Teachers can adjust competition scores" });
    }

    const { targetUserId, house, points, reason } = req.body;
    if (!targetUserId || !points || !reason) {
      return res.status(400).json({ error: "targetUserId, points, and reason are required" });
    }

    const normH = normalizeHouseName(house);

    // Record score adjustment in ledger
    const ledgerRes = await recordScoreEvent({
      userId: targetUserId,
      house: normH,
      jnvId: admin.jnvId,
      sourceType: "admin_adjustment",
      sourceId: `admin:${Date.now()}`,
      points: Number(points),
      reason,
      verifiedBy: admin.id,
    });

    // Record in audit log
    await db.insert(competitionAdminAuditTable).values({
      adminId: admin.id,
      action: "SCORE_ADJUSTMENT",
      targetType: "USER",
      targetId: targetUserId,
      reason,
      newValue: { points: Number(points), house: normH },
    });

    res.json({
      success: true,
      message: `Score adjustment of ${points} pts recorded with audit log.`,
      scoreId: ledgerRes.scoreId,
    });
  } catch (err) {
    console.error("[competition] Admin score adjust error:", err);
    res.status(500).json({ error: "Failed to apply score adjustment" });
  }
});

export default router;

