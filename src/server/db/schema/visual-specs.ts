import "server-only";
import { pgTable, text, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { sessions } from "./sessions";

export const visualSpecs = pgTable(
  "visual_specs",
  {
    id: text("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    sessionId: text("session_id")
      .notNull()
      .references(() => sessions.id),
    specData: jsonb("spec_data").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("visual_specs_session_id_idx").on(table.sessionId)]
);
