import { and, count, eq, gte, sql } from "drizzle-orm";
import { db, recognitionAwardsTable, recognitionPointsTable, recognitionRulesTable, socialNotificationsTable, usersTable } from "@workspace/db";

export const RECOGNITION_CATEGORIES = [
  { key: "month_overall", title: "Navodayan of the Month", activities: ["profile_complete", "memory_post", "memory_like_received", "memory_comment_received", "help_verified", "job_verified", "mentorship_verified", "event_success_verified", "scholarship_verified", "initiative_verified"] },
  { key: "community_helper", title: "Community Helper of the Month", activities: ["help_verified", "memory_comment_received"] },
  { key: "mentor", title: "Best Mentor of the Month", activities: ["mentorship_verified"] },
  { key: "career", title: "Career Contributor of the Month", activities: ["job_verified", "scholarship_verified"] },
  { key: "social_impact", title: "Social Impact Champion", activities: ["initiative_verified", "help_verified"] },
  { key: "year", title: "Navodayan of the Year", activities: ["profile_complete", "memory_post", "memory_like_received", "memory_comment_received", "help_verified", "job_verified", "mentorship_verified", "event_success_verified", "scholarship_verified", "initiative_verified"] },
] as const;

export type RecognitionCategory = typeof RECOGNITION_CATEGORIES[number]["key"];

export function recognitionProfileComplete(user: { fullName: string; jnvName: string; jnvState: string; role: string; verificationStatus?: string | null; class?: string | null; passoutYear?: string | null; subject?: string | null; designation?: string | null }) {
  if (user.verificationStatus !== "verified") return false;
  if (!user.fullName.trim() || !user.jnvName.trim() || !user.jnvState.trim()) return false;
  if (user.role === "student") return Boolean(user.class?.trim());
  if (user.role === "alumni") return Boolean(user.passoutYear?.trim());
  if (user.role === "teacher") return Boolean(user.subject?.trim());
  if (user.role === "official") return Boolean(user.designation?.trim());
  return false;
}

export async function awardRecognitionPoints(input: {
  userId: string; actorId?: string | null; activity: string; referenceId: string; reason?: string;
}) {
  return db.transaction(async (tx) => {
    const [recipient] = await tx.select({ verificationStatus: usersTable.verificationStatus }).from(usersTable).where(eq(usersTable.id, input.userId)).limit(1);
    if (recipient?.verificationStatus !== "verified") return null;
    if (input.actorId && input.actorId !== input.userId) {
      const [actor] = await tx.select({ verificationStatus: usersTable.verificationStatus }).from(usersTable).where(eq(usersTable.id, input.actorId)).limit(1);
      if (actor?.verificationStatus !== "verified") return null;
    }
    const [rule] = await tx.select().from(recognitionRulesTable).where(eq(recognitionRulesTable.activity, input.activity)).limit(1);
    if (!rule || rule.enabled !== "true" || rule.points === 0) return null;
    const [existing] = await tx.select({ id: recognitionPointsTable.id }).from(recognitionPointsTable).where(and(
      eq(recognitionPointsTable.userId, input.userId), eq(recognitionPointsTable.activity, input.activity),
      eq(recognitionPointsTable.referenceId, input.referenceId),
    )).limit(1);
    if (existing) return null;
    const indiaDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
    const [indiaYear, indiaMonth] = indiaDate.split("-");
    const today = new Date(`${indiaDate}T00:00:00+05:30`);
    const [daily] = await tx.select({ total: count() }).from(recognitionPointsTable).where(and(
      eq(recognitionPointsTable.userId, input.userId), eq(recognitionPointsTable.activity, input.activity),
      gte(recognitionPointsTable.createdAt, today),
    ));
    if (Number(daily?.total ?? 0) >= rule.dailyLimit) return null;
    const [entry] = await tx.insert(recognitionPointsTable).values({
      userId: input.userId, actorId: input.actorId ?? null, activity: input.activity,
      referenceId: input.referenceId, points: rule.points,
      reason: input.reason ?? input.activity.replaceAll("_", " "),
      periodMonth: `${indiaYear}-${indiaMonth}`,
    }).onConflictDoNothing().returning();
    if (!entry) return null;
    await tx.insert(socialNotificationsTable).values({
      recipientId: input.userId, actorId: input.actorId ?? input.userId,
      type: "recognition_points", entityId: entry.id,
      message: `You earned ${rule.points} recognition points: ${entry.reason}.`,
    });
    return entry;
  });
}

