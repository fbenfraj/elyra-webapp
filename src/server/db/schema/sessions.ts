import { pgTable, text, timestamp, integer, jsonb, index } from "drizzle-orm/pg-core";
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
    selectedDirectionIndex: integer("selected_direction_index"),
    selectedGenerationJobId: text("selected_generation_job_id"),
    refinementCount: integer("refinement_count").notNull().default(0),
    refinementHistory: jsonb("refinement_history"),
    regenCount: integer("regen_count").notNull().default(0),
    maxRegens: integer("max_regens").notNull().default(3),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("sessions_user_id_idx").on(table.userId)]
);
