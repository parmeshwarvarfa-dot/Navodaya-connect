import { index, integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const gameSessionsTable = pgTable("game_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  gameId: text("game_id").notNull(),
  status: text("status").notNull().default("active"),
  state: jsonb("state").$type<Record<string, unknown>>().notNull(),
  score: integer("score").notNull().default(0),
  correctCount: integer("correct_count").notNull().default(0),
  questionCount: integer("question_count").notNull().default(0),
  rewardPoints: integer("reward_points").notNull().default(0),
  result: jsonb("result").$type<Record<string, unknown>>(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("game_sessions_user_created_idx").on(table.userId, table.createdAt),
  index("game_sessions_game_points_idx").on(table.gameId, table.rewardPoints),
]);

export type GameSession = typeof gameSessionsTable.$inferSelect;
