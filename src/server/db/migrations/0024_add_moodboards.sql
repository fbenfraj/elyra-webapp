CREATE TABLE "moodboards" (
  "id" text PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" text NOT NULL REFERENCES "users"("id"),
  "status" text NOT NULL DEFAULT 'generating',
  "spec" jsonb,
  "exploration_directions" jsonb,
  "liked_direction_ids" jsonb DEFAULT '[]'::jsonb,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX "moodboards_user_id_idx" ON "moodboards" ("user_id");
CREATE INDEX "moodboards_user_id_status_idx" ON "moodboards" ("user_id", "status");

CREATE TABLE "moodboard_anchors" (
  "id" text PRIMARY KEY DEFAULT gen_random_uuid(),
  "moodboard_id" text NOT NULL REFERENCES "moodboards"("id"),
  "image_key" text NOT NULL,
  "source_direction_id" text NOT NULL,
  "rank" integer NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX "moodboard_anchors_moodboard_id_idx" ON "moodboard_anchors" ("moodboard_id");
