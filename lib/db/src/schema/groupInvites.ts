import { pgTable, timestamp, uuid, text } from "drizzle-orm/pg-core";
import { groupsTable } from "./groups";
import { usersTable } from "./users";

export const groupInvitesTable = pgTable("group_invites", {
  id: uuid("id").primaryKey().defaultRandom(),
  groupId: uuid("group_id").notNull().references(() => groupsTable.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull().unique(),
  createdById: uuid("created_by_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at").notNull(),
});
