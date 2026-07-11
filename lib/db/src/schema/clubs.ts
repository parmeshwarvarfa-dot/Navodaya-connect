import { pgTable, text, timestamp, uuid, integer, boolean } from "drizzle-orm/pg-core";

export const clubsTable = pgTable("clubs", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  icon: text("icon").notNull().default("star-outline"),
  color: text("color").notNull().default("#3D5AF1"),
  bg: text("bg").notNull().default("#EEF2FF"),
  members: integer("members").notNull().default(0),
  managerId: uuid("manager_id"),
  managerName: text("manager_name"),
  jnvName: text("jnv_name"),
  nextEvent: text("next_event").notNull().default("No events yet"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const clubAnnouncementsTable = pgTable("club_announcements", {
  id: uuid("id").primaryKey().defaultRandom(),
  clubId: uuid("club_id").notNull(),
  text: text("text").notNull(),
  authorId: uuid("author_id"),
  authorName: text("author_name"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const clubMembersTable = pgTable("club_members", {
  id: uuid("id").primaryKey().defaultRandom(),
  clubId: uuid("club_id").notNull(),
  userId: uuid("user_id").notNull(),
  role: text("role").notNull().default("member"),
  joinedAt: timestamp("joined_at").defaultNow(),
});

export type Club = typeof clubsTable.$inferSelect;
