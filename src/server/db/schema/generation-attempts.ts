import {
  pgTable,
  text,
  timestamp,
  integer,
  real,
  boolean,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { sessions } from "./sessions";
import { generationJobs } from "./generation-jobs";

export const generationAttempts = pgTable(
  "generation_attempts",
  {
    id: text("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    sessionId: text("session_id")
      .notNull()
      .references(() => sessions.id),
    generationJobId: text("generation_job_id")
      .notNull()
      .references(() => generationJobs.id),
    imageKey: text("image_key").notNull(),
    promptUsed: text("prompt_used").notNull(),
    model: text("model").notNull(),
    provider: text("provider").notNull(),
    costCents: integer("cost_cents").notNull(),
    durationMs: integer("duration_ms").notNull(),
    evaluationScore: real("evaluation_score"),
    evaluationFeedback: jsonb("evaluation_feedback"),
    selected: boolean("selected").notNull().default(false),
    batchNumber: integer("batch_number").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("generation_attempts_session_id_idx").on(table.sessionId),
    index("generation_attempts_generation_job_id_idx").on(
      table.generationJobId
    ),
  ]
);
