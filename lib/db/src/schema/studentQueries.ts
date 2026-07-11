import { pgTable, text, timestamp, uuid, boolean } from "drizzle-orm/pg-core";

export const studentQueriesTable = pgTable("student_queries", {
  id: uuid("id").primaryKey().defaultRandom(),
  question: text("question").notNull(),
  subject: text("subject").notNull().default("General"),
  category: text("category").notNull().default("Academics"),
  studentId: uuid("student_id"),
  studentName: text("student_name"),
  studentClass: text("student_class"),
  jnvName: text("jnv_name"),
  solved: boolean("solved").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const queryAnswersTable = pgTable("query_answers", {
  id: uuid("id").primaryKey().defaultRandom(),
  queryId: uuid("query_id").notNull(),
  answer: text("answer").notNull(),
  answeredById: uuid("answered_by_id"),
  answeredByName: text("answered_by_name"),
  createdAt: timestamp("created_at").defaultNow(),
});

export type StudentQuery = typeof studentQueriesTable.$inferSelect;
export type QueryAnswer = typeof queryAnswersTable.$inferSelect;
