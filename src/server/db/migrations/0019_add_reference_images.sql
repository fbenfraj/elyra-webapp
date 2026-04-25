ALTER TABLE "sessions" ADD COLUMN "spotify_artist_url" text;

CREATE TABLE "reference_images" (
  "id" text PRIMARY KEY DEFAULT gen_random_uuid(),
  "session_id" text NOT NULL REFERENCES "sessions"("id"),
  "type" text NOT NULL,
  "source" text NOT NULL,
  "source_url" text NOT NULL,
  "r2_key" text NOT NULL,
  "width" integer NOT NULL,
  "height" integer NOT NULL,
  "position" integer NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX "reference_images_session_id_idx" ON "reference_images" ("session_id");
