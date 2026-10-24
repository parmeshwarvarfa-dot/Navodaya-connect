import { jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const usersTable = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  fullName: text("full_name").notNull(),
  role: text("role").notNull(),
  jnvState: text("jnv_state").notNull(),
  jnvName: text("jnv_name").notNull(),
  jnvId: text("jnv_id"),
  profileVisibility: text("profile_visibility").notNull().default("public"),
  house: text("house").notNull(),
  photoURL: text("photo_url"),
  uploadedPhotoURL: text("uploaded_photo_url"),
  avatarConfig: jsonb("avatar_config").$type<Record<string, string | number>>(),
  avatarThumbnailURL: text("avatar_thumbnail_url"),
  profileImageType: text("profile_image_type"),
  class: text("class"),
  enrollYear: text("enroll_year"),
  passoutYear: text("passout_year"),
  profession: text("profession"),
  field: text("field"),
  company: text("company"),
  skills: text("skills"),
  verificationStatus: text("verification_status").default("unverified"),
  subject: text("subject"),
  designation: text("designation"),
  bio: text("bio"),
  phone: text("phone"),
  linkedinUrl: text("linkedin_url"),
  twitterUrl: text("twitter_url"),
  createdAt: timestamp("created_at").defaultNow(),
});

export type User = typeof usersTable.$inferSelect;
export type InsertUser = typeof usersTable.$inferInsert;
