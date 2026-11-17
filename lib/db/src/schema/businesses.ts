import { index, integer, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

export const businessesTable = pgTable("businesses", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerId: uuid("owner_id").notNull(),
  name: text("name").notNull(),
  ownerName: text("owner_name").notNull().default(""),
  category: text("category").notNull(),
  description: text("description").notNull().default(""),
  services: text("services").notNull().default(""),
  city: text("city").notNull(),
  address: text("address").notNull().default(""),
  state: text("state").notNull().default(""),
  district: text("district").notNull().default(""),
  pincode: text("pincode").notNull().default(""),
  phone: text("phone").notNull().default(""),
  email: text("email").notNull().default(""),
  contactPreference: text("contact_preference").notNull().default("message"),
  website: text("website"),
  facebook: text("facebook").notNull().default(""),
  linkedin: text("linkedin").notNull().default(""),
  instagram: text("instagram").notNull().default(""),
  xProfile: text("x_profile").notNull().default(""),
  media: text("media").notNull().default("[]"),
  priceMin: integer("price_min"),
  priceMax: integer("price_max"),
  navodayansDiscount: integer("navodayans_discount").notNull().default(0),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [index("businesses_status_city_idx").on(table.status, table.city)]);

export const businessReviewsTable = pgTable("business_reviews", {
  id: uuid("id").primaryKey().defaultRandom(),
  businessId: uuid("business_id").notNull(),
  reviewerId: uuid("reviewer_id").notNull(),
  rating: integer("rating").notNull(),
  review: text("review").notNull().default(""),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("business_reviews_business_created_idx").on(table.businessId, table.createdAt),
  uniqueIndex("business_reviews_business_reviewer_idx").on(table.businessId, table.reviewerId),
]);

export type Business = typeof businessesTable.$inferSelect;
export type BusinessReview = typeof businessReviewsTable.$inferSelect;
