import { boolean, check, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { usersTable } from "./users";

export type OpportunityRole = "student" | "alumni" | "teacher" | "official";
export type OpportunityClass = "6" | "7" | "8" | "9" | "10" | "11" | "12";

export const opportunitiesTable = pgTable("opportunities", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizerId: uuid("organizer_id").notNull().references(() => usersTable.id, { onDelete: "restrict" }),
  type: text("type").notNull(),
  category: text("category").notNull(),
  title: text("title").notNull(),
  summary: text("summary").notNull().default(""),
  description: text("description").notNull().default(""),
  eligibility: text("eligibility").notNull().default(""),
  eligibleRoles: jsonb("eligible_roles").$type<OpportunityRole[]>().notNull().default(sql`'["student","alumni"]'::jsonb`),
  eligibleClasses: jsonb("eligible_classes").$type<OpportunityClass[]>().notNull().default(sql`'[]'::jsonb`),
  format: text("format").notNull().default("online"),
  participationMode: text("participation_mode").notNull().default("individual"),
  location: text("location"),
  timezone: text("timezone").notNull().default("Asia/Kolkata"),
  registrationOpensAt: timestamp("registration_opens_at", { withTimezone: true }),
  registrationDeadline: timestamp("registration_deadline", { withTimezone: true }),
  startsAt: timestamp("starts_at", { withTimezone: true }),
  endsAt: timestamp("ends_at", { withTimezone: true }),
  submissionDeadline: timestamp("submission_deadline", { withTimezone: true }),
  maxParticipants: integer("max_participants"),
  rules: text("rules").notNull().default(""),
  judgingCriteria: text("judging_criteria").notNull().default(""),
  submissionMode: text("submission_mode").notNull().default("none"),
  submissionInstructions: text("submission_instructions").notNull().default(""),
  deliveryMode: text("delivery_mode").notNull().default("internal"),
  externalProvider: text("external_provider"),
  externalUrl: text("external_url"),
  feeAmount: integer("fee_amount").notNull().default(0),
  feeDetails: text("fee_details").notNull().default(""),
  prizeDetails: text("prize_details").notNull().default(""),
  certificateType: text("certificate_type").notNull().default("none"),
  certificateDetails: text("certificate_details").notNull().default(""),
  status: text("status").notNull().default("draft"),
  resultsPublished: boolean("results_published").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  check("opportunities_type_check", sql`${table.type} IN ('quiz', 'academic_competition', 'coding_challenge', 'course', 'workshop', 'webinar', 'creative_competition', 'scholarship', 'internship', 'mentorship', 'community_challenge', 'other')`),
  check("opportunities_format_check", sql`${table.format} IN ('online', 'offline', 'hybrid')`),
  check("opportunities_participation_mode_check", sql`${table.participationMode} = 'individual'`),
  check("opportunities_submission_mode_check", sql`${table.submissionMode} IN ('none', 'text', 'link')`),
  check("opportunities_delivery_mode_check", sql`${table.deliveryMode} IN ('internal', 'external')`),
  check("opportunities_certificate_type_check", sql`${table.certificateType} IN ('none', 'external')`),
  check("opportunities_status_check", sql`${table.status} IN ('draft', 'published', 'cancelled', 'completed')`),
  check("opportunities_max_participants_check", sql`${table.maxParticipants} IS NULL OR ${table.maxParticipants} > 0`),
  check("opportunities_fee_amount_check", sql`${table.feeAmount} >= 0`),
  index("opportunities_status_deadline_idx").on(table.status, table.registrationDeadline),
  index("opportunities_organizer_created_idx").on(table.organizerId, table.createdAt),
]);

export const opportunityRegistrationsTable = pgTable("opportunity_registrations", {
  id: uuid("id").primaryKey().defaultRandom(),
  opportunityId: uuid("opportunity_id").notNull().references(() => opportunitiesTable.id, { onDelete: "cascade" }),
  participantId: uuid("participant_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  status: text("status").notNull().default("registered"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  check("opportunity_registrations_status_check", sql`${table.status} IN ('registered', 'cancelled')`),
  uniqueIndex("opportunity_registrations_member_unique_idx").on(table.opportunityId, table.participantId),
  index("opportunity_registrations_user_created_idx").on(table.participantId, table.createdAt),
]);

export const opportunitySubmissionsTable = pgTable("opportunity_submissions", {
  id: uuid("id").primaryKey().defaultRandom(),
  opportunityId: uuid("opportunity_id").notNull().references(() => opportunitiesTable.id, { onDelete: "cascade" }),
  participantId: uuid("participant_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  content: text("content").notNull().default(""),
  submissionUrl: text("submission_url"),
  status: text("status").notNull().default("submitted"),
  score: integer("score"),
  organizerFeedback: text("organizer_feedback").notNull().default(""),
  reviewedBy: uuid("reviewed_by").references(() => usersTable.id, { onDelete: "set null" }),
  submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull().defaultNow(),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  check("opportunity_submissions_score_check", sql`${table.score} IS NULL OR ${table.score} BETWEEN 0 AND 1000`),
  check("opportunity_submissions_status_check", sql`${table.status} IN ('submitted', 'reviewed', 'selected', 'not_selected')`),
  uniqueIndex("opportunity_submissions_member_unique_idx").on(table.opportunityId, table.participantId),
  index("opportunity_submissions_opportunity_idx").on(table.opportunityId, table.submittedAt),
]);

export const opportunityAuditTable = pgTable("opportunity_audit", {
  id: uuid("id").primaryKey().defaultRandom(),
  opportunityId: uuid("opportunity_id").notNull().references(() => opportunitiesTable.id, { onDelete: "cascade" }),
  actorId: uuid("actor_id").notNull().references(() => usersTable.id, { onDelete: "restrict" }),
  action: text("action").notNull(),
  details: jsonb("details").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index("opportunity_audit_history_idx").on(table.opportunityId, table.createdAt)]);

export type Opportunity = typeof opportunitiesTable.$inferSelect;
export type OpportunityRegistration = typeof opportunityRegistrationsTable.$inferSelect;
export type OpportunitySubmission = typeof opportunitySubmissionsTable.$inferSelect;
