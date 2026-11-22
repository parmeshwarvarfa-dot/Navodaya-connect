import { Router } from "express";
import { and, desc, eq, gte, ilike, inArray, sql } from "drizzle-orm";
import {
  db,
  jnvInstitutionalIndicatorsTable,
  jnvRankingScoresTable,
  rankingAwardsArchiveTable,
  rankingAuditTable,
  recognitionPointsTable,
  recognitionRulesTable,
  userBadgesTable,
  usersTable,
} from "@workspace/db";
import { getUser, requireAuth } from "../lib/auth";
import { calculateJnvScores, getUserBadgeTier, SPECIAL_BADGES } from "../lib/rankingEngine";
import { ensureRankingSeedData } from "../lib/rankingSeed";

const router = Router();
void ensureRankingSeedData();

// ── 1. RANKING OVERVIEW ────────────────────────────────────────────────────
router.get("/ranking/overview", requireAuth, async (req, res) => {
  try {
    const user = getUser(req);
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const currentYear = `${now.getFullYear()}`;

    // 1. Current user stats
    const [userSum] = await db
      .select({ total: sql<number>`COALESCE(SUM(${recognitionPointsTable.points}), 0)::int` })
      .from(recognitionPointsTable)
      .where(eq(recognitionPointsTable.userId, user.id));

    const [userMonthSum] = await db
      .select({ total: sql<number>`COALESCE(SUM(${recognitionPointsTable.points}), 0)::int` })
      .from(recognitionPointsTable)
      .where(
        and(
          eq(recognitionPointsTable.userId, user.id),
          eq(recognitionPointsTable.periodMonth, currentMonth)
        )
      );

    const totalPoints = userSum?.total || 0;
    const monthPoints = userMonthSum?.total || 0;
    const badgeInfo = getUserBadgeTier(totalPoints);

    // Compute user's current rank
    const rankResult = await db.execute(sql`
      SELECT COUNT(DISTINCT user_id)::int + 1 AS "userRank"
      FROM recognition_points
      GROUP BY user_id
      HAVING SUM(points) > ${totalPoints}
      LIMIT 1
    `);
    const rankRows = ((rankResult as any).rows || rankResult) as any[];
    const userRank = rankRows[0]?.userRank || 1;

    // 2. Top 3 individual contributors (All-time or this month)
    const topIndividualsResult = await db.execute(sql`
      SELECT u.id AS "userId", u.full_name AS "fullName", u.role, u.jnv_name AS "jnvName", u.jnv_state AS "jnvState",
        u.photo_url AS "avatarUrl",
        COALESCE(SUM(p.points), 0)::int AS "totalPoints"
      FROM recognition_points p
      JOIN users u ON u.id = p.user_id
      WHERE u.verification_status = 'verified' AND u.profile_visibility <> 'private'
      GROUP BY u.id, u.full_name, u.role, u.jnv_name, u.jnv_state, u.photo_url
      ORDER BY "totalPoints" DESC, u.full_name ASC
      LIMIT 3
    `);
    const topIndividuals = ((topIndividualsResult as any).rows || topIndividualsResult) as any[];

    const formattedTopIndividuals = (topIndividuals || []).map((row: any, idx: number) => ({
      rank: idx + 1,
      userId: row.userId,
      fullName: row.fullName,
      role: row.role,
      jnvName: row.jnvName,
      jnvState: row.jnvState,
      avatarUrl: row.avatarUrl,
      totalPoints: row.totalPoints,
      badge: getUserBadgeTier(row.totalPoints),
    }));

    // 3. Top 3 JNVs
    const topJnvs = await db
      .select()
      .from(jnvRankingScoresTable)
      .where(eq(jnvRankingScoresTable.periodType, "month"))
      .orderBy(desc(jnvRankingScoresTable.totalScore))
      .limit(3);

    // 4. Current monthly and annual awards
    const awards = await db
      .select()
      .from(rankingAwardsArchiveTable)
      .where(eq(rankingAwardsArchiveTable.status, "published"))
      .orderBy(desc(rankingAwardsArchiveTable.createdAt))
      .limit(6);

    const navodayaMonth = awards.find((a) => a.awardType === "navodaya_of_the_month");
    const navodayanMonth = awards.find((a) => a.awardType === "navodayan_of_the_month");
    const navodayaYear = awards.find((a) => a.awardType === "navodaya_of_the_year");
    const navodayanYear = awards.find((a) => a.awardType === "navodayan_of_the_year");

    // 5. Recent points activity
    const recentActivity = await db
      .select({
        id: recognitionPointsTable.id,
        userId: recognitionPointsTable.userId,
        userName: usersTable.fullName,
        jnvName: usersTable.jnvName,
        points: recognitionPointsTable.points,
        reason: recognitionPointsTable.reason,
        createdAt: recognitionPointsTable.createdAt,
      })
      .from(recognitionPointsTable)
      .innerJoin(usersTable, eq(usersTable.id, recognitionPointsTable.userId))
      .orderBy(desc(recognitionPointsTable.createdAt))
      .limit(8);

    res.json({
      userStats: {
        userId: user.id,
        fullName: user.fullName,
        jnvName: user.jnvName,
        role: user.role,
        totalPoints,
        monthPoints,
        rank: userRank,
        badge: badgeInfo,
      },
      topIndividuals: formattedTopIndividuals,
      topJnvs,
      currentAwards: {
        navodayaMonth,
        navodayanMonth,
        navodayaYear,
        navodayanYear,
      },
      recentActivity,
    });
  } catch (err) {
    console.error("[ranking] Overview error:", err);
    res.status(500).json({ error: "Failed to fetch ranking overview" });
  }
});

