import { Router } from "express";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { db, recognitionAdminAuditTable, recognitionAwardsTable, recognitionPointsTable, recognitionRulesTable, socialNotificationsTable, usersTable } from "@workspace/db";
import { getUser, isAuthorizedJnvOfficial, requireAuth } from "../lib/auth";
import { awardRecognitionPoints, nextMonth, RECOGNITION_CATEGORIES, recognitionScores, prepareRecognitionCandidates, type RecognitionCategory } from "../lib/recognition";
import { canViewProfile, isBlockedBetween } from "../lib/social-access";
import { isValidUserId } from "./user-validation";

const router = Router();

const PAGE_SIZE = 20;
const validPeriod = (value: string, annual = false) => annual ? /^(19|20|21)\d{2}$/.test(value) : /^(19|20|21)\d{2}-(0[1-9]|1[0-2])$/.test(value);

async function officialAdmin(req: Parameters<typeof getUser>[0]) {
  const user = getUser(req);
  return user.role === "official" && await isAuthorizedJnvOfficial(user) ? user : null;
}

router.get("/recognition/summary", requireAuth, async (req, res) => {
  try {
    const user = getUser(req);
    const offset = Math.max(0, Math.min(100_000, Number.parseInt(String(req.query.offset ?? "0"), 10) || 0));
    const [totals, history, awards] = await Promise.all([
      db.select({
        total: sql<number>`COALESCE(SUM(${recognitionPointsTable.points}), 0)::int`,
        contributionCount: sql<number>`(
          SELECT COUNT(*)::int
          FROM recognition_points contribution
          WHERE contribution.user_id = ${user.id}
            AND contribution.points > 0
            AND contribution.activity NOT IN ('profile_complete', 'manual_reversal')
            AND NOT EXISTS (
              SELECT 1
              FROM recognition_points reversal
              WHERE reversal.activity = 'manual_reversal'
                AND reversal.user_id = contribution.user_id
                AND reversal.reference_id = contribution.id::text
            )
        )`,
      }).from(recognitionPointsTable).where(eq(recognitionPointsTable.userId, user.id)),
      db.select().from(recognitionPointsTable).where(eq(recognitionPointsTable.userId, user.id)).orderBy(desc(recognitionPointsTable.createdAt)).limit(PAGE_SIZE + 1).offset(offset),
      db.select({ id: recognitionAwardsTable.id, category: recognitionAwardsTable.category, period: recognitionAwardsTable.period, score: recognitionAwardsTable.score, summary: recognitionAwardsTable.summary })
        .from(recognitionAwardsTable).where(and(eq(recognitionAwardsTable.winnerId, user.id), eq(recognitionAwardsTable.status, "finalized"))).orderBy(desc(recognitionAwardsTable.period)).limit(100),
    ]);
    const hasMore = history.length > PAGE_SIZE;
    return res.json({ totalPoints: Number(totals[0]?.total ?? 0), contributionCount: Number(totals[0]?.contributionCount ?? 0), history: history.slice(0, PAGE_SIZE), awards, nextHistoryOffset: hasMore ? offset + PAGE_SIZE : null });
  } catch (error) {
    req.log.error(error, "Failed to load recognition summary");
    return res.status(500).json({ error: "Could not load recognition history." });
  }
});

router.get("/recognition/leaderboard", requireAuth, async (req, res) => {
  const period = typeof req.query.period === "string" ? req.query.period : "";
  const category = typeof req.query.category === "string" ? req.query.category : "month_overall";
  const offset = Math.max(0, Math.min(100_000, Number.parseInt(String(req.query.offset ?? "0"), 10) || 0));
  if (!RECOGNITION_CATEGORIES.some((item) => item.key === category) || !validPeriod(period, category === "year")) return res.status(400).json({ error: "Choose a valid recognition period and category." });
  try {
    const user = getUser(req);
    const [scores, rules] = await Promise.all([
      recognitionScores(period, category as RecognitionCategory),
      db.select({ activity: recognitionRulesTable.activity, points: recognitionRulesTable.points, dailyLimit: recognitionRulesTable.dailyLimit, enabled: recognitionRulesTable.enabled }).from(recognitionRulesTable),
    ]);
    const rows = scores.rows as Array<Record<string, unknown>>;
    const index = rows.findIndex((row) => row.userId === user.id);
    const page = rows.slice(offset, offset + PAGE_SIZE);
    return res.json({ rows: page, currentUserRank: index < 0 ? null : index + 1, nextOffset: offset + PAGE_SIZE < rows.length ? offset + PAGE_SIZE : null, rules });
  } catch (error) {
    req.log.error(error, "Failed to load recognition leaderboard");
    return res.status(500).json({ error: "Could not load recognition rankings." });
  }
});

