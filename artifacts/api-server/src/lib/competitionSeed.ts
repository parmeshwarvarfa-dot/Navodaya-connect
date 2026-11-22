import { and, eq } from "drizzle-orm";
import {
  db,
  dailyPuzzlesTable,
  houseBattlesTable,
  houseTournamentsTable,
  competitionScoreLedgerTable,
  gameSessionsTable,
  usersTable,
} from "@workspace/db";
import { normalizeHouseName } from "./houseConstants";

export async function ensureCompetitionSeedData(): Promise<void> {
  try {
    const today = new Date().toISOString().slice(0, 10);

    // 1. Seed Today's Daily Puzzles if not present
    const existingPuzzles = await db
      .select()
      .from(dailyPuzzlesTable)
      .where(eq(dailyPuzzlesTable.puzzleDate, today))
      .limit(1);

    if (existingPuzzles.length === 0) {
      await db.insert(dailyPuzzlesTable).values([
        // A. WORD OF THE DAY
        {
          puzzleType: "word_of_day",
          puzzleDate: today,
          title: "Word of the Day #42",
          maxRewardPoints: 50,
          puzzleData: {
            wordLength: 5,
            maxAttempts: 6,
            hint: "The feeling of deep satisfaction from JNV achievements.",
          },
          solutionData: {
            word: "PRIDE",
            definition: "A feeling of deep pleasure or satisfaction derived from one's own achievements or the achievements of one's school.",
          },
        },

        // B. CONNECTIONS (16 words, 4 groups of 4)
        {
          puzzleType: "connections",
          puzzleDate: today,
          title: "Navodaya Connections #18",
          maxRewardPoints: 60,
          puzzleData: {
            words: [
              // JNV Houses
              "Aravali", "Nilgiri", "Shiwalik", "Udaygiri",
              // Morning Assembly Items
              "Pledge", "Prayer", "Thought", "News",
              // JNV Dining Hall Staples
              "Roti", "Dal", "Kheer", "Halwa",
              // Famous Indian Rivers
              "Ganga", "Yamuna", "Narmada", "Kaveri",
            ],
          },
          solutionData: {
            groups: [
              {
                category: "Navodaya Houses",
                level: 1,
                color: "#2563EB",
                words: ["Aravali", "Nilgiri", "Shiwalik", "Udaygiri"],
              },
              {
                category: "Morning Assembly Routine",
                level: 2,
                color: "#16A34A",
                words: ["Pledge", "Prayer", "Thought", "News"],
              },
              {
                category: "Sunday Feast Delicacies",
                level: 3,
                color: "#EAB308",
                words: ["Roti", "Dal", "Kheer", "Halwa"],
              },
              {
                category: "Rivers of India",
                level: 4,
                color: "#7C3AED",
                words: ["Ganga", "Yamuna", "Narmada", "Kaveri"],
              },
            ],
          },
        },

        // C. NUMBER NINJA
        {
          puzzleType: "number_ninja",
          puzzleDate: today,
          title: "Number Ninja #29",
          maxRewardPoints: 50,
          puzzleData: {
            challenges: [
              { id: 1, prompt: "What is next: 2, 6, 12, 20, 30, ?", options: [38, 40, 42, 44] },
              { id: 2, prompt: "Solve: (15 × 8) - (12 × 5) = ?", options: [50, 60, 70, 80] },
              { id: 3, prompt: "What is the square root of 1764?", options: [38, 42, 44, 46] },
              { id: 4, prompt: "Find missing number: 3, 9, 27, 81, ?", options: [162, 243, 324, 729] },
              { id: 5, prompt: "If 7 cats catch 7 mice in 7 minutes, how many minutes do 100 cats take to catch 100 mice?", options: [7, 70, 100, 700] },
            ],
          },
          solutionData: {
            answers: { 1: 42, 2: 60, 3: 42, 4: 243, 5: 7 },
          },
        },

        // D. MINI CROSSWORD (5x5)
        {
          puzzleType: "mini_crossword",
          puzzleDate: today,
          title: "Mini Crossword #15",
          maxRewardPoints: 50,
          puzzleData: {
            size: 5,
            clues: {
              across: [
                { num: 1, clue: "Navodaya identity unit (4 letters)", row: 0, col: 0, len: 4 },
                { num: 3, clue: "Fast animal with spots (7 letters)", row: 2, col: 0, len: 5 },
                { num: 5, clue: "Opposite of cold (3 letters)", row: 4, col: 1, len: 3 },
              ],
              down: [
                { num: 1, clue: "Warm family residence (4 letters)", row: 0, col: 0, len: 4 },
                { num: 2, clue: "Organ of sight (3 letters)", row: 0, col: 2, len: 3 },
                { num: 4, clue: "Tree fluid (3 letters)", row: 1, col: 4, len: 3 },
              ],
            },
          },
          solutionData: {
            grid: [
              ["H", "O", "M", "E", "#"],
              ["O", "#", "A", "#", "S"],
              ["T", "I", "G", "E", "R"],
              ["#", "#", "P", "#", "P"],
              ["#", "H", "O", "T", "#"],
            ],
          },
        },

        // E. DAILY GK
        {
          puzzleType: "daily_gk",
          puzzleDate: today,
          title: "Daily GK Express #36",
          maxRewardPoints: 50,
          puzzleData: {
            questions: [
              {
                id: 1,
                prompt: "Which Indian scientist was awarded the Nobel Prize in Physics in 1930 for light scattering?",
                category: "Science",
                options: ["Homi Bhabha", "C. V. Raman", "S. N. Bose", "Vikram Sarabhai"],
              },
              {
                id: 2,
                prompt: "In which state is the ancient Nalanda University situated?",
                category: "History",
                options: ["Uttar Pradesh", "Bihar", "West Bengal", "Odisha"],
              },
              {
                id: 3,
                prompt: "What is the longest river in Peninsular India?",
                category: "Geography",
                options: ["Narmada", "Godavari", "Krishna", "Kaveri"],
              },
              {
                id: 4,
                prompt: "Which Indian spacecraft successfully entered lunar orbit with the Pragyan rover?",
                category: "Space",
                options: ["Chandrayaan-1", "Mangalyaan", "Chandrayaan-3", "Aditya-L1"],
              },
              {
                id: 5,
                prompt: "How many official languages are listed in the Eighth Schedule of the Indian Constitution?",
                category: "Civics",
                options: ["18", "20", "22", "24"],
              },
            ],
          },
          solutionData: {
            answers: { 1: 1, 2: 1, 3: 1, 4: 2, 5: 2 },
          },
        },

        // F. PATTERN MASTER
        {
          puzzleType: "pattern_master",
          puzzleDate: today,
          title: "Pattern Master #22",
          maxRewardPoints: 50,
          puzzleData: {
            questions: [
              {
                id: 1,
                prompt: "Identify the pattern: 1, 4, 9, 16, 25, 36, ?",
                rule: "Squares of sequential integers (1², 2², 3²...)",
                options: ["42", "48", "49", "54"],
              },
              {
                id: 2,
                prompt: "Letter sequence: B, D, G, K, P, ?",
                rule: "+2, +3, +4, +5, +6",
                options: ["T", "U", "V", "W"],
              },
              {
                id: 3,
                prompt: "Alternating sequence: 10, 20, 15, 30, 25, 50, ?",
                rule: "×2, -5, ×2, -5...",
                options: ["40", "45", "55", "60"],
              },
            ],
          },
          solutionData: {
            answers: { 1: 2, 2: 2, 3: 1 },
          },
        },
      ]);
      console.log("[competitionSeed] Seeded today's 6 daily puzzles.");
    }

    // 2. Seed House Tournament if not present
    const existingTournaments = await db
      .select()
      .from(houseTournamentsTable)
      .limit(1);

    if (existingTournaments.length === 0) {
      await db.insert(houseTournamentsTable).values({
        name: "Annual Inter House Championship 2026",
        season: "Season 2026-Q4",
        status: "active",
        rules: {
          winPoints: 100,
          drawPoints: 50,
          formats: ["1v1", "5v5", "speed_battle", "knowledge_battle"],
          rounds: 5,
        },
        standings: {
          Aravali: { matches: 4, wins: 3, points: 300 },
          Nilgiri: { matches: 4, wins: 2, points: 250 },
          Shiwalik: { matches: 4, wins: 2, points: 220 },
          Udaygiri: { matches: 4, wins: 1, points: 180 },
        },
      });
      console.log("[competitionSeed] Seeded active House Tournament.");
    }

    // 3. Seed Scheduled & Active Battles
    const existingBattles = await db.select().from(houseBattlesTable).limit(1);
    if (existingBattles.length === 0) {
      await db.insert(houseBattlesTable).values([
        {
          title: "Speed Duel: Science & Math Sprint",
          format: "speed_battle",
          houseA: "Aravali",
          houseB: "Nilgiri",
          status: "live",
          scoreA: 180,
          scoreB: 160,
          durationSeconds: 120,
          questions: [
            {
              id: 1,
              prompt: "What is the SI unit of power?",
              options: ["Joule", "Watt", "Newton", "Pascal"],
              correctIndex: 1,
            },
            {
              id: 2,
              prompt: "Which gas is known as laughing gas?",
              options: ["Nitrous Oxide", "Carbon Monoxide", "Methane", "Ozone"],
              correctIndex: 0,
            },
            {
              id: 3,
              prompt: "Solve: 78 - 39 + 15 = ?",
              options: ["50", "52", "54", "56"],
              correctIndex: 2,
            },
            {
              id: 4,
              prompt: "What is the value of Pi rounded to two decimal places?",
              options: ["3.12", "3.14", "3.16", "3.18"],
              correctIndex: 1,
            },
          ],
        },
        {
          title: "Knowledge Clash: Indian History & Heritage",
          format: "knowledge_battle",
          houseA: "Shiwalik",
          houseB: "Udaygiri",
          status: "lobby",
          scoreA: 0,
          scoreB: 0,
          durationSeconds: 120,
          questions: [
            {
              id: 1,
              prompt: "Which Mauryan Emperor renounced violence after the Kalinga War?",
              options: ["Chandragupta", "Ashoka", "Bindusara", "Brihadratha"],
              correctIndex: 1,
            },
            {
              id: 2,
              prompt: "Who built the famous Konark Sun Temple in Odisha?",
              options: ["Narasimhadeva I", "Anantavarman", "Kharavela", "Kapilendra Deva"],
              correctIndex: 0,
            },
            {
              id: 3,
              prompt: "Where was Mahatma Gandhi's first Satyagraha in India launched?",
              options: ["Kheda", "Champaran", "Ahmedabad", "Bardoli"],
              correctIndex: 1,
            },
          ],
        },
        {
          title: "Grand Final: All-Round Champions Trophy",
          format: "championship",
          houseA: "Aravali",
          houseB: "Shiwalik",
          status: "scheduled",
          scoreA: 0,
          scoreB: 0,
          durationSeconds: 180,
          questions: [],
        },
      ]);
      console.log("[competitionSeed] Seeded initial House Battles.");
    }

    // 4. Synchronize any historical game sessions into the score ledger so leaderboard is pre-filled with real verified points
    const existingLedgerRecords = await db
      .select()
      .from(competitionScoreLedgerTable)
      .limit(1);

    if (existingLedgerRecords.length === 0) {
      const historicalSessions = await db
        .select({
          id: gameSessionsTable.id,
          userId: gameSessionsTable.userId,
          gameId: gameSessionsTable.gameId,
          rewardPoints: gameSessionsTable.rewardPoints,
          house: usersTable.house,
          jnvId: usersTable.jnvId,
          createdAt: gameSessionsTable.createdAt,
        })
        .from(gameSessionsTable)
        .innerJoin(usersTable, eq(gameSessionsTable.userId, usersTable.id))
        .where(eq(gameSessionsTable.status, "completed"))
        .limit(20);

      for (const sess of historicalSessions) {
        if (sess.rewardPoints > 0) {
          const house = normalizeHouseName(sess.house);
          await db
            .insert(competitionScoreLedgerTable)
            .values({
              userId: sess.userId,
              house,
              jnvId: sess.jnvId || null,
              sourceType: "solo_game",
              sourceId: sess.id,
              points: sess.rewardPoints,
              idempotencyKey: `solo:${sess.id}:${sess.userId}`,
              reason: `Earned in ${sess.gameId}`,
              createdAt: sess.createdAt,
            })
            .onConflictDoNothing();
        }
      }
      console.log(`[competitionSeed] Synchronized historical game points into ledger.`);
    }
  } catch (err) {
    console.warn("[competitionSeed] Seed error:", err);
  }
}
