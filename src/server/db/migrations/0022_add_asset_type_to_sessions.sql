-- 0022_add_asset_type_to_sessions.sql

-- Add asset_type column (required, defaults to release_artwork for existing sessions)
ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "asset_type" text NOT NULL DEFAULT 'release_artwork';

-- Add user_brief column (nullable — null means user submitted empty)
ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "user_brief" text;

-- Add companion_from_session_id column (nullable FK to sessions)
ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "companion_from_session_id" text REFERENCES "sessions"("id");

-- Backfill: existing sessions always had user-written text
UPDATE "sessions" SET "user_brief" = "brief_text" WHERE "user_brief" IS NULL;
