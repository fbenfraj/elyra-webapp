CREATE TABLE "palettes" (
  "id" text PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" text NOT NULL REFERENCES "users"("id"),
  "status" text NOT NULL DEFAULT 'draft',
  "step" text NOT NULL DEFAULT 'mood',
  "mood_anchor" jsonb,
  "dominant" text,
  "accent" text,
  "neutrals" jsonb,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX "palettes_user_id_unique" ON "palettes" ("user_id");
