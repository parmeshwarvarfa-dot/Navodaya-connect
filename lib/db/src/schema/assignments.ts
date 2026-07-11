import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const assignmentsTable = pgTable("assignments", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  subject: text("subject").notNull(),
  targetClass: text("target_class").notNull(),
  dueDate: text("due_date").notNull(),
  description: text("description"),
  authorId: uuid("author_id"),
  authorName: text("author_name"),
  jnvName: text("jnv_name"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const assignmentSubmissionsTable = pgTable("assignment_submissions", {
  id: uuid("id").primaryKey().defaultRandom(),
  assignmentId: uuid("assignment_id").notNull(),
  studentId: uuid("student_id").notNull(),
  studentName: text("student_name"),
  note: text("note"),
  status: text("status").notNull().default("submitted"),
  remarks: text("remarks"),
  submittedAt: timestamp("submitted_at").defaultNow(),
  reviewedAt: timestamp("reviewed_at"),
});

export type Assignment = typeof assignmentsTable.$inferSelect;
export type AssignmentSubmission = typeof assignmentSubmissionsTable.$inferSelect;
