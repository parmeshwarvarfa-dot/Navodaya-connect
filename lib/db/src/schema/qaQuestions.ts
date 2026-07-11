import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const qaQuestionsTable = pgTable("qa_questions", {
  id: uuid("id").primaryKey().defaultRandom(),
  question: text("question").notNull(),
  category: text("category").notNull().default("Career"),
  askedById: uuid("asked_by_id"),
  askedByName: text("asked_by_name"),
  askedByClass: text("asked_by_class"),
  jnvName: text("jnv_name"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const qaAnswersTable = pgTable("qa_answers", {
  id: uuid("id").primaryKey().defaultRandom(),
  questionId: uuid("question_id").notNull(),
  answer: text("answer").notNull(),
  answeredById: uuid("answered_by_id"),
  answeredByName: text("answered_by_name"),
  answeredByRole: text("answered_by_role"),
  batch: text("batch"),
  subject: text("subject"),
  createdAt: timestamp("created_at").defaultNow(),
});

export type QaQuestion = typeof qaQuestionsTable.$inferSelect;
export type QaAnswer = typeof qaAnswersTable.$inferSelect;
