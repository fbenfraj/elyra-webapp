import { pgTable, text, timestamp, integer, index, unique } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { sessions } from "./sessions";
import { users } from "./users";

export const payments = pgTable(
  "payments",
  {
    id: text("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    sessionId: text("session_id")
      .notNull()
      .references(() => sessions.id),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    stripeSessionId: text("stripe_session_id").notNull(),
    amountCents: integer("amount_cents").notNull(),
    currency: text("currency").notNull(),
    status: text("status").notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("payments_session_id_idx").on(table.sessionId),
    index("payments_stripe_session_id_idx").on(table.stripeSessionId),
    unique("payments_stripe_session_id_unique").on(table.stripeSessionId),
  ]
);
