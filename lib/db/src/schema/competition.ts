import { boolean, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

// 1. Central Authoritative Score Ledger
export const competitionScoreLedgerTable = pgTable(
  "competition_score_ledger",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
    house: text("house").notNull(), // "Aravali" | "Nilgiri" | "Shiwalik" | "Udaygiri"
    jnvId: text("jnv_id"),
    sourceType: text("source_type").notNull(), // "battle" | "daily_puzzle" | "solo_game" | "admin_adjustment" | "tournament"
    sourceId: text("source_id").notNull(),
    points: integer("points").notNull(),
    idempotencyKey: text("idempotency_key").unique(),
    reason: text("reason").notNull(),
    verifiedBy: uuid("verified_by").references(() => usersTable.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("score_ledger_user_created_idx").on(table.userId, table.createdAt),
    index("score_ledger_house_created_idx").on(table.house, table.createdAt),
    index("score_ledger_jnv_created_idx").on(table.jnvId, table.createdAt),
  ]
);

// 2. House Battles
export const houseBattlesTable = pgTable(
  "house_battles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: text("title").notNull(),
    format: text("format").notNull(), // "1v1" | "5v5" | "whole_house" | "speed_battle" | "knowledge_battle" | "championship"
    houseA: text("house_a").notNull(),
    houseB: text("house_b").notNull(),
    status: text("status").notNull().default("scheduled"), // "scheduled" | "lobby" | "live" | "completed" | "cancelled"
    scoreA: integer("score_a").notNull().default(0),
    scoreB: integer("score_b").notNull().default(0),
    winnerHouse: text("winner_house"),
    questions: jsonb("questions").$type<any[]>().default([]),
    durationSeconds: integer("duration_seconds").notNull().default(120),
    startsAt: timestamp("starts_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("house_battles_status_idx").on(table.status),
    index("house_battles_created_idx").on(table.createdAt),
  ]
);

// 3. Battle Participants
export const battleParticipantsTable = pgTable(
  "battle_participants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    battleId: uuid("battle_id").notNull().references(() => houseBattlesTable.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
    house: text("house").notNull(),
    score: integer("score").notNull().default(0),
    answers: jsonb("answers").$type<Record<string, any>>().default({}),
    isReady: boolean("is_ready").notNull().default(false),
    joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
  },
  (table) => [
    index("battle_parts_battle_idx").on(table.battleId),
    index("battle_parts_user_idx").on(table.userId),
  ]
);

// 4. Daily Puzzles
export const dailyPuzzlesTable = pgTable(
  "daily_puzzles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    puzzleType: text("puzzle_type").notNull(), // "word_of_day" | "connections" | "number_ninja" | "mini_crossword" | "daily_gk" | "pattern_master"
    puzzleDate: text("puzzle_date").notNull(), // "YYYY-MM-DD"
    title: text("title").notNull(),
    puzzleData: jsonb("puzzle_data").$type<Record<string, any>>().notNull(),
    solutionData: jsonb("solution_data").$type<Record<string, any>>().notNull(),
    maxRewardPoints: integer("max_reward_points").notNull().default(50),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("daily_puzzles_type_date_uidx").on(table.puzzleType, table.puzzleDate),
  ]
);

// 5. Daily Puzzle Attempts
export const dailyPuzzleAttemptsTable = pgTable(
  "daily_puzzle_attempts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    puzzleId: uuid("puzzle_id").notNull().references(() => dailyPuzzlesTable.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
    house: text("house").notNull(),
    isPractice: boolean("is_practice").notNull().default(false),
    status: text("status").notNull().default("in_progress"), // "in_progress" | "completed" | "failed"
    attemptsUsed: integer("attempts_used").notNull().default(1),
    scoreAwarded: integer("score_awarded").notNull().default(0),
    timeTakenSeconds: integer("time_taken_seconds").notNull().default(0),
    userGuesses: jsonb("user_guesses").$type<any[]>().default([]),
    streakCount: integer("streak_count").notNull().default(1),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("puzzle_attempts_user_puzzle_idx").on(table.userId, table.puzzleId),
  ]
);

// 6. House Tournaments / Championships
export const houseTournamentsTable = pgTable(
  "house_tournaments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    season: text("season").notNull(), // e.g. "Season 2026-Q4"
    jnvId: text("jnv_id"),
    status: text("status").notNull().default("upcoming"), // "upcoming" | "active" | "completed"
    rules: jsonb("rules").$type<Record<string, any>>().default({}),
    standings: jsonb("standings").$type<Record<string, any>>().default({}),
    winnerHouse: text("winner_house"),
    startDate: timestamp("start_date", { withTimezone: true }),
    endDate: timestamp("end_date", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  }
);

// 7. Administrative Competition Audit Log
export const competitionAdminAuditTable = pgTable(
  "competition_admin_audit",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    adminId: uuid("admin_id").notNull().references(() => usersTable.id, { onDelete: "restrict" }),
    action: text("action").notNull(),
    targetType: text("target_type").notNull(),
    targetId: text("target_id").notNull(),
    reason: text("reason").notNull(),
    previousValue: jsonb("previous_value"),
    newValue: jsonb("new_value"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  }
);
