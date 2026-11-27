import { boolean, index, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { eventsTable } from "./events";

export const eventRegistrationsTable = pgTable("event_registrations", {
  id: uuid("id").primaryKey().defaultRandom(),
  eventId: uuid("event_id").notNull().references(() => eventsTable.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull(),
  role: text("role").notNull(),
  fullName: text("full_name").notNull(),
  jnvName: text("jnv_name"),
  jnvState: text("jnv_state"),
  contactNo: text("contact_no"),
  passoutBatch: text("passout_batch"),
  house: text("house"),
  class: text("class"),
  designation: text("designation"),
  subject: text("subject"),
  contribution: text("contribution"),
  feedback: text("feedback"),
  dietaryPreference: text("dietary_preference"),
  status: text("status").notNull().default("confirmed"),
  attendanceStatus: text("attendance_status").notNull().default("not_checked_in"),
  checkedInAt: timestamp("checked_in_at"),
  checkedInBy: uuid("checked_in_by"),
  cancelledAt: timestamp("cancelled_at"),
  attendingInPerson: boolean("attending_in_person").notNull().default(true),
  customAnswers: jsonb("custom_answers").$type<Record<string, string>>().notNull().default({}),
  updatedAt: timestamp("updated_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  uniqueIndex("event_registrations_event_user_uidx").on(table.eventId, table.userId),
  index("event_registrations_event_status_created_idx").on(table.eventId, table.status, table.createdAt),
  index("event_registrations_event_attendance_idx").on(table.eventId, table.attendanceStatus),
]);

export type EventRegistration = typeof eventRegistrationsTable.$inferSelect;
