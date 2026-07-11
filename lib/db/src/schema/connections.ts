import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const connectionsTable = pgTable("connections", {
  id: uuid("id").primaryKey().defaultRandom(),
  fromId: uuid("from_id").notNull(),
  toId: uuid("to_id").notNull(),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at").defaultNow(),
});

export type Connection = typeof connectionsTable.$inferSelect;
