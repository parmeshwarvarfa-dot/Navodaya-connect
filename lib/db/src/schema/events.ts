import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const eventsTable = pgTable("events", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  date: text("date").notNull(),
  location: text("location"),
  organizer: text("organizer"),
  organizerId: uuid("organizer_id"),
  jnvName: text("jnv_name"),
  createdAt: timestamp("created_at").defaultNow(),
});

export type Event = typeof eventsTable.$inferSelect;
