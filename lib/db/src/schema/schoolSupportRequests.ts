import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const schoolSupportRequestsTable = pgTable("school_support_requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  alumniId: uuid("alumni_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  jnvId: text("jnv_id").notNull(),
  type: text("type").notNull(),
  note: text("note").notNull().default(""),
  status: text("status").notNull().default("submitted"),
  outcome: text("outcome").notNull().default(""),
  reviewedBy: uuid("reviewed_by").references(() => usersTable.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index("school_support_requests_jnv_status_idx").on(table.jnvId, table.status, table.createdAt), index("school_support_requests_alumni_idx").on(table.alumniId, table.createdAt)]);

export type SchoolSupportRequest = typeof schoolSupportRequestsTable.$inferSelect;
