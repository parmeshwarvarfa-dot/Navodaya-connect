import { pgTable, text, timestamp, uuid, integer, boolean, uniqueIndex } from "drizzle-orm/pg-core";

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

export const clubJoinRequestsTable = pgTable("club_join_requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  clubId: uuid("club_id").notNull(),
  studentId: uuid("student_id").notNull(),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at").defaultNow(),
  reviewedAt: timestamp("reviewed_at"),
  reviewedById: uuid("reviewed_by_id"),
}, (table) => [uniqueIndex("club_join_requests_club_student_unique").on(table.clubId, table.studentId)]);

export type Club = typeof clubsTable.$inferSelect;
