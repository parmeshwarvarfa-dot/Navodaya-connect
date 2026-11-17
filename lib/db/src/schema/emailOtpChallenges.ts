import { integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const emailOtpChallengesTable = pgTable("email_otp_challenges", {
  email: text("email").primaryKey(),
  challengeId: text("challenge_id").notNull(),
  codeHash: text("code_hash").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  attempts: integer("attempts").notNull().default(0),
  sendCount: integer("send_count").notNull().default(1),
  windowStartedAt: timestamp("window_started_at").notNull(),
  lastSentAt: timestamp("last_sent_at").notNull(),
  verificationTokenHash: text("verification_token_hash"),
  verificationTokenExpiresAt: timestamp("verification_token_expires_at"),
  consumedAt: timestamp("consumed_at"),
});
