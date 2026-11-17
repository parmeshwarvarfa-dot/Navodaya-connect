import { index, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { memoriesTable } from "./memories";
import { usersTable } from "./users";

export const yearbookEntriesTable = pgTable("yearbook_entries", {
  id: uuid("id").primaryKey().defaultRandom(),
  memoryId: uuid("memory_id").notNull().references(() => memoriesTable.id, { onDelete: "cascade" }),
  submittedBy: uuid("submitted_by").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  jnvName: text("jnv_name").notNull(),
  jnvState: text("jnv_state").notNull(),
  cohortYear: text("cohort_year").notNull(),
  status: text("status").notNull().default("pending"),
  reviewedBy: uuid("reviewed_by").references(() => usersTable.id, { onDelete: "set null" }),
  reviewedAt: timestamp("reviewed_at"),
  reviewNote: text("review_note"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  uniqueIndex("yearbook_entries_memory_uidx").on(table.memoryId),
  index("yearbook_entries_school_year_status_idx").on(table.jnvState, table.jnvName, table.cohortYear, table.status),
  index("yearbook_entries_submitter_created_idx").on(table.submittedBy, table.createdAt),
]);

export type YearbookEntry = typeof yearbookEntriesTable.$inferSelect;
