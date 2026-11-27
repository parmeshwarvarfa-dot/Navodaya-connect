import { boolean, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { storeCategoriesTable, storeProductsTable } from "./storeAdmin";
import { storeOrdersTable, storeSellersTable } from "./storeCommerce";

export const storeStockMovementsTable = pgTable("store_stock_movements", {
  id: uuid("id").primaryKey().defaultRandom(),
  productId: uuid("product_id").notNull().references(() => storeProductsTable.id, { onDelete: "cascade" }),
  variantKey: text("variant_key").notNull().default(""),
  actorId: uuid("actor_id").references(() => usersTable.id, { onDelete: "set null" }),
  movementType: text("movement_type").notNull(),
  quantityDelta: integer("quantity_delta").notNull(),
  availableAfter: integer("available_after").notNull(),
  referenceType: text("reference_type"),
  referenceId: text("reference_id"),
  note: text("note"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [index("store_stock_movements_product_idx").on(table.productId, table.createdAt)]);

export const storeSubOrdersTable = pgTable("store_sub_orders", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderId: uuid("order_id").notNull().references(() => storeOrdersTable.id, { onDelete: "cascade" }),
  sellerId: uuid("seller_id").references(() => storeSellersTable.id, { onDelete: "set null" }),
  ownershipType: text("ownership_type").notNull().default("platform"),
  fulfillmentModel: text("fulfillment_model").notNull().default("platform"),
  subtotalPaise: integer("subtotal_paise").notNull(),
  shippingPaise: integer("shipping_paise").notNull().default(0),
  discountPaise: integer("discount_paise").notNull().default(0),
  commissionRateBps: integer("commission_rate_bps").notNull().default(0),
  commissionPaise: integer("commission_paise").notNull().default(0),
  sellerPayablePaise: integer("seller_payable_paise").notNull().default(0),
  payoutId: uuid("payout_id"),
  fulfillmentStatus: text("fulfillment_status").notNull().default("not_started"),
  trackingNumber: text("tracking_number"),
  carrier: text("carrier"),
  dispatchedAt: timestamp("dispatched_at"),
  deliveredAt: timestamp("delivered_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("store_sub_orders_order_idx").on(table.orderId),
  index("store_sub_orders_seller_idx").on(table.sellerId, table.createdAt),
]);

export const storePaymentsTable = pgTable("store_payments", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderId: uuid("order_id").notNull().references(() => storeOrdersTable.id, { onDelete: "cascade" }),
  gateway: text("gateway").notNull().default("razorpay"),
  gatewayOrderId: text("gateway_order_id"),
  gatewayPaymentId: text("gateway_payment_id"),
  amountPaise: integer("amount_paise").notNull(),
  currency: text("currency").notNull().default("INR"),
  status: text("status").notNull().default("pending"),
  method: text("method").notNull().default("online"),
  signatureVerified: boolean("signature_verified").notNull().default(false),
  idempotencyKey: text("idempotency_key").notNull(),
  rawPayload: jsonb("raw_payload").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  uniqueIndex("store_payments_idempotency_uq").on(table.idempotencyKey),
  index("store_payments_order_idx").on(table.orderId),
]);

export const storeCommissionRulesTable = pgTable("store_commission_rules", {
  id: uuid("id").primaryKey().defaultRandom(),
  categoryId: uuid("category_id").references(() => storeCategoriesTable.id, { onDelete: "cascade" }),
  rateBps: integer("rate_bps").notNull(),
  version: integer("version").notNull().default(1),
  active: boolean("active").notNull().default(true),
  effectiveFrom: timestamp("effective_from").notNull().defaultNow(),
  effectiveTo: timestamp("effective_to"),
  createdBy: uuid("created_by").references(() => usersTable.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [index("store_commission_rules_cat_idx").on(table.categoryId, table.active)]);

export const storePayoutBatchesTable = pgTable("store_payout_batches", {
  id: uuid("id").primaryKey().defaultRandom(),
  batchNumber: text("batch_number").notNull().unique(),
  periodStart: timestamp("period_start").notNull(),
  periodEnd: timestamp("period_end").notNull(),
  status: text("status").notNull().default("scheduled"),
  totalAmountPaise: integer("total_amount_paise").notNull().default(0),
  preparedBy: uuid("prepared_by").references(() => usersTable.id, { onDelete: "set null" }),
  approvedBy: uuid("approved_by").references(() => usersTable.id, { onDelete: "set null" }),
  executedAt: timestamp("executed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const storePayoutsTable = pgTable("store_payouts", {
  id: uuid("id").primaryKey().defaultRandom(),
  batchId: uuid("batch_id").notNull().references(() => storePayoutBatchesTable.id, { onDelete: "cascade" }),
  sellerId: uuid("seller_id").notNull().references(() => storeSellersTable.id, { onDelete: "cascade" }),
  grossPaise: integer("gross_paise").notNull(),
  commissionPaise: integer("commission_paise").notNull(),
  refundAdjustmentPaise: integer("refund_adjustment_paise").notNull().default(0),
  netPayablePaise: integer("net_payable_paise").notNull(),
  status: text("status").notNull().default("scheduled"),
  idempotencyKey: text("idempotency_key").notNull().unique(),
  paymentReference: text("payment_reference"),
  failureReason: text("failure_reason"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [index("store_payouts_seller_idx").on(table.sellerId, table.createdAt)]);

export const storeShippingRatesTable = pgTable("store_shipping_rates", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  minWeightGrams: integer("min_weight_grams").notNull().default(0),
  maxWeightGrams: integer("max_weight_grams").notNull().default(50000),
  baseRatePaise: integer("base_rate_paise").notNull(),
  perKgPaise: integer("per_kg_paise").notNull().default(0),
  freeAbovePaise: integer("free_above_paise"),
  codAllowed: boolean("cod_allowed").notNull().default(false),
  codFeePaise: integer("cod_fee_paise").notNull().default(0),
  estimatedDaysMin: integer("estimated_days_min").notNull().default(3),
  estimatedDaysMax: integer("estimated_days_max").notNull().default(7),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
