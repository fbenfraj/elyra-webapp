import "server-only";
import { pgTable, text, timestamp, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { users } from "./users";
import { sessions } from "./sessions";
import { generationAttempts } from "./generation-attempts";

export const feedback = pgTable(
  "feedback",
  {
    id: text("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    sessionId: text("session_id")
      .notNull()
      .references(() => sessions.id),
    generationAttemptId: text("generation_attempt_id")
      .notNull()
      .references(() => generationAttempts.id),
    action: text("action").notNull(), // 'like' or 'unlike'
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("feedback_user_id_idx").on(table.userId),
    index("feedback_session_id_idx").on(table.sessionId),
    index("feedback_generation_attempt_id_idx").on(table.generationAttemptId),
  ]
);
