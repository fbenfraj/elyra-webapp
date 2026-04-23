CREATE TABLE IF NOT EXISTS "feedback" (
  "id" text PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" text NOT NULL REFERENCES "users"("id"),
  "session_id" text NOT NULL REFERENCES "sessions"("id"),
  "generation_attempt_id" text NOT NULL REFERENCES "generation_attempts"("id"),
  "action" text NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "feedback_user_id_idx" ON "feedback" ("user_id");
CREATE INDEX IF NOT EXISTS "feedback_session_id_idx" ON "feedback" ("session_id");
CREATE INDEX IF NOT EXISTS "feedback_generation_attempt_id_idx" ON "feedback" ("generation_attempt_id");

ALTER TABLE "feedback" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "feedback_user_policy" ON "feedback" FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
