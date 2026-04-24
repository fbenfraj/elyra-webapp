import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const processedEvents = pgTable("processed_events", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()`),
  eventKey: text("event_key").notNull().unique(),
  handlerName: text("handler_name").notNull(),
  processedAt: timestamp("processed_at", { withTimezone: true }).notNull().defaultNow(),
});
