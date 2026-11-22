import { boolean, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const alumniMembershipPlansTable = pgTable("alumni_membership_plans", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  billingCycle: text("billing_cycle").notNull(), // "monthly" | "yearly"
  durationMonths: integer("duration_months").notNull(),
  pricePaise: integer("price_paise").notNull(),
  originalPricePaise: integer("original_price_paise"),
  features: jsonb("features").$type<string[]>().default([]),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const alumniMembershipsTable = pgTable("alumni_memberships", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => usersTable.id),
  planId: uuid("plan_id").notNull().references(() => alumniMembershipPlansTable.id),
  status: text("status").notNull().default("active"), // "active" | "expired" | "cancelled" | "pending"
  startsAt: timestamp("starts_at").notNull().defaultNow(),
  expiresAt: timestamp("expires_at").notNull(),
  renewedAt: timestamp("renewed_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const alumniMembershipPaymentsTable = pgTable("alumni_membership_payments", {
  id: uuid("id").primaryKey().defaultRandom(),
  membershipId: uuid("membership_id").notNull().references(() => alumniMembershipsTable.id),
  userId: uuid("user_id").notNull().references(() => usersTable.id),
  amountPaise: integer("amount_paise").notNull(),
  currency: text("currency").notNull().default("INR"),
  paymentMethod: text("payment_method").notNull(), // "upi" | "card" | "netbanking"
  paymentStatus: text("payment_status").notNull().default("completed"), // "completed" | "pending" | "failed" | "refunded"
  transactionRef: text("transaction_ref").notNull().unique(),
  idempotencyKey: text("idempotency_key").unique(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const alumniMembershipRefundsTable = pgTable("alumni_membership_refunds", {
  id: uuid("id").primaryKey().defaultRandom(),
  paymentId: uuid("payment_id").notNull().references(() => alumniMembershipPaymentsTable.id),
  membershipId: uuid("membership_id").notNull().references(() => alumniMembershipsTable.id),
  userId: uuid("user_id").notNull().references(() => usersTable.id),
  amountPaise: integer("amount_paise").notNull(),
  reason: text("reason").notNull(),
  status: text("status").notNull().default("processed"),
  processedBy: uuid("processed_by"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const profileAnalyticsEventsTable = pgTable(
  "profile_analytics_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    targetUserId: uuid("target_user_id").notNull().references(() => usersTable.id),
    eventType: text("event_type").notNull(), // "profile_visit" | "post_view" | "post_like" | "post_share" | "post_save"
    entityId: uuid("entity_id"),
    visitorHash: text("visitor_hash").notNull(), // Privacy-preserving salted rolling hash
    createdAt: timestamp("created_at").notNull().defaultNow(),
  }
);