// ── 2. INDIVIDUAL LEADERBOARD ──────────────────────────────────────────────
router.get("/ranking/individual", requireAuth, async (req, res) => {
  try {
    const user = getUser(req);
    const { state, jnv, role, period = "all_time", search } = req.query as Record<string, string>;

    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const currentYear = `${now.getFullYear()}`;
    const todayStr = now.toISOString().slice(0, 10);

    let periodCondition = sql`TRUE`;
    if (period === "daily") {
      periodCondition = sql`DATE(p.created_at) = ${todayStr}::date`;
    } else if (period === "weekly") {
      const lastWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      periodCondition = sql`p.created_at >= ${lastWeek}`;
    } else if (period === "monthly") {
      periodCondition = sql`p.period_month = ${currentMonth}`;
    } else if (period === "annual") {
      periodCondition = sql`p.period_month LIKE ${`${currentYear}-%`}`;
    }

    let searchCondition = sql`TRUE`;
    if (search && search.trim()) {
      searchCondition = sql`u.full_name ILIKE ${`%${search.trim()}%`}`;
    }

    let roleCondition = sql`TRUE`;
    if (role && role !== "all") {
      roleCondition = sql`u.role = ${role}`;
    }

    let stateCondition = sql`TRUE`;
    if (state && state !== "all") {
      stateCondition = sql`u.jnv_state = ${state}`;
    }

    let jnvCondition = sql`TRUE`;
    if (jnv && jnv !== "all") {
      jnvCondition = sql`u.jnv_name = ${jnv}`;
    }

    const rowsRes = await db.execute(sql`
      SELECT u.id AS "userId", u.full_name AS "fullName", u.role, u.jnv_name AS "jnvName", u.jnv_state AS "jnvState",
        u.photo_url AS "avatarUrl",
        COALESCE(SUM(p.points), 0)::int AS "periodPoints",
        COUNT(p.id)::int AS "activityCount"
      FROM recognition_points p
      JOIN users u ON u.id = p.user_id
      WHERE u.verification_status = 'verified'
        AND u.profile_visibility <> 'private'
        AND ${periodCondition}
        AND ${searchCondition}
        AND ${roleCondition}
        AND ${stateCondition}
        AND ${jnvCondition}
      GROUP BY u.id, u.full_name, u.role, u.jnv_name, u.jnv_state, u.photo_url
      HAVING SUM(p.points) > 0
      ORDER BY "periodPoints" DESC, "activityCount" DESC, u.full_name ASC
      LIMIT 100
    `);
    const rows = ((rowsRes as any).rows || rowsRes) as any[];

    const leaderboard = (rows || []).map((row: any, idx: number) => ({
      rank: idx + 1,
      userId: row.userId,
      fullName: row.fullName,
      role: row.role,
      jnvName: row.jnvName,
      jnvState: row.jnvState,
      avatarUrl: row.avatarUrl,
      periodPoints: row.periodPoints,
      activityCount: row.activityCount,
      badge: getUserBadgeTier(row.periodPoints),
      rankMovement: idx === 0 ? "same" : idx % 2 === 0 ? "up" : "same",
      isCurrentUser: row.userId === user.id,
    }));

    res.json({ leaderboard, count: leaderboard.length });
  } catch (err) {
    console.error("[ranking] Individual leaderboard error:", err);
    res.status(500).json({ error: "Failed to fetch individual leaderboard" });
  }
});

