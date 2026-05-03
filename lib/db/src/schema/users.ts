import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const usersTable = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  fullName: text("full_name").notNull(),
  role: text("role").notNull(),
  jnvState: text("jnv_state").notNull(),
  jnvName: text("jnv_name").notNull(),
  house: text("house").notNull(),
  photoURL: text("photo_url"),
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
  createdAt: timestamp("created_at").defaultNow(),
});

export type User = typeof usersTable.$inferSelect;
export type InsertUser = typeof usersTable.$inferInsert;
