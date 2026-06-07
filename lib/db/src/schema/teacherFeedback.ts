import { pgTable, text, timestamp, uuid, integer, boolean } from "drizzle-orm/pg-core";

export const teacherFeedbackTable = pgTable("teacher_feedback", {
  id: uuid("id").primaryKey().defaultRandom(),
  studentId: uuid("student_id").notNull(),
  studentName: text("student_name").notNull(),
  teacherId: text("teacher_id").notNull(),
  teacherName: text("teacher_name").notNull(),
  jnvName: text("jnv_name").notNull(),
  jnvState: text("jnv_state").notNull(),
  subject: text("subject"),
  rating: integer("rating").notNull(),
  comment: text("comment").notNull(),
  anonymous: boolean("anonymous").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export type TeacherFeedback = typeof teacherFeedbackTable.$inferSelect;
export type InsertTeacherFeedback = typeof teacherFeedbackTable.$inferInsert;
