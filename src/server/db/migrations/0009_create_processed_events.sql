CREATE TABLE IF NOT EXISTS "processed_events" (
  "id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "event_key" text NOT NULL,
  "handler_name" text NOT NULL,
  "processed_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "processed_events_event_key_unique" UNIQUE("event_key")
);
