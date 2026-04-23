ALTER TABLE "sessions" ADD COLUMN "refinement_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "refinement_history" jsonb;