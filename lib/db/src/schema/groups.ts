import { pgTable, text, timestamp, uuid, integer } from "drizzle-orm/pg-core";

export const groupsTable = pgTable("groups", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  subject: text("subject").notNull(),
  class: text("class"),
  jnvName: text("jnv_name"),
  jnvState: text("jnv_state"),
  teacherName: text("teacher_name"),
  teacherId: uuid("teacher_id"),
  memberCount: integer("member_count").default(1),
  createdAt: timestamp("created_at").defaultNow(),
});

export const groupMessagesTable = pgTable("group_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  groupId: uuid("group_id").notNull().references(() => groupsTable.id, { onDelete: "cascade" }),
  text: text("text").notNull(),
  senderName: text("sender_name"),
  senderId: uuid("sender_id"),
  role: text("role"),
  createdAt: timestamp("created_at").defaultNow(),
});

export type Group = typeof groupsTable.$inferSelect;
export type GroupMessage = typeof groupMessagesTable.$inferSelect;
