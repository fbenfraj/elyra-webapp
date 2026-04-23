CREATE TABLE IF NOT EXISTS "generation_attempts" (
  "id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "session_id" text NOT NULL REFERENCES "sessions"("id"),
  "generation_job_id" text NOT NULL REFERENCES "generation_jobs"("id"),
  "image_key" text NOT NULL,
  "prompt_used" text NOT NULL,
  "model" text NOT NULL,
  "provider" text NOT NULL,
  "cost_cents" integer NOT NULL,
  "duration_ms" integer NOT NULL,
  "evaluation_score" real,
  "evaluation_feedback" jsonb,
  "selected" boolean NOT NULL DEFAULT false,
  "batch_number" integer NOT NULL DEFAULT 1,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "generation_attempts_session_id_idx" ON "generation_attempts" ("session_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "generation_attempts_generation_job_id_idx" ON "generation_attempts" ("generation_job_id");
