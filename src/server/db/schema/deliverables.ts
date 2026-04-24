import "server-only";
import {
  pgTable,
  text,
  timestamp,
  integer,
  index,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { sessions } from "./sessions";

export const deliverables = pgTable(
  "deliverables",
  {
    id: text("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    sessionId: text("session_id")
      .notNull()
      .references(() => sessions.id),
    format: text("format").notNull(),
    fileKey: text("file_key").notNull(),
    fileSizeBytes: integer("file_size_bytes").notNull(),
    width: integer("width"),
    height: integer("height"),
    mimeType: text("mime_type").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("deliverables_session_id_idx").on(table.sessionId)]
);
