import { boolean, index, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { memoriesTable } from "./memories";
import { usersTable } from "./users";

export const navodayanTalksTable = pgTable("navodayan_talks", {
  id: uuid("id").primaryKey().defaultRandom(),
  memoryId: uuid("memory_id").notNull().unique().references(() => memoriesTable.id, { onDelete: "cascade" }),
  authorId: uuid("author_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  submissionKey: uuid("submission_key").notNull(),
  title: text("title").notNull(),
  storyType: text("story_type").notNull(),
  category: text("category").notNull(),
  topics: jsonb("topics").$type<string[]>().notNull().default([]),
  career: text("career"),
  batch: text("batch"),
  status: text("status").notNull().default("submitted"),
  consentConfirmed: boolean("consent_confirmed").notNull().default(false),
  rightsConfirmed: boolean("rights_confirmed").notNull().default(false),
  moderatorId: uuid("moderator_id").references(() => usersTable.id, { onDelete: "set null" }),
  moderationFeedback: text("moderation_feedback"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  publishedAt: timestamp("published_at"),
}, (table) => [
  uniqueIndex("navodayan_talks_author_submission_uidx").on(table.authorId, table.submissionKey),
  index("navodayan_talks_status_created_idx").on(table.status, table.createdAt),
  index("navodayan_talks_category_idx").on(table.category),
]);

export const talkModerationAuditTable = pgTable("talk_moderation_audit", {
  id: uuid("id").primaryKey().defaultRandom(),
  talkId: uuid("talk_id").notNull().references(() => navodayanTalksTable.id, { onDelete: "cascade" }),
  moderatorId: uuid("moderator_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  action: text("action").notNull(),
  reason: text("reason").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("talk_moderation_audit_talk_created_idx").on(table.talkId, table.createdAt),
]);

export type NavodayanTalk = typeof navodayanTalksTable.$inferSelect;
