import { index, pgTable, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { opportunitiesTable } from "./opportunities";

export const opportunityBookmarksTable = pgTable("opportunity_bookmarks", {
  id: uuid("id").primaryKey().defaultRandom(),
  opportunityId: uuid("opportunity_id").notNull().references(() => opportunitiesTable.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [uniqueIndex("opportunity_bookmarks_member_unique_idx").on(table.opportunityId, table.userId), index("opportunity_bookmarks_user_idx").on(table.userId, table.createdAt)]);

export type OpportunityBookmark = typeof opportunityBookmarksTable.$inferSelect;
