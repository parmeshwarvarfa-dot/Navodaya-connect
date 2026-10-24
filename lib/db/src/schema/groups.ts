import { pgTable, text, timestamp, uuid, integer, boolean, primaryKey, uniqueIndex } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const groupsTable = pgTable("groups", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  subject: text("subject").notNull(),
  class: text("class"),
  jnvName: text("jnv_name"),
  jnvState: text("jnv_state"),
  teacherName: text("teacher_name"),
  teacherId: uuid("teacher_id"),
  clubId: uuid("club_id"),
  memberCount: integer("member_count").default(1),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [uniqueIndex("groups_club_id_unique").on(table.clubId)]);

export const groupMessagesTable = pgTable("group_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  groupId: uuid("group_id").notNull().references(() => groupsTable.id, { onDelete: "cascade" }),
  text: text("text").notNull(),
  senderName: text("sender_name"),
  senderId: uuid("sender_id"),
  role: text("role"),
  reactions: text("reactions"),
  replyToId: uuid("reply_to_id"),
  replyToText: text("reply_to_text"),
  replyToSender: text("reply_to_sender"),
  isEdited: boolean("is_edited").default(false),
  deletedAt: timestamp("deleted_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const groupMembersTable = pgTable("group_members", {
  groupId: uuid("group_id").notNull().references(() => groupsTable.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  role: text("role").notNull().default("member"),
  joinedAt: timestamp("joined_at").defaultNow(),
}, (table) => [primaryKey({ columns: [table.groupId, table.userId] })]);

export type Group = typeof groupsTable.$inferSelect;
export type GroupMessage = typeof groupMessagesTable.$inferSelect;
