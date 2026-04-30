import { pgTable, text, timestamp, jsonb, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { users } from "./users";

export const palettes = pgTable(
  "palettes",
  {
    id: text("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    status: text("status").notNull().default("draft"),
    step: text("step").notNull().default("mood"),
    moodAnchor: jsonb("mood_anchor"),
    dominant: text("dominant"),
    accent: text("accent"),
    neutrals: jsonb("neutrals"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [uniqueIndex("palettes_user_id_unique").on(table.userId)]
);
