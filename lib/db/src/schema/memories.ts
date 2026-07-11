import { pgTable, text, timestamp, uuid, integer } from "drizzle-orm/pg-core";

export const memoriesTable = pgTable("memories", {
  id: uuid("id").primaryKey().defaultRandom(),
  caption: text("caption"),
  imageUrl: text("image_url"),
  authorId: uuid("author_id"),
  authorName: text("author_name"),
  jnvName: text("jnv_name"),
  likes: integer("likes").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const memoryLikesTable = pgTable("memory_likes", {
  id: uuid("id").primaryKey().defaultRandom(),
  memoryId: uuid("memory_id").notNull(),
  userId: uuid("user_id").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export type Memory = typeof memoriesTable.$inferSelect;
