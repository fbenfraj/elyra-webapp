import { pgTable, text, integer, primaryKey } from "drizzle-orm/pg-core";
import { sessions } from "./sessions";
import { userReferences } from "./user-references";

export const sessionReferenceSelections = pgTable(
  "session_reference_selections",
  {
    sessionId: text("session_id")
      .notNull()
      .references(() => sessions.id),
    userReferenceId: text("user_reference_id")
      .notNull()
      .references(() => userReferences.id),
    position: integer("position").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.sessionId, table.userReferenceId] }),
  ]
);
