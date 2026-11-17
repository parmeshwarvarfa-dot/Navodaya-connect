import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const bloodRequestsTable = pgTable("blood_requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerId: uuid("owner_id").notNull(),
  bloodGroup: text("blood_group").notNull(),
  hospital: text("hospital").notNull(),
  city: text("city").notNull(),
  requiredAt: timestamp("required_at", { withTimezone: true }).notNull(),
  urgency: text("urgency").notNull().default("normal"),
  notes: text("notes").notNull().default(""),
  responseMethod: text("response_method").notNull().default("message"),
  status: text("status").notNull().default("open"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [index("blood_requests_status_city_group_idx").on(table.status, table.city, table.bloodGroup)]);

export const bloodRequestResponsesTable = pgTable("blood_request_responses", {
  id: uuid("id").primaryKey().defaultRandom(),
  requestId: uuid("request_id").notNull(),
  responderId: uuid("responder_id").notNull(),
  message: text("message").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [index("blood_request_responses_request_idx").on(table.requestId, table.createdAt)]);

export type BloodRequest = typeof bloodRequestsTable.$inferSelect;
