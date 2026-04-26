import { pgTable, text, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { users } from "./users";

export const moodboards = pgTable(
  "moodboards",
  {
    id: text("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    status: text("status").notNull().default("generating"),
    spec: jsonb("spec"),
    explorationDirections: jsonb("exploration_directions"),
    likedDirectionIds: jsonb("liked_direction_ids").default(sql`'[]'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("moodboards_user_id_idx").on(table.userId),
    index("moodboards_user_id_status_idx").on(table.userId, table.status),
  ]
);
