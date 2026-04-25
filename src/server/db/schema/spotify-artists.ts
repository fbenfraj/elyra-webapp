// apps/web/src/server/db/schema/spotify-artists.ts
import { pgTable, text, integer, timestamp, jsonb } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const spotifyArtists = pgTable("spotify_artists", {
  id: text("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  spotifyId: text("spotify_id").notNull().unique(),
  name: text("name").notNull(),
  profileImageUrl: text("profile_image_url"),
  profileR2Key: text("profile_r2_key"),
  genres: jsonb("genres").$type<string[]>(),
  popularity: integer("popularity"),
  followerCount: integer("follower_count"),
  audioProfile: jsonb("audio_profile").$type<{
    energy: number;
    valence: number;
    danceability: number;
    acousticness: number;
    instrumentalness: number;
    tempo: number;
    loudness: number;
  } | null>(),
  fetchedAt: timestamp("fetched_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
