import { pgTable, text, timestamp, uuid, boolean } from "drizzle-orm/pg-core";

export const announcementsTable = pgTable("announcements", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  target: text("target").notNull().default("Whole School"),
  priority: text("priority").notNull().default("normal"),
  pinned: boolean("pinned").notNull().default(false),
  authorId: uuid("author_id"),
  authorName: text("author_name"),
  jnvName: text("jnv_name"),
  createdAt: timestamp("created_at").defaultNow(),
});

export type Announcement = typeof announcementsTable.$inferSelect;
