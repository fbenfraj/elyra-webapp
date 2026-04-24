import { pgTable, text, timestamp, integer, boolean, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { sessions } from "./sessions";

export const providerMetrics = pgTable(
  "provider_metrics",
  {
    id: text("id").primaryKey().default(sql`gen_random_uuid()`),
    provider: text("provider").notNull(),
    model: text("model").notNull(),
    durationMs: integer("duration_ms").notNull(),
    costCents: integer("cost_cents").notNull(),
    success: boolean("success").notNull(),
    errorType: text("error_type"),
    sessionId: text("session_id").references(() => sessions.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("provider_metrics_provider_idx").on(table.provider),
    index("provider_metrics_created_at_idx").on(table.createdAt),
  ]
);
