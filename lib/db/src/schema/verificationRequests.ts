import { boolean, index, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { usersTable } from "./users";

export const verificationRequestsTable = pgTable("verification_requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull(),
  userFullName: text("user_full_name").notNull(),
  userEmail: text("user_email").notNull(),
  role: text("role").notNull(),
  jnvName: text("jnv_name").notNull(),
  jnvState: text("jnv_state").notNull(),
  method: text("method").notNull().default("official"),
  status: text("status").notNull().default("pending"),
  evidenceSummary: text("evidence_summary"),
  documentUrls: text("document_urls"),
  notes: text("notes"),
  infoRequest: text("info_request"),
  applicantResponse: text("applicant_response"),
  adminRecommendation: text("admin_recommendation"),
  adminNotes: text("admin_notes"),
  adminReviewedBy: uuid("admin_reviewed_by").references(() => usersTable.id),
  adminReviewedAt: timestamp("admin_reviewed_at"),
  officialNotes: text("official_notes"),
  officialReviewedBy: uuid("official_reviewed_by").references(() => usersTable.id),
  officialReviewedAt: timestamp("official_reviewed_at"),
  reviewedBy: uuid("reviewed_by"),
  reviewedByName: text("reviewed_by_name"),
  reviewedAt: timestamp("reviewed_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  uniqueIndex("verification_requests_one_open_per_user_uidx").on(table.userId)
    .where(sql`${table.status} in ('pending', 'info_requested', 'recommended_approval', 'recommended_rejection', 'awaiting_official_decision')`),
  index("verification_requests_school_status_idx").on(table.jnvName, table.status),
  index("verification_requests_user_created_idx").on(table.userId, table.createdAt),
]);

export const verificationAssignmentsTable = pgTable("verification_assignments", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  jnvId: text("jnv_id").notNull(),
  jnvName: text("jnv_name").notNull(),
  jnvState: text("jnv_state").notNull(),
  assignmentRole: text("assignment_role").notNull(),
  active: boolean("active").notNull().default(true),
  assignedBy: uuid("assigned_by").references(() => usersTable.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  uniqueIndex("verification_assignments_user_jnv_role_uidx").on(table.userId, table.jnvId, table.assignmentRole),
  index("verification_assignments_user_active_idx").on(table.userId, table.active),
  index("verification_assignments_school_role_idx").on(table.jnvId, table.assignmentRole, table.active),
]);

export const verificationAuditTable = pgTable("verification_audit", {
  id: uuid("id").primaryKey().defaultRandom(),
  requestId: uuid("request_id").references(() => verificationRequestsTable.id, { onDelete: "set null" }),
  actorId: uuid("actor_id").references(() => usersTable.id),
  subjectUserId: uuid("subject_user_id").references(() => usersTable.id),
  jnvId: text("jnv_id").notNull(),
  action: text("action").notNull(),
  fromStatus: text("from_status"),
  toStatus: text("to_status"),
  reason: text("reason"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("verification_audit_request_created_idx").on(table.requestId, table.createdAt),
  index("verification_audit_school_created_idx").on(table.jnvId, table.createdAt),
]);

export const digitalCredentialsTable = pgTable("digital_credentials", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => usersTable.id),
  credentialId: text("credential_id").notNull().unique(),
  publicToken: text("public_token").notNull().unique(),
  role: text("role").notNull(),
  jnvId: text("jnv_id").notNull(),
  jnvName: text("jnv_name").notNull(),
  jnvState: text("jnv_state").notNull(),
  status: text("status").notNull().default("active"),
  issuedBy: uuid("issued_by").notNull().references(() => usersTable.id),
  issuedAt: timestamp("issued_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  uniqueIndex("digital_credentials_one_active_user_uidx").on(table.userId).where(sql`${table.status} = 'active'`),
  index("digital_credentials_user_status_idx").on(table.userId, table.status),
]);

export type VerificationRequest = typeof verificationRequestsTable.$inferSelect;
export type InsertVerificationRequest = typeof verificationRequestsTable.$inferInsert;
