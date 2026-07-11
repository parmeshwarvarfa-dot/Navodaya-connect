import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const reportsTable = pgTable("reports", {
  id: uuid("id").primaryKey().defaultRandom(),
  reportedUserId: uuid("reported_user_id"),
  reportedUserName: text("reported_user_name"),
  reason: text("reason").notNull(),
  details: text("details"),
  reporterId: uuid("reporter_id"),
  reporterName: text("reporter_name"),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at").defaultNow(),
});

export type Report = typeof reportsTable.$inferSelect;
