import { pgTable, text, integer, timestamp, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { users } from "./users";
import { spotifyArtists } from "./spotify-artists";

export const userReferences = pgTable(
  "user_references",
  {
    id: text("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    source: text("source").notNull(), // 'upload' | 'spotify_profile' | 'spotify_cover'
    r2Key: text("r2_key").notNull(),
    originalFilename: text("original_filename"),
    width: integer("width").notNull(),
    height: integer("height").notNull(),
    fileSizeBytes: integer("file_size_bytes").notNull().default(0),
    spotifyArtistId: text("spotify_artist_id").references(() => spotifyArtists.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("user_references_user_id_idx").on(table.userId),
    index("user_references_spotify_artist_id_idx").on(table.spotifyArtistId),
  ]
);
