// apps/web/src/server/db/schema/artist-albums.ts
import { pgTable, text, timestamp, unique } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { spotifyArtists } from "./spotify-artists";

export const artistAlbums = pgTable(
  "artist_albums",
  {
    id: text("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    artistId: text("artist_id")
      .notNull()
      .references(() => spotifyArtists.id),
    spotifyAlbumId: text("spotify_album_id").notNull(),
    name: text("name").notNull(),
    releaseDate: text("release_date").notNull(),
    albumType: text("album_type").notNull(),
    coverImageUrl: text("cover_image_url"),
    r2Key: text("r2_key"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [unique("artist_album_unique").on(table.artistId, table.spotifyAlbumId)]
);
