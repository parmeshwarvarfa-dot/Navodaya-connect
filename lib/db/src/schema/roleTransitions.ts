import { index, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const alumniTransitionBatchesTable = pgTable("alumni_transition_batches", {
  id: uuid("id").primaryKey().defaultRandom(),
  jnvId: text("jnv_id").notNull(),
  jnvName: text("jnv_name").notNull(),
  jnvState: text("jnv_state").notNull(),
  graduationYear: text("graduation_year").notNull(),
  createdBy: uuid("created_by").notNull().references(() => usersTable.id),
  status: text("status").notNull().default("preview"),
  previewUserIds: text("preview_user_ids"),
  selectedUserIds: text("selected_user_ids"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("alumni_transition_batches_school_created_idx").on(table.jnvId, table.createdAt),
]);

export const alumniTransitionResultsTable = pgTable("alumni_transition_results", {
  id: uuid("id").primaryKey().defaultRandom(),
  batchId: uuid("batch_id").notNull().references(() => alumniTransitionBatchesTable.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => usersTable.id),
  previousRole: text("previous_role"),
  newRole: text("new_role"),
  result: text("result").notNull(),
  reason: text("reason"),
  credentialId: text("credential_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  uniqueIndex("alumni_transition_batch_user_uidx").on(table.batchId, table.userId),
  index("alumni_transition_batch_result_idx").on(table.batchId, table.result),
]);

export type AlumniTransitionBatch = typeof alumniTransitionBatchesTable.$inferSelect;
export type AlumniTransitionResult = typeof alumniTransitionResultsTable.$inferSelect;
