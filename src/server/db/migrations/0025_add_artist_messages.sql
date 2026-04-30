CREATE TABLE "artist_messages" (
  "id" text PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" text NOT NULL REFERENCES "users"("id"),
  "inputs" jsonb NOT NULL,
  "output" jsonb NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX "artist_messages_user_id_idx" ON "artist_messages" ("user_id");
CREATE INDEX "artist_messages_user_id_created_at_idx" ON "artist_messages" ("user_id", "created_at");
