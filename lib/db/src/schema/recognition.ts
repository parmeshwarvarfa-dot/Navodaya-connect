import { index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { usersTable } from "./users";

export const recognitionRulesTable = pgTable("recognition_rules", {
  activity: text("activity").primaryKey(),
  points: integer("points").notNull(),
  dailyLimit: integer("daily_limit").notNull(),
  enabled: text("enabled").notNull().default("true"),
  updatedById: uuid("updated_by_id").references(() => usersTable.id, { onDelete: "set null" }),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const recognitionPointsTable = pgTable("recognition_points", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  actorId: uuid("actor_id").references(() => usersTable.id, { onDelete: "set null" }),
  activity: text("activity").notNull(),
  referenceId: text("reference_id").notNull(),
  points: integer("points").notNull(),
  reason: text("reason").notNull(),
  periodMonth: text("period_month").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  uniqueIndex("recognition_points_activity_ref_user_uidx").on(table.activity, table.referenceId, table.userId),
  index("recognition_points_user_created_idx").on(table.userId, table.createdAt),
  index("recognition_points_period_activity_idx").on(table.periodMonth, table.activity),
]);

export const recognitionAwardsTable = pgTable("recognition_awards", {
  id: uuid("id").primaryKey().defaultRandom(),
  category: text("category").notNull(),
  period: text("period").notNull(),
  winnerId: uuid("winner_id").notNull().references(() => usersTable.id, { onDelete: "restrict" }),
  score: integer("score").notNull(),
  summary: text("summary").notNull(),
  status: text("status").notNull().default("review"),
  finalizedById: uuid("finalized_by_id").references(() => usersTable.id, { onDelete: "set null" }),
  finalizedAt: timestamp("finalized_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  uniqueIndex("recognition_awards_category_period_uidx").on(table.category, table.period).where(sql`${table.status} <> 'revoked'`),
  index("recognition_awards_status_period_idx").on(table.status, table.period),
]);

export const recognitionAdminAuditTable = pgTable("recognition_admin_audit", {
  id: uuid("id").primaryKey().defaultRandom(),
  adminId: uuid("admin_id").notNull().references(() => usersTable.id, { onDelete: "restrict" }),
  action: text("action").notNull(),
  targetId: text("target_id").notNull(),
  reason: text("reason").notNull(),
  details: jsonb("details").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