router.get("/recognition/hall-of-fame", requireAuth, async (req, res) => {
  try {
    const rows = await db.select({ id: recognitionAwardsTable.id, category: recognitionAwardsTable.category, period: recognitionAwardsTable.period, score: recognitionAwardsTable.score, summary: recognitionAwardsTable.summary, winnerName: usersTable.fullName, jnvName: usersTable.jnvName })
      .from(recognitionAwardsTable).innerJoin(usersTable, eq(usersTable.id, recognitionAwardsTable.winnerId))
      .where(eq(recognitionAwardsTable.status, "finalized")).orderBy(desc(recognitionAwardsTable.period)).limit(100);
    return res.json(rows);
  } catch (error) {
    req.log.error(error, "Failed to load recognition hall of fame");
    return res.status(500).json({ error: "Could not load the Hall of Fame." });
  }
});

router.get("/recognition/admin", requireAuth, async (req, res) => {
  if (!await officialAdmin(req)) return res.status(403).json({ error: "An authorized JNV official account is required." });
  try {
    const [candidates, awards, rules, points] = await Promise.all([
      db.select({ award: recognitionAwardsTable, winnerName: usersTable.fullName }).from(recognitionAwardsTable).innerJoin(usersTable, eq(usersTable.id, recognitionAwardsTable.winnerId)).where(eq(recognitionAwardsTable.status, "review")).orderBy(desc(recognitionAwardsTable.period)).limit(100),
      db.select({ award: recognitionAwardsTable, winnerName: usersTable.fullName }).from(recognitionAwardsTable).innerJoin(usersTable, eq(usersTable.id, recognitionAwardsTable.winnerId)).orderBy(desc(recognitionAwardsTable.createdAt)).limit(100),
      db.select().from(recognitionRulesTable).orderBy(recognitionRulesTable.activity),
      db.select({ id: recognitionPointsTable.id, userName: usersTable.fullName, reason: recognitionPointsTable.reason, periodMonth: recognitionPointsTable.periodMonth, points: recognitionPointsTable.points, activity: recognitionPointsTable.activity, createdAt: recognitionPointsTable.createdAt }).from(recognitionPointsTable).innerJoin(usersTable, eq(usersTable.id, recognitionPointsTable.userId)).orderBy(desc(recognitionPointsTable.createdAt)).limit(100),
    ]);
    return res.json({ candidates: candidates.map((row) => ({ ...row.award, winnerName: row.winnerName })), history: awards.map((row) => ({ ...row.award, winnerName: row.winnerName })), rules, points });
  } catch (error) {
    req.log.error(error, "Failed to load recognition review queue");
    return res.status(500).json({ error: "Could not load recognition review." });
  }
});

router.post("/recognition/prepare-month", requireAuth, async (req, res) => {
  const admin = await officialAdmin(req);
  if (!admin) return res.status(403).json({ error: "An authorized JNV official account is required." });
  const period = typeof req.body?.period === "string" ? req.body.period : "";
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit" }).format(new Date());
  if (!validPeriod(period) || nextMonth(period) > today) return res.status(400).json({ error: "Only a completed month can be prepared for review." });
  try {
    const created = await prepareRecognitionCandidates(period, RECOGNITION_CATEGORIES.filter((item) => item.key !== "year"));
    return res.json({ candidatesCreated: created.length });
  } catch (error) {
    req.log.error(error, "Failed to prepare monthly recognition candidates");
    return res.status(500).json({ error: "Could not prepare the monthly review." });
  }
});

router.post("/recognition/prepare-year", requireAuth, async (req, res) => {
  const admin = await officialAdmin(req);
  if (!admin) return res.status(403).json({ error: "An authorized JNV official account is required." });
  const year = String(req.body?.year ?? "");
  const currentYear = Number(new Intl.DateTimeFormat("en", { timeZone: "Asia/Kolkata", year: "numeric" }).format(new Date()));
  if (!validPeriod(year, true) || Number(year) >= currentYear) return res.status(400).json({ error: "Only a completed year can be prepared for review." });
  try {
    const created = await prepareRecognitionCandidates(year, RECOGNITION_CATEGORIES.filter((item) => item.key === "year"));
    return res.json({ candidatesCreated: created.length });
  } catch (error) {
    req.log.error(error, "Failed to prepare annual recognition candidates");
    return res.status(500).json({ error: "Could not prepare the annual review." });
  }
});

