import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
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
  createdAt: timestamp("created_at").defaultNow(),
});

export type EventRegistration = typeof eventRegistrationsTable.$inferSelect;
