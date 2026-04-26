import { pgTable, text, integer, timestamp, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { moodboards } from "./moodboards";

export const moodboardAnchors = pgTable(
  "moodboard_anchors",
  {
    id: text("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    moodboardId: text("moodboard_id")
      .notNull()
      .references(() => moodboards.id),
    imageKey: text("image_key").notNull(),
    sourceDirectionId: text("source_direction_id").notNull(),
    rank: integer("rank").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("moodboard_anchors_moodboard_id_idx").on(table.moodboardId),
  ]
);
