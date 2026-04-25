CREATE TABLE "user_references" (
  "id" text PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" text NOT NULL REFERENCES "users"("id"),
  "source" text NOT NULL,
  "r2_key" text NOT NULL,
  "original_filename" text,
  "width" integer NOT NULL,
  "height" integer NOT NULL,
  "file_size_bytes" integer NOT NULL DEFAULT 0,
  "spotify_artist_id" text REFERENCES "spotify_artists"("id"),
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX "user_references_user_id_idx" ON "user_references" ("user_id");
CREATE INDEX "user_references_spotify_artist_id_idx" ON "user_references" ("spotify_artist_id");

CREATE TABLE "session_reference_selections" (
  "session_id" text NOT NULL REFERENCES "sessions"("id"),
  "user_reference_id" text NOT NULL REFERENCES "user_references"("id"),
  "position" integer NOT NULL,
  PRIMARY KEY ("session_id", "user_reference_id")
);
