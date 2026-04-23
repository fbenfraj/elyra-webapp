CREATE TABLE IF NOT EXISTS "provider_metrics" (
  "id" text PRIMARY KEY DEFAULT gen_random_uuid(),
  "provider" text NOT NULL,
  "model" text NOT NULL,
  "duration_ms" integer NOT NULL,
  "cost_cents" integer NOT NULL,
  "success" boolean NOT NULL,
  "error_type" text,
  "session_id" text REFERENCES "sessions"("id"),
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "provider_metrics_provider_idx" ON "provider_metrics" ("provider");
CREATE INDEX IF NOT EXISTS "provider_metrics_created_at_idx" ON "provider_metrics" ("created_at");
