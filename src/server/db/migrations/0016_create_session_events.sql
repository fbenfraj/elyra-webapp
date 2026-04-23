CREATE TABLE IF NOT EXISTS "session_events" (
  "id" text PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" text NOT NULL REFERENCES "users"("id"),
  "session_id" text NOT NULL REFERENCES "sessions"("id"),
  "action" text NOT NULL,
  "payload" jsonb,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "session_events_session_id_idx" ON "session_events" ("session_id");
CREATE INDEX IF NOT EXISTS "session_events_user_id_idx" ON "session_events" ("user_id");
CREATE INDEX IF NOT EXISTS "session_events_action_idx" ON "session_events" ("action");
ALTER TABLE "session_events" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "session_events_user_policy" ON "session_events" FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
