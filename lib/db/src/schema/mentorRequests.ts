import { boolean, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { usersTable } from "./users";

export const mentorProfilesTable = pgTable("mentor_profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  available: boolean("available").notNull().default(false),
  categories: jsonb("categories").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  bio: text("bio").notNull().default(""),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [uniqueIndex("mentor_profiles_user_unique_idx").on(table.userId), index("mentor_profiles_available_idx").on(table.available)]);

export const mentorRequestsTable = pgTable("mentor_requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  studentId: uuid("student_id"),
  studentName: text("student_name"),
  mentorId: uuid("mentor_id"),
  mentorName: text("mentor_name"),
  category: text("category"),
  message: text("message"),
  status: text("status").default("pending"),
  createdAt: timestamp("created_at").defaultNow(),
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  feedbackRating: integer("feedback_rating"),
  feedback: text("feedback"),
}, (table) => [index("mentor_requests_mentor_status_idx").on(table.mentorId, table.status)]);

export type MentorProfile = typeof mentorProfilesTable.$inferSelect;
export type MentorRequest = typeof mentorRequestsTable.$inferSelect;