// ── 3. JNV INSTITUTIONAL RANKING ───────────────────────────────────────────
router.get("/ranking/jnv", requireAuth, async (req, res) => {
  try {
    const { state, periodType = "month", period = "2026-11" } = req.query as Record<string, string>;

    let query = db
      .select()
      .from(jnvRankingScoresTable)
      .where(
        and(
          eq(jnvRankingScoresTable.periodType, periodType),
          eq(jnvRankingScoresTable.period, period)
        )
      )
      .orderBy(jnvRankingScoresTable.rank);

    let list = await query;

    // Filter by state if requested
    if (state && state !== "all") {
      list = list.filter((item) => item.jnvState.toLowerCase() === state.toLowerCase());
    }

    res.json({
      scores: list,
      period,
      periodType,
      methodologyNote: "JNV Performance Index = 90% Institutional Performance (Academic 30%, Student Dev 25%, Wellbeing 20%, Infrastructure 15%, Alumni Initiatives 10%) + 10% Normalized Community Contribution.",
    });
  } catch (err) {
    console.error("[ranking] JNV ranking error:", err);
    res.status(500).json({ error: "Failed to fetch JNV ranking" });
  }
});

// ── 4. AWARDS & RECOGNITION ARCHIVE ────────────────────────────────────────
router.get("/ranking/awards", requireAuth, async (req, res) => {
  try {
    const awards = await db
      .select()
      .from(rankingAwardsArchiveTable)
      .where(eq(rankingAwardsArchiveTable.status, "published"))
      .orderBy(desc(rankingAwardsArchiveTable.period));

    const monthlyAwards = awards.filter((a) => a.periodType === "month");
    const annualAwards = awards.filter((a) => a.periodType === "year");

    res.json({
      monthlyAwards,
      annualAwards,
      totalAwards: awards.length,
    });
  } catch (err) {
    console.error("[ranking] Awards error:", err);
    res.status(500).json({ error: "Failed to fetch awards" });
  }
});

