import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const studyMaterialsTable = pgTable("study_materials", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  subject: text("subject").notNull(),
  type: text("type").notNull().default("Notes"),
  url: text("url"),
  size: text("size"),
  authorId: uuid("author_id"),
  authorName: text("author_name"),
  jnvName: text("jnv_name"),
  targetClass: text("target_class"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const studyMaterialBookmarksTable = pgTable("study_material_bookmarks", {
  id: uuid("id").primaryKey().defaultRandom(),
  materialId: uuid("material_id").notNull(),
  userId: uuid("user_id").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export type StudyMaterial = typeof studyMaterialsTable.$inferSelect;