router.post("/recognition/awards/:id/finalize", requireAuth, async (req, res) => {
  const admin = await officialAdmin(req);
  if (!admin) return res.status(403).json({ error: "An authorized JNV official account is required." });
  const id = req.params.id as string, reason = typeof req.body?.reason === "string" ? req.body.reason.trim().slice(0, 1000) : "";
  if (reason.length < 5) return res.status(400).json({ error: "Add a review reason of at least 5 characters." });
  try {
    const award = await db.transaction(async (tx) => {
      const [row] = await tx.update(recognitionAwardsTable).set({ status: "finalized", finalizedById: admin.id, finalizedAt: new Date() })
        .where(and(eq(recognitionAwardsTable.id, id), eq(recognitionAwardsTable.status, "review"))).returning();
      if (!row) return null;
      await tx.insert(recognitionAdminAuditTable).values({ adminId: admin.id, action: "award_finalized", targetId: id, reason });
      await tx.insert(socialNotificationsTable).values({ recipientId: row.winnerId, actorId: admin.id, type: "recognition_award", entityId: row.id, message: `Your ${row.category.replaceAll("_", " ")} award for ${row.period} was finalized.` });
      return row;
    });
    return award ? res.json(award) : res.status(404).json({ error: "Review candidate not found." });
  } catch (error) { req.log.error(error, "Failed to finalize recognition award"); return res.status(500).json({ error: "Could not finalize this award." }); }
});

router.post("/recognition/points/:id/reverse", requireAuth, async (req, res) => {
  const admin = await officialAdmin(req);
  if (!admin) return res.status(403).json({ error: "An authorized JNV official account is required." });
  const id = req.params.id as string, reason = typeof req.body?.reason === "string" ? req.body.reason.trim().slice(0, 1000) : "";
  if (reason.length < 5) return res.status(400).json({ error: "Add a reversal reason of at least 5 characters." });
  try {
    const result = await db.transaction(async (tx) => {
      const [point] = await tx.select().from(recognitionPointsTable).where(eq(recognitionPointsTable.id, id)).limit(1);
      if (!point || point.points <= 0) return null;
      const now = new Date();
      const month = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit" }).format(now);
      const [reversal] = await tx.insert(recognitionPointsTable).values({ userId: point.userId, actorId: admin.id, activity: "manual_reversal", referenceId: point.id, points: -point.points, reason: `Reversed: ${reason}`, periodMonth: month }).onConflictDoNothing().returning();
      if (!reversal) return { duplicate: true };
      await tx.insert(recognitionAdminAuditTable).values({ adminId: admin.id, action: "points_reversed", targetId: id, reason, details: { reversalId: reversal.id } });
      return { duplicate: false };
    });
    if (!result) return res.status(404).json({ error: "Positive point record not found." });
    if (result.duplicate) return res.status(409).json({ error: "This point record was already reversed." });
    return res.json({ reversed: true });
  } catch (error) { req.log.error(error, "Failed to reverse recognition points"); return res.status(500).json({ error: "Could not reverse these points." }); }
});

router.post("/recognition/awards/:id/revoke", requireAuth, async (req, res) => {
  const admin = await officialAdmin(req);
  if (!admin) return res.status(403).json({ error: "An authorized JNV official account is required." });
  const id = req.params.id as string, reason = typeof req.body?.reason === "string" ? req.body.reason.trim().slice(0, 1000) : "";
  if (reason.length < 5) return res.status(400).json({ error: "Add a correction reason of at least 5 characters." });
  try {
    const [award] = await db.update(recognitionAwardsTable).set({ status: "revoked" }).where(and(eq(recognitionAwardsTable.id, id), eq(recognitionAwardsTable.status, "finalized"))).returning();
    if (!award) return res.status(404).json({ error: "Finalized award not found." });
    await db.insert(recognitionAdminAuditTable).values({ adminId: admin.id, action: "award_revoked", targetId: id, reason });
    return res.json({ revoked: true });
  } catch (error) { req.log.error(error, "Failed to revoke recognition award"); return res.status(500).json({ error: "Could not correct this award." }); }
});