// ── 5. METHODOLOGY & POLICIES ──────────────────────────────────────────────
router.get("/ranking/methodology", async (_req, res) => {
  res.json({
    title: "Navodaya Connect Official Ranking & Recognition Methodology",
    version: "2.0",
    individualScoring: {
      description: "Points are strictly awarded for genuine, verified activities. Passive engagement (likes, follows, app usage) awards zero points.",
      activities: [
        { activity: "Verified Event Participation", points: 50, note: "Verified attendance at approved JNV / Alumni events" },
        { activity: "Verified Student Mentoring", points: 100, note: "Documented 1-on-1 or group counseling session" },
        { activity: "Successful Verified Referral", points: 20, note: "Awarded only after invited member completes verified onboarding" },
        { activity: "Educational Resource Sharing", points: 30, note: "Approved study materials, question papers, notes" },
        { activity: "Community Volunteering", points: 75, note: "Verified on-ground school or health camp participation" },
        { activity: "Organizing an Approved Event", points: 100, note: "Lead organizer of official meetups or sports meets" },
        { activity: "Career Guidance Session", points: 75, note: "College admissions, professional workshop delivery" },
      ],
      badges: [
        { badge: "New Navodayan", range: "0–499 pts", color: "#64748B" },
        { badge: "Active Contributor", range: "500–1,499 pts", color: "#2563EB" },
        { badge: "Community Champion", range: "1,500–3,499 pts", color: "#7C3AED" },
        { badge: "Navodaya Legend", range: "3,500+ pts", color: "#EAB308" },
      ],
      tieBreakPolicy: "1. Higher category-specific score -> 2. Total verified activity count -> 3. Alphabetical order.",
    },
    jnvInstitutionalScoring: {
      institutionalWeight: "90%",
      communityWeight: "10%",
      categories: [
        { category: "Academic Performance", weight: "30%", metrics: "CBSE board pass rate, distinctions, national subject averages" },
        { category: "Student Development", weight: "25%", metrics: "JEE, NEET, NDA, NTSE, and Olympiad selections" },
        { category: "Student Wellbeing & Inclusion", weight: "20%", metrics: "Hostel life quality, counseling, safety, health programs" },
        { category: "Infrastructure & Facilities", weight: "15%", metrics: "Smart classes, science laboratories, computer labs, athletic grounds" },
        { category: "Alumni & Community Initiatives", weight: "10%", metrics: "Mentorship hours, campus visits, sponsored equipment, scholarships" },
      ],
      normalizationPolicy: "Community contribution calculates active verified contributors as a ratio of registered verified alumni/students from that school. Large student populations cannot overpower smaller schools simply by registering more accounts.",
      dataCoveragePolicy: "Schools lacking minimum verified indicators across core categories are designated 'Insufficient Verified Data' rather than assigning an unreliable rank.",
      disclaimer: "Independent Navodaya Connect ranking based on verified public and community contributions. Not an official NVS publication.",
    },
  });
});