export async function recognitionScores(period: string, category: RecognitionCategory) {
  const definition = RECOGNITION_CATEGORIES.find((item) => item.key === category)!;
  const isYear = category === "year";
  const start = isYear ? `${period}-01` : period;
  const end = isYear ? `${Number(period) + 1}-01` : nextMonth(period);
  return db.execute(sql`
    SELECT u.id AS "userId", u.full_name AS "fullName", u.role, u.jnv_name AS "jnvName",
      COALESCE(SUM(p.points), 0)::int AS score,
      COUNT(p.id)::int AS "activityCount",
      COALESCE(SUM(CASE WHEN p.activity IN ('memory_post','memory_like_received','memory_comment_received','help_verified') THEN p.points ELSE 0 END), 0)::int AS "communityScore",
      COALESCE(SUM(CASE WHEN p.activity = 'mentorship_verified' THEN p.points ELSE 0 END), 0)::int AS "mentorScore",
      COALESCE(SUM(CASE WHEN p.activity IN ('job_verified','scholarship_verified') THEN p.points ELSE 0 END), 0)::int AS "careerScore",
      COALESCE(SUM(CASE WHEN p.activity IN ('initiative_verified','help_verified') THEN p.points ELSE 0 END), 0)::int AS "impactScore"
    FROM recognition_points p JOIN users u ON u.id = p.user_id
    WHERE p.period_month >= ${start} AND p.period_month < ${end}
      AND p.activity IN (${sql.join(definition.activities.map((a) => sql`${a}`), sql`, `)})
      AND u.profile_visibility <> 'private'
    GROUP BY u.id, u.full_name, u.role, u.jnv_name
    ORDER BY ${scoreColumn(category)} DESC, "activityCount" DESC, u.full_name ASC
  `);
}

export function nextMonth(period: string) {
  const [year, month] = period.split("-").map(Number);
  return month === 12 ? `${year + 1}-01` : `${year}-${String(month + 1).padStart(2, "0")}`;
}

export async function prepareRecognitionCandidates(period: string, categories: readonly { key: RecognitionCategory; title: string }[]) {
  const created = [];
  for (const category of categories) {
    const [existing] = await db.select({ id: recognitionAwardsTable.id }).from(recognitionAwardsTable).where(and(
      eq(recognitionAwardsTable.category, category.key), eq(recognitionAwardsTable.period, period), sql`${recognitionAwardsTable.status} <> 'revoked'`,
    )).limit(1);
    if (existing) continue;
    const result = await recognitionScores(period, category.key);
    const winner = result.rows[0] as any;
    if (!winner) continue;
    const categoryScore = category.key === "community_helper" ? winner.communityScore
      : category.key === "mentor" ? winner.mentorScore : category.key === "career" ? winner.careerScore
        : category.key === "social_impact" ? winner.impactScore : winner.score;
    if (Number(categoryScore) <= 0) continue;
    const [award] = await db.insert(recognitionAwardsTable).values({ category: category.key, period,
      winnerId: winner.userId, score: Number(categoryScore),
      summary: `${category.title} candidate with ${categoryScore} category points and ${winner.activityCount} eligible contributions. Pending administrator review.`,
    }).onConflictDoNothing().returning();
    if (award) created.push(award);
  }
  return created;
}

function scoreColumn(category: RecognitionCategory) {
  if (category === "community_helper") return sql`"communityScore"`;
  if (category === "mentor") return sql`"mentorScore"`;
  if (category === "career") return sql`"careerScore"`;
  if (category === "social_impact") return sql`"impactScore"`;
  return sql`score`;
}
