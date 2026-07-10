import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const jobsTable = pgTable("jobs", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  company: text("company").notNull(),
  location: text("location").notNull(),
  salary: text("salary"),
  type: text("type").notNull().default("Full-time"),
  category: text("category").notNull().default("Other"),
  description: text("description").notNull(),
  postedBy: uuid("posted_by"),
  postedByName: text("posted_by_name"),
  postedByJnv: text("posted_by_jnv"),
  createdAt: timestamp("created_at").defaultNow(),
});

export type Job = typeof jobsTable.$inferSelect;
