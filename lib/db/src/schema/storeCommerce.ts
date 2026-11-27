import { boolean, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { storeProductsTable } from "./storeAdmin";

export const storeCartItemsTable = pgTable("store_cart_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  productId: uuid("product_id").notNull().references(() => storeProductsTable.id, { onDelete: "cascade" }),
  variantSelection: text("variant_selection").notNull().default(""),
  quantity: integer("quantity").notNull().default(1),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [uniqueIndex("store_cart_user_product_variant_uq").on(table.userId, table.productId, table.variantSelection), index("store_cart_user_idx").on(table.userId)]);

export const storeAddressesTable = pgTable("store_addresses", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  recipientName: text("recipient_name").notNull(),
  phone: text("phone").notNull(),
  type: text("type").notNull().default("home"),
  line1: text("line1").notNull(),
  line2: text("line2"),
  city: text("city").notNull(),
  district: text("district").notNull(),
  state: text("state").notNull(),
  pincode: text("pincode").notNull(),
  instructions: text("instructions"),
  isDefault: boolean("is_default").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [index("store_addresses_user_idx").on(table.userId)]);

export const storeWishlistsTable = pgTable("store_wishlists", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  productId: uuid("product_id").notNull().references(() => storeProductsTable.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [uniqueIndex("store_wishlist_user_product_uq").on(table.userId, table.productId), index("store_wishlist_user_idx").on(table.userId)]);

export const storeOrdersTable = pgTable("store_orders", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderNumber: text("order_number").notNull().unique(),
  userId: uuid("user_id").notNull().references(() => usersTable.id),
  addressSnapshot: jsonb("address_snapshot").$type<Record<string, unknown>>().notNull(),
  subtotalPaise: integer("subtotal_paise").notNull(),
  shippingPaise: integer("shipping_paise").notNull().default(0),
  discountPaise: integer("discount_paise").notNull().default(0),
  totalPaise: integer("total_paise").notNull(),
  couponCode: text("coupon_code"),
  status: text("status").notNull().default("pending_payment"),
  paymentStatus: text("payment_status").notNull().default("pending"),
  fulfillmentStatus: text("fulfillment_status").notNull().default("not_started"),
  paymentMethod: text("payment_method").notNull().default("unselected"),
  idempotencyKey: text("idempotency_key").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [uniqueIndex("store_orders_user_idempotency_uq").on(table.userId, table.idempotencyKey), index("store_orders_user_created_idx").on(table.userId, table.createdAt)]);

export const storeOrderItemsTable = pgTable("store_order_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderId: uuid("order_id").notNull().references(() => storeOrdersTable.id, { onDelete: "cascade" }),
  subOrderId: uuid("sub_order_id"),
  sellerId: uuid("seller_id"),
  ownershipType: text("ownership_type").notNull().default("platform"),
  productId: uuid("product_id").references(() => storeProductsTable.id, { onDelete: "set null" }),
  productName: text("product_name").notNull(),
  imageUrl: text("image_url"),
  unitPricePaise: integer("unit_price_paise").notNull(),
  quantity: integer("quantity").notNull(),
  commissionPaise: integer("commission_paise").notNull().default(0),
  variantSnapshot: jsonb("variant_snapshot").$type<Record<string, string>>().notNull().default({}),
}, (table) => [index("store_order_items_order_idx").on(table.orderId)]);

export const storeOrderEventsTable = pgTable("store_order_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderId: uuid("order_id").notNull().references(() => storeOrdersTable.id, { onDelete: "cascade" }),
  actorId: uuid("actor_id").references(() => usersTable.id, { onDelete: "set null" }),
  status: text("status").notNull(),
  note: text("note"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [index("store_order_events_order_idx").on(table.orderId)]);

export const storeReviewsTable = pgTable("store_reviews", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  productId: uuid("product_id").notNull().references(() => storeProductsTable.id, { onDelete: "cascade" }),
  rating: integer("rating").notNull(),
  body: text("body").notNull().default(""),
  status: text("status").notNull().default("published"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [uniqueIndex("store_review_user_product_uq").on(table.userId, table.productId), index("store_reviews_product_idx").on(table.productId)]);

export const storeSellersTable = pgTable("store_sellers", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().unique().references(() => usersTable.id, { onDelete: "cascade" }),
  sellerType: text("seller_type").notNull().default("individual"),
  displayName: text("display_name").notNull(),
  legalName: text("legal_name"),
  businessName: text("business_name"),
  description: text("description").notNull().default(""),
  logoUrl: text("logo_url"),
  contactPhone: text("contact_phone"),
  contactEmail: text("contact_email"),
  businessAddress: jsonb("business_address").$type<Record<string, string>>().notNull().default({}),
  taxId: text("tax_id"),
  bankAccountHolder: text("bank_account_holder"),
  bankAccountLast4: text("bank_account_last4"),
  bankIfsc: text("bank_ifsc"),
  payoutAccountVerified: boolean("payout_account_verified").notNull().default(false),
  codEnabled: boolean("cod_enabled").notNull().default(false),
  intendedCategories: jsonb("intended_categories").$type<string[]>().notNull().default([]),
  agreementAcceptedAt: timestamp("agreement_accepted_at"),
  status: text("status").notNull().default("pending_review"),
  reviewNotes: text("review_notes"),
  rejectionReason: text("rejection_reason"),
  reviewedBy: uuid("reviewed_by"),
  reviewedAt: timestamp("reviewed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [index("store_sellers_status_idx").on(table.status)]);

export const storeCouponsTable = pgTable("store_coupons", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: text("code").notNull().unique(),
  discountType: text("discount_type").notNull(),
  discountValue: integer("discount_value").notNull(),
  minimumSubtotalPaise: integer("minimum_subtotal_paise").notNull().default(0),
  maximumDiscountPaise: integer("maximum_discount_paise"),
  usageLimit: integer("usage_limit"),
  usedCount: integer("used_count").notNull().default(0),
  active: boolean("active").notNull().default(false),
  startsAt: timestamp("starts_at"),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [index("store_coupons_active_idx").on(table.active)]);

export const storeReturnsTable = pgTable("store_returns", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderId: uuid("order_id").notNull().references(() => storeOrdersTable.id),
  subOrderId: uuid("sub_order_id"),
  orderItemId: uuid("order_item_id"),
  userId: uuid("user_id").notNull().references(() => usersTable.id),
  quantity: integer("quantity").notNull().default(1),
  returnType: text("return_type").notNull().default("refund"),
  reason: text("reason").notNull(),
  description: text("description").notNull().default(""),
  evidenceUrls: jsonb("evidence_urls").$type<string[]>().notNull().default([]),
  status: text("status").notNull().default("requested"),
  adminNotes: text("admin_notes"),
  inspectionOutcome: text("inspection_outcome"),
  restockEligible: boolean("restock_eligible").notNull().default(false),
  refundAmountPaise: integer("refund_amount_paise").notNull().default(0),
  refundReference: text("refund_reference"),
  reviewedBy: uuid("reviewed_by"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [index("store_returns_order_idx").on(table.orderId)]);
