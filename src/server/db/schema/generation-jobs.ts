import "server-only";
import { pgTable, text, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { sessions } from "./sessions";
import { visualSpecs } from "./visual-specs";

export const generationJobs = pgTable(
  "generation_jobs",
  {
    id: text("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    sessionId: text("session_id")
      .notNull()
      .references(() => sessions.id),
    visualSpecId: text("visual_spec_id")
      .notNull()
      .references(() => visualSpecs.id),
    directionData: jsonb("direction_data").notNull(),
    status: text("status").notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("generation_jobs_session_id_idx").on(table.sessionId)]
);
