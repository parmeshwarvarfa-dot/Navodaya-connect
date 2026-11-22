import { index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { usersTable } from "./users";

// ── 1. INSTITUTIONAL PERFORMANCE INDICATORS (90% COMPONENT) ────────────────
export const jnvInstitutionalIndicatorsTable = pgTable("jnv_institutional_indicators", {
  id: uuid("id").primaryKey().defaultRandom(),
  jnvName: text("jnv_name").notNull(),
  jnvState: text("jnv_state").notNull(),
  academicYear: text("academic_year").notNull(), // e.g. "2025-2026"
  category: text("category").notNull(), // "academic" | "student_development" | "wellbeing_inclusion" | "infrastructure" | "alumni_community"
  indicatorName: text("indicator_name").notNull(),
  score: integer("score").notNull(), // 0 to 100
  weight: integer("weight").notNull().default(1),
  source: text("source").notNull().default("verified_submission"), // "CBSE" | "UDISE+" | "verified_submission"
  evidenceUrl: text("evidence_url"),
  evidenceNote: text("evidence_note"),
  status: text("status").notNull().default("verified"), // "verified" | "pending" | "rejected"
  verifiedById: uuid("verified_by_id").references(() => usersTable.id, { onDelete: "set null" }),
  verifiedAt: timestamp("verified_at").defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("jnv_indicators_school_year_idx").on(table.jnvName, table.academicYear),
  index("jnv_indicators_category_idx").on(table.category),
]);

// ── 2. JNV RANKING SCORES & PERFORMANCE INDEX ──────────────────────────────
export const jnvRankingScoresTable = pgTable("jnv_ranking_scores", {
  id: uuid("id").primaryKey().defaultRandom(),
  jnvName: text("jnv_name").notNull(),
  jnvState: text("jnv_state").notNull(),
  region: text("region").default("NVS Regional Office"),
  period: text("period").notNull(), // "2026-11" for monthly, "2026" for annual
  periodType: text("period_type").notNull().default("month"), // "month" | "year"
  institutionalScore: integer("institutional_score").notNull(), // 0 to 100 (90% weight)
  communityScore: integer("community_score").notNull(), // 0 to 100 (10% weight)
  totalScore: integer("total_score").notNull(), // 0 to 100 weighted sum
  rank: integer("rank").notNull(),
  dataCoverage: text("data_coverage").notNull().default("sufficient"), // "sufficient" | "insufficient_data"
  categoryBreakdown: jsonb("category_breakdown").$type<{
    academic: number;
    studentDevelopment: number;
    wellbeing: number;
    infrastructure: number;
    alumni: number;
    communityContribution: number;
  }>().notNull(),
  activeContributorsCount: integer("active_contributors_count").notNull().default(0),
  status: text("status").notNull().default("published"), // "provisional" | "published" | "archived"
  publishedAt: timestamp("published_at").defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  uniqueIndex("jnv_scores_school_period_uidx").on(table.jnvName, table.period, table.periodType),
  index("jnv_scores_period_rank_idx").on(table.period, table.rank),
  index("jnv_scores_state_idx").on(table.jnvState),
]);

// ── 3. USER BADGES & ACHIEVEMENTS ──────────────────────────────────────────
export const userBadgesTable = pgTable("user_badges", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  badgeKey: text("badge_key").notNull(), // "new_navodayan" | "active_contributor" | "community_champion" | "navodaya_legend" | "mentor_of_the_month" | etc.
  badgeTitle: text("badge_title").notNull(),
  badgeType: text("badge_type").notNull().default("tier"), // "tier" | "special"
  icon: text("icon").notNull().default("ribbon"),
  color: text("color").notNull().default("#7C3AED"),
  unlockedAt: timestamp("unlocked_at").notNull().defaultNow(),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
}, (table) => [
  uniqueIndex("user_badges_user_badge_uidx").on(table.userId, table.badgeKey),
  index("user_badges_user_idx").on(table.userId),
]);

// ── 4. OFFICIAL RANKING AWARDS ARCHIVE ──────────────────────────────────────
export const rankingAwardsArchiveTable = pgTable("ranking_awards_archive", {
  id: uuid("id").primaryKey().defaultRandom(),
  awardType: text("award_type").notNull(), // "navodaya_of_the_month" | "navodayan_of_the_month" | "navodaya_of_the_year" | "navodayan_of_the_year"
  period: text("period").notNull(), // "2026-11" or "2026"
  periodType: text("period_type").notNull(), // "month" | "year"
  targetType: text("target_type").notNull(), // "user" | "jnv"
  winnerUserId: uuid("winner_user_id").references(() => usersTable.id, { onDelete: "set null" }),
  winnerJnvName: text("winner_jnv_name"),
  winnerJnvState: text("winner_jnv_state"),
  winnerName: text("winner_name").notNull(),
  winnerRole: text("winner_role"),
  winnerAvatarUrl: text("winner_avatar_url"),
  score: integer("score").notNull(),
  summary: text("summary").notNull(),
  highlights: jsonb("highlights").$type<string[]>().default([]),
  scorecard: jsonb("scorecard").$type<Record<string, unknown>>().notNull().default({}),
  status: text("status").notNull().default("published"), // "review" | "published" | "revoked"
  finalizedById: uuid("finalized_by_id").references(() => usersTable.id, { onDelete: "set null" }),
  finalizedAt: timestamp("finalized_at").defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  uniqueIndex("ranking_awards_type_period_uidx").on(table.awardType, table.period).where(sql`${table.status} <> 'revoked'`),
  index("ranking_awards_type_idx").on(table.awardType),
  index("ranking_awards_period_idx").on(table.period),
]);

// ── 5. RANKING AUDIT LOG ───────────────────────────────────────────────────
export const rankingAuditTable = pgTable("ranking_audit", {
  id: uuid("id").primaryKey().defaultRandom(),
  adminId: uuid("admin_id").notNull().references(() => usersTable.id, { onDelete: "restrict" }),
  action: text("action").notNull(), // "score_adjustment" | "indicator_verified" | "award_finalized" | "rule_updated"
  targetType: text("target_type").notNull(), // "user" | "jnv" | "award" | "rule"
  targetId: text("target_id").notNull(),
  reason: text("reason").notNull(),
  details: jsonb("details").$type<Record<string, unknown>>().default({}),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
