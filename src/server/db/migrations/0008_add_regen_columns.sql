ALTER TABLE "sessions" ADD COLUMN "regen_count" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "max_regens" integer DEFAULT 3 NOT NULL;
