import { pgTable, text, timestamp, uuid, boolean } from "drizzle-orm/pg-core";

export const problemsTable = pgTable("problems", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  category: text("category").notNull(),
  priority: text("priority").notNull().default("medium"),
  status: text("status").notNull().default("submitted"),
  anonymous: boolean("anonymous").default(false),
  submittedBy: uuid("submitted_by"),
  submittedByName: text("submitted_by_name"),
  jnvName: text("jnv_name"),
  jnvState: text("jnv_state"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const problemCommentsTable = pgTable("problem_comments", {
  id: uuid("id").primaryKey().defaultRandom(),
  problemId: uuid("problem_id").notNull().references(() => problemsTable.id, { onDelete: "cascade" }),
  text: text("text").notNull(),
  authorId: uuid("author_id"),
  authorName: text("author_name"),
  role: text("role"),
  createdAt: timestamp("created_at").defaultNow(),
});

export type Problem = typeof problemsTable.$inferSelect;
export type ProblemComment = typeof problemCommentsTable.$inferSelect;