router.post("/recognition/verified-activity", requireAuth, async (req, res) => {
  const admin = await officialAdmin(req);
  if (!admin) return res.status(403).json({ error: "An authorized JNV official account is required." });
  const { userId, activity, referenceId, reason } = req.body ?? {};
  if (typeof userId !== "string" || typeof activity !== "string" || typeof referenceId !== "string" || !referenceId.trim() || typeof reason !== "string" || reason.trim().length < 10) return res.status(400).json({ error: "Provide a user, supported activity, evidence reference, and a reason of at least 10 characters." });
  try {
    const entry = await awardRecognitionPoints({ userId, actorId: admin.id, activity, referenceId: referenceId.trim(), reason: reason.trim().slice(0, 1000) });
    if (!entry) return res.status(409).json({ error: "This activity was not awarded. Check the verified account, activity rule, daily limit, and duplicate reference." });
    await db.insert(recognitionAdminAuditTable).values({ adminId: admin.id, action: "verified_activity_awarded", targetId: entry.id, reason: reason.trim().slice(0, 1000), details: { userId, activity, referenceId } });
    return res.status(201).json(entry);
  } catch (error) { req.log.error(error, "Failed to award verified recognition activity"); return res.status(500).json({ error: "Could not record this contribution." }); }
});

router.patch("/recognition/rules/:activity", requireAuth, async (req, res) => {
  const admin = await officialAdmin(req);
  if (!admin) return res.status(403).json({ error: "An authorized JNV official account is required." });
  const activity = req.params.activity as string, { points, dailyLimit, enabled, reason } = req.body ?? {};
  if (!Number.isInteger(points) || points < -1000 || points > 1000 || !Number.isInteger(dailyLimit) || dailyLimit < 1 || dailyLimit > 10_000 || typeof enabled !== "boolean" || typeof reason !== "string" || reason.trim().length < 5) return res.status(400).json({ error: "Provide valid points, daily limit, enabled state, and a reason of at least 5 characters." });
  try {
    const [rule] = await db.update(recognitionRulesTable).set({ points, dailyLimit, enabled: enabled ? "true" : "false", updatedById: admin.id, updatedAt: new Date() }).where(eq(recognitionRulesTable.activity, activity)).returning();
    if (!rule) return res.status(404).json({ error: "Recognition rule not found." });
    await db.insert(recognitionAdminAuditTable).values({ adminId: admin.id, action: "rule_updated", targetId: activity, reason: reason.trim().slice(0, 1000), details: { points, dailyLimit, enabled } });
    return res.json(rule);
  } catch (error) { req.log.error(error, "Failed to update recognition rule"); return res.status(500).json({ error: "Could not update this rule." }); }
});

router.get("/recognition/profile/:id", requireAuth, async (req, res) => {
  const userId = req.params.id as string;
  if (!isValidUserId(userId)) return res.status(400).json({ error: "Invalid user ID" });

  try {
    const viewer = getUser(req);
    const [target] = await db.select({ id: usersTable.id }).from(usersTable)
      .where(eq(usersTable.id, userId)).limit(1);
    if (!target || await isBlockedBetween(viewer.id, userId)) {
      return res.status(404).json({ error: "User not found" });
    }
    if (!await canViewProfile(viewer.id, userId)) {
      return res.status(403).json({ error: "This profile is private" });
    }

    const indiaDate = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit",
    }).format(new Date());
    const [totals, awards, monthly, annual] = await Promise.all([
      db.select({ total: sql<number>`COALESCE(SUM(${recognitionPointsTable.points}), 0)::int` })
        .from(recognitionPointsTable).where(eq(recognitionPointsTable.userId, userId)),
      db.select({
        id: recognitionAwardsTable.id,
        category: recognitionAwardsTable.category,
        period: recognitionAwardsTable.period,
        score: recognitionAwardsTable.score,
        summary: recognitionAwardsTable.summary,
      }).from(recognitionAwardsTable).where(and(
        eq(recognitionAwardsTable.winnerId, userId),
        eq(recognitionAwardsTable.status, "finalized"),
      )).orderBy(desc(recognitionAwardsTable.period)),
      recognitionScores(indiaDate.slice(0, 7), "month_overall"),
      recognitionScores(indiaDate.slice(0, 4), "year"),
    ]);
    const rank = (rows: Record<string, unknown>[]) => {
      const index = rows.findIndex((row) => row.userId === userId);
      return index < 0 ? null : index + 1;
    };
    return res.json({
      totalPoints: Number(totals[0]?.total ?? 0),
      monthlyRank: rank(monthly.rows),
      annualRank: rank(annual.rows),
      awardCount: awards.length,
      awards,
    });
  } catch (error) {
    req.log.error(error, "Failed to load profile recognition");
    return res.status(500).json({ error: "Could not load recognition. Please try again later." });
  }
});

export default router;
