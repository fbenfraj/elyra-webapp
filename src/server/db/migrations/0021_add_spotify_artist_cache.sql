-- 0021_add_spotify_artist_cache.sql

-- Shared artist cache
CREATE TABLE IF NOT EXISTS "spotify_artists" (
  "id" text PRIMARY KEY DEFAULT gen_random_uuid(),
  "spotify_id" text NOT NULL UNIQUE,
  "name" text NOT NULL,
  "profile_image_url" text,
  "profile_r2_key" text,
  "genres" jsonb,
  "popularity" integer,
  "follower_count" integer,
  "audio_profile" jsonb,
  "fetched_at" timestamp with time zone NOT NULL DEFAULT now(),
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

-- Album covers per artist
CREATE TABLE IF NOT EXISTS "artist_albums" (
  "id" text PRIMARY KEY DEFAULT gen_random_uuid(),
  "artist_id" text NOT NULL REFERENCES "spotify_artists"("id"),
  "spotify_album_id" text NOT NULL,
  "name" text NOT NULL,
  "release_date" text NOT NULL,
  "album_type" text NOT NULL,
  "cover_image_url" text,
  "r2_key" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "artist_album_unique" UNIQUE ("artist_id", "spotify_album_id")
);

CREATE INDEX IF NOT EXISTS "artist_albums_artist_id_idx" ON "artist_albums" ("artist_id");

-- Add new columns to users (additive — keep old spotify columns)
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "artist_id" text REFERENCES "spotify_artists"("id");
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "onboarding_completed" boolean NOT NULL DEFAULT false;

-- Existing users should not be forced through onboarding
UPDATE "users" SET "onboarding_completed" = true WHERE "onboarding_completed" = false;
