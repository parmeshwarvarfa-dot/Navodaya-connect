import { integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const eventsTable = pgTable("events", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  date: text("date").notNull(),
  location: text("location"),
  media: text("media"),
  organizer: text("organizer"),
  organizerId: uuid("organizer_id"),
  jnvName: text("jnv_name"),
  maxCapacity: integer("max_capacity"),
  registrationDeadline: timestamp("registration_deadline"),
  authorizedOrganizers: jsonb("authorized_organizers").$type<string[]>().notNull().default([]),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at").defaultNow(),
});

export type Event = typeof eventsTable.$inferSelect;
