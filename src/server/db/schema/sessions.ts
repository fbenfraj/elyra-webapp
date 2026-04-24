import "server-only";
import { pgTable, text, timestamp, integer, jsonb, index, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { users } from "./users";

export const sessions = pgTable(
  "sessions",
  {
    id: text("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    briefText: text("brief_text").notNull(),
    status: text("status").notNull().default("pending"),
    failedStage: text("failed_stage"),
    selectedDirectionId: text("selected_direction_id"),
    selectedGenerationJobId: text("selected_generation_job_id"),
    refinementCount: integer("refinement_count").notNull().default(0),
    refinementHistory: jsonb("refinement_history"),
    regenCount: integer("regen_count").notNull().default(0),
    maxRegens: integer("max_regens").notNull().default(3),
    shareId: text("share_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("sessions_user_id_idx").on(table.userId),
    uniqueIndex("sessions_share_id_idx").on(table.shareId),
  ]
);