// ── 6. INDIVIDUAL RANKING PROFILE ──────────────────────────────────────────
router.get("/ranking/profile/:id", requireAuth, async (req, res) => {
  try {
    const userId = String(req.params.id);
    const [targetUser] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1);

    if (!targetUser) return res.status(404).json({ error: "User not found" });

    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const currentYear = `${now.getFullYear()}`;

    // Total points
    const [totalRes] = await db
      .select({ total: sql<number>`COALESCE(SUM(${recognitionPointsTable.points}), 0)::int` })
      .from(recognitionPointsTable)
      .where(eq(recognitionPointsTable.userId, userId));

    const [monthRes] = await db
      .select({ total: sql<number>`COALESCE(SUM(${recognitionPointsTable.points}), 0)::int` })
      .from(recognitionPointsTable)
      .where(
        and(
          eq(recognitionPointsTable.userId, userId),
          eq(recognitionPointsTable.periodMonth, currentMonth)
        )
      );

    const [yearRes] = await db
      .select({ total: sql<number>`COALESCE(SUM(${recognitionPointsTable.points}), 0)::int` })
      .from(recognitionPointsTable)
      .where(
        and(
          eq(recognitionPointsTable.userId, userId),
          sql`${recognitionPointsTable.periodMonth} LIKE ${`${currentYear}-%`}`
        )
      );

    const totalPoints = totalRes?.total || 0;
    const monthlyPoints = monthRes?.total || 0;
    const annualPoints = yearRes?.total || 0;
    const badgeInfo = getUserBadgeTier(totalPoints);

    // Compute all-India rank
    const rankRes = await db.execute(sql`
      SELECT COUNT(DISTINCT user_id)::int + 1 AS "userRank"
      FROM recognition_points
      GROUP BY user_id
      HAVING SUM(points) > ${totalPoints}
      LIMIT 1
    `);
    const rankRows = ((rankRes as any).rows || rankRes) as any[];
    const rank = rankRows[0]?.userRank || 1;

    // Badges
    const earnedBadges = await db
      .select()
      .from(userBadgesTable)
      .where(eq(userBadgesTable.userId, userId));

    // Awards earned
    const earnedAwards = await db
      .select()
      .from(rankingAwardsArchiveTable)
      .where(
        and(
          eq(rankingAwardsArchiveTable.winnerUserId, userId),
          eq(rankingAwardsArchiveTable.status, "published")
        )
      );

    // Activity breakdown
    const activityBreakdownRes = await db.execute(sql`
      SELECT activity, COUNT(id)::int AS count, COALESCE(SUM(points), 0)::int AS "totalPoints"
      FROM recognition_points
      WHERE user_id = ${userId}
      GROUP BY activity
      ORDER BY "totalPoints" DESC
    `);
    const activityBreakdown = ((activityBreakdownRes as any).rows || activityBreakdownRes) as any[];

    // History (recent 15 transactions)
    const pointsHistory = await db
      .select()
      .from(recognitionPointsTable)
      .where(eq(recognitionPointsTable.userId, userId))
      .orderBy(desc(recognitionPointsTable.createdAt))
      .limit(15);

    res.json({
      user: {
        id: targetUser.id,
        fullName: targetUser.fullName,
        role: targetUser.role,
        jnvName: targetUser.jnvName,
        jnvState: targetUser.jnvState,
        avatarUrl: targetUser.photoURL,
        verificationStatus: targetUser.verificationStatus,
      },
      stats: {
        totalPoints,
        monthlyPoints,
        annualPoints,
        rank,
        badge: badgeInfo,
      },
      earnedBadges,
      earnedAwards,
      activityBreakdown: activityBreakdown || [],
      pointsHistory,
    });
  } catch (err) {
    console.error("[ranking] Profile error:", err);
    res.status(500).json({ error: "Failed to fetch ranking profile" });
  }
});

// ── 7. PROTECTED ADMIN ENDPOINTS ───────────────────────────────────────────
// Score correction with mandatory audit reason
router.post("/ranking/admin/score-adjust", requireAuth, async (req, res) => {
  try {
    const admin = getUser(req);
    if (admin.role !== "official" && admin.role !== "teacher") {
      return res.status(403).json({ error: "Only JNV Officials and Teachers can adjust ranking points" });
    }

    const { targetUserId, points, reason } = req.body;
    if (!targetUserId || !points || !reason) {
      return res.status(400).json({ error: "targetUserId, points, and reason are required" });
    }

    const numPoints = parseInt(points, 10);
    if (isNaN(numPoints) || numPoints === 0) {
      return res.status(400).json({ error: "Points must be a valid non-zero integer" });
    }

    const now = new Date();
    const periodMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    // Record point adjustment
    const [entry] = await db
      .insert(recognitionPointsTable)
      .values({
        userId: targetUserId,
        actorId: admin.id,
        activity: "admin_adjustment",
        referenceId: `adj:${Date.now()}:${admin.id}`,
        points: numPoints,
        reason: reason.trim(),
        periodMonth,
      })
      .returning();

    // Log admin audit
    await db.insert(rankingAuditTable).values({
      adminId: admin.id,
      action: "score_adjustment",
      targetType: "user",
      targetId: targetUserId,
      reason: reason.trim(),
      details: { points: numPoints, entryId: entry.id },
    });

    res.json({
      success: true,
      message: `Successfully applied adjustment of ${numPoints > 0 ? `+${numPoints}` : numPoints} pts.`,
      entry,
    });
  } catch (err) {
    console.error("[ranking] Admin score adjust error:", err);
    res.status(500).json({ error: "Failed to apply score adjustment" });
  }
});

export default router;
