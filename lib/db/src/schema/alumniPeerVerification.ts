import { index, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { usersTable } from "./users";
import { verificationRequestsTable } from "./verificationRequests";

/** Durable peer decisions. Declines remain tied to their request; a confirmer
 * can confirm a person only once over the lifetime of the account pair. */
export const alumniPeerDecisionsTable = pgTable("alumni_peer_decisions", {
  id: uuid("id").primaryKey().defaultRandom(),
  requestId: uuid("request_id").notNull().references(() => verificationRequestsTable.id, { onDelete: "cascade" }),
  applicantId: uuid("applicant_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  confirmerId: uuid("confirmer_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  jnvId: text("jnv_id").notNull(),
  decision: text("decision").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  uniqueIndex("alumni_peer_decisions_request_confirmer_uidx").on(table.requestId, table.confirmerId),
  uniqueIndex("alumni_peer_decisions_confirm_once_uidx").on(table.applicantId, table.confirmerId)
    .where(sql`${table.decision} = 'confirmed'`),
  index("alumni_peer_decisions_applicant_idx").on(table.applicantId, table.createdAt),
  index("alumni_peer_decisions_school_idx").on(table.jnvId, table.createdAt),
]);

export type AlumniPeerDecision = typeof alumniPeerDecisionsTable.$inferSelect;
