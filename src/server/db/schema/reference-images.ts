import { pgTable, text, integer, timestamp, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { sessions } from "./sessions";

export const referenceImages = pgTable(
  "reference_images",
  {
    id: text("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    sessionId: text("session_id")
      .notNull()
      .references(() => sessions.id),
    type: text("type").notNull(), // 'profile' | 'cover'
    source: text("source").notNull(), // 'spotify'
    sourceUrl: text("source_url").notNull(),
    r2Key: text("r2_key").notNull(),
    width: integer("width").notNull(),
    height: integer("height").notNull(),
    position: integer("position").notNull(), // 0=profile, 1=primary cover, 2+=secondary covers
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("reference_images_session_id_idx").on(table.sessionId)]
);
