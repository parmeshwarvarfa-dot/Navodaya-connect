import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

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
});

export type MentorRequest = typeof mentorRequestsTable.$inferSelect;
