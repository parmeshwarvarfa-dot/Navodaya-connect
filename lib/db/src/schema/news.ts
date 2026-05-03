import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const newsTable = pgTable("news", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  category: text("category").notNull().default("General"),
  authorId: uuid("author_id"),
  authorName: text("author_name"),
  jnvName: text("jnv_name"),
  createdAt: timestamp("created_at").defaultNow(),
});

export type News = typeof newsTable.$inferSelect;
