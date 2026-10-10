import { pgTable, text, timestamp, uuid, integer, boolean } from "drizzle-orm/pg-core";

export const memoriesTable = pgTable("memories", {
  id: uuid("id").primaryKey().defaultRandom(),
  caption: text("caption"),
  imageUrl: text("image_url"),
  authorId: uuid("author_id"),
  authorName: text("author_name"),
  jnvName: text("jnv_name"),
  likes: integer("likes").notNull().default(0),
  postType: text("post_type").notNull().default("text"),
  mediaUrls: text("media_urls").notNull().default("[]"),
  pollOptions: text("poll_options").notNull().default("[]"),
  visibility: text("visibility").notNull().default("public"),
  commentsEnabled: boolean("comments_enabled").notNull().default(true),
  updatedAt: timestamp("updated_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const memoryLikesTable = pgTable("memory_likes", {
  id: uuid("id").primaryKey().defaultRandom(),
  memoryId: uuid("memory_id").notNull(),
  userId: uuid("user_id").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export type Memory = typeof memoriesTable.$inferSelect;
