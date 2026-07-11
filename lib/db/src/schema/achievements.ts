import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const achievementsTable = pgTable("achievements", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  category: text("category").notNull().default("Career"),
  authorId: uuid("author_id"),
  authorName: text("author_name"),
  jnvName: text("jnv_name"),
  batch: text("batch"),
  createdAt: timestamp("created_at").defaultNow(),
});

export type Achievement = typeof achievementsTable.$inferSelect;
