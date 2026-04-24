import "server-only";
import { pgTable, text, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { users } from "./users";
import { sessions } from "./sessions";

export const sessionEvents = pgTable(
  "session_events",
  {
    id: text("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    sessionId: text("session_id")
      .notNull()
      .references(() => sessions.id),
    action: text("action").notNull(),
    payload: jsonb("payload"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("session_events_session_id_idx").on(table.sessionId),
    index("session_events_user_id_idx").on(table.userId),
    index("session_events_action_idx").on(table.action),
  ]
);
