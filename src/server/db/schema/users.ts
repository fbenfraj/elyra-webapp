import { pgTable, text, timestamp, boolean } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const users = pgTable("users", {
  id: text("id")
    .primaryKey()
    .default(sql`auth.uid()`),
  isPremium: boolean("is_premium").notNull().default(false),
  premiumSince: timestamp("premium_since", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  spotifyArtistId: text("spotify_artist_id"),
  spotifyArtistName: text("spotify_artist_name"),
  spotifyArtistImageUrl: text("spotify_artist_image_url"),
});
