import { pgTable, text, timestamp, uuid, integer, boolean, primaryKey, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { usersTable } from "./users";

export const groupsTable = pgTable("groups", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  subject: text("subject").notNull(),
  groupType: text("group_type").$type<GroupType>().notNull().default("legacy"),
  createdById: uuid("created_by_id").references(() => usersTable.id, { onDelete: "set null" }),
  avatarKey: text("avatar_key"),
  avatarContentType: text("avatar_content_type"),
  adminOnlyMessages: boolean("admin_only_messages").notNull().default(false),
  class: text("class"),
  jnvName: text("jnv_name"),
  jnvState: text("jnv_state"),
  jnvId: text("jnv_id"),
  teacherName: text("teacher_name"),
  teacherId: uuid("teacher_id"),
  clubId: uuid("club_id"),
  memberCount: integer("member_count").default(1),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  uniqueIndex("groups_club_id_unique").on(table.clubId),
  uniqueIndex("groups_staff_jnv_id_uidx").on(table.jnvId).where(sql`${table.subject} = 'Staff Group'`),
]);

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

export const STAFF_GROUP_SUBJECT = "Staff Group";

export type GroupType = "user_created" | "school_managed" | "system_created" | "class_based" | "staff_managed" | "club_managed" | "legacy";

export type Group = typeof groupsTable.$inferSelect;
export type GroupMessage = typeof groupMessagesTable.$inferSelect;
