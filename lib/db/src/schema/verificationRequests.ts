import { pgTable, text, timestamp, uuid, boolean } from "drizzle-orm/pg-core";

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
  documentUrls: text("document_urls"),
  notes: text("notes"),
  infoRequest: text("info_request"),
  reviewedBy: uuid("reviewed_by"),
  reviewedByName: text("reviewed_by_name"),
  reviewedAt: timestamp("reviewed_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type VerificationRequest = typeof verificationRequestsTable.$inferSelect;
export type InsertVerificationRequest = typeof verificationRequestsTable.$inferInsert;
