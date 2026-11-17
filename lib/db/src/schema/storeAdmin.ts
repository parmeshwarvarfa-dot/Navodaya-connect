import { boolean, index, integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const storeAdminStaffTable = pgTable("store_admin_staff", {
  userId: uuid("user_id").primaryKey().references(() => usersTable.id, { onDelete: "cascade" }),
  role: text("role").notNull(),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const storeAdminSessionsTable = pgTable("store_admin_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [index("store_admin_sessions_user_idx").on(table.userId), index("store_admin_sessions_expires_idx").on(table.expiresAt)]);

export const storeCategoriesTable = pgTable("store_categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  description: text("description"),
  imageUrl: text("image_url"),
  visible: boolean("visible").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const storeProductsTable = pgTable("store_products", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  specifications: jsonb("specifications").$type<Record<string, string>>().notNull().default({}),
  images: jsonb("images").$type<string[]>().notNull().default([]),
  pricePaise: integer("price_paise").notNull(),
  discountPercent: integer("discount_percent").notNull().default(0),
  originalPricePaise: integer("original_price_paise"),
  sku: text("sku").unique(),
  brand: text("brand"),
  variants: jsonb("variants").$type<Array<{ name: string; options: Array<{ value: string; stock: number }> }>>().notNull().default([]),
  categoryId: uuid("category_id").references(() => storeCategoriesTable.id, { onDelete: "set null" }),
  stock: integer("stock").notNull().default(0),
  status: text("status").notNull().default("draft"),
  featured: boolean("featured").notNull().default(false),
  createdBy: uuid("created_by").notNull().references(() => usersTable.id),
  updatedBy: uuid("updated_by").notNull().references(() => usersTable.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const storeAdminAuditLogsTable = pgTable("store_admin_audit_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  actorId: uuid("actor_id").references(() => usersTable.id, { onDelete: "set null" }),
  actorRole: text("actor_role"),
  action: text("action").notNull(),
  targetType: text("target_type"),
  targetId: text("target_id"),
  outcome: text("outcome").notNull(),
  requestId: text("request_id"),
  details: jsonb("details").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [index("store_admin_audit_actor_idx").on(table.actorId), index("store_admin_audit_created_idx").on(table.createdAt)]);

export type StoreAdminStaff = typeof storeAdminStaffTable.$inferSelect;
export type StoreProduct = typeof storeProductsTable.$inferSelect;
export type StoreCategory = typeof storeCategoriesTable.$inferSelect;
