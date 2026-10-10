import { pgTable, text, timestamp, uuid, integer, uniqueIndex, index } from "drizzle-orm/pg-core";

export const memoryCommentsTable = pgTable("memory_comments", {
  id: uuid("id").primaryKey().defaultRandom(),
  memoryId: uuid("memory_id").notNull(),
  authorId: uuid("author_id").notNull(),
  authorName: text("author_name").notNull(),
  parentId: uuid("parent_id"),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("memory_comments_memory_created_idx").on(table.memoryId, table.createdAt),
]);

export const memoryBookmarksTable = pgTable("memory_bookmarks", {
  id: uuid("id").primaryKey().defaultRandom(),
  memoryId: uuid("memory_id").notNull(),
  userId: uuid("user_id").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  uniqueIndex("memory_bookmarks_memory_user_uidx").on(table.memoryId, table.userId),
]);

export const memoryPollVotesTable = pgTable("memory_poll_votes", {
  id: uuid("id").primaryKey().defaultRandom(),
  memoryId: uuid("memory_id").notNull(),
  userId: uuid("user_id").notNull(),
  optionIndex: integer("option_index").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  uniqueIndex("memory_poll_votes_memory_user_uidx").on(table.memoryId, table.userId),
]);

export const userFollowsTable = pgTable("user_follows", {
  id: uuid("id").primaryKey().defaultRandom(),
  followerId: uuid("follower_id").notNull(),
  followingId: uuid("following_id").notNull(),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  uniqueIndex("user_follows_pair_uidx").on(table.followerId, table.followingId),
  index("user_follows_following_status_idx").on(table.followingId, table.status),
]);

export const userBlocksTable = pgTable("user_blocks", {
  id: uuid("id").primaryKey().defaultRandom(),
  blockerId: uuid("blocker_id").notNull(),
  blockedId: uuid("blocked_id").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  uniqueIndex("user_blocks_pair_uidx").on(table.blockerId, table.blockedId),
]);

export const directConversationsTable = pgTable("direct_conversations", {
  id: uuid("id").primaryKey().defaultRandom(),
  userOneId: uuid("user_one_id").notNull(),
  userTwoId: uuid("user_two_id").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  uniqueIndex("direct_conversations_pair_uidx").on(table.userOneId, table.userTwoId),
]);

export const directMessagesTable = pgTable("direct_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  conversationId: uuid("conversation_id").notNull(),
  senderId: uuid("sender_id").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  readAt: timestamp("read_at"),
}, (table) => [
  index("direct_messages_conversation_created_idx").on(table.conversationId, table.createdAt),
]);

export const directMessageRequestsTable = pgTable("direct_message_requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  senderId: uuid("sender_id").notNull(),
  recipientId: uuid("recipient_id").notNull(),
  content: text("content").notNull(),
  status: text("status").notNull().default("pending"),
  conversationId: uuid("conversation_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("dm_requests_recipient_status_idx").on(table.recipientId, table.status),
]);

export const socialNotificationsTable = pgTable("social_notifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  recipientId: uuid("recipient_id").notNull(),
  actorId: uuid("actor_id").notNull(),
  type: text("type").notNull(),
  entityId: uuid("entity_id"),
  message: text("message").notNull(),
  readAt: timestamp("read_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("social_notifications_recipient_created_idx").on(table.recipientId, table.createdAt),
]);

export const contentReportsTable = pgTable("content_reports", {
  id: uuid("id").primaryKey().defaultRandom(),
  reporterId: uuid("reporter_id").notNull(),
  targetUserId: uuid("target_user_id"),
  memoryId: uuid("memory_id"),
  reason: text("reason").notNull(),
  details: text("details"),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
