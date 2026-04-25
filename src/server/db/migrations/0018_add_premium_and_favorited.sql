ALTER TABLE "users" ADD COLUMN "is_premium" boolean NOT NULL DEFAULT false;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "premium_since" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "generation_attempts" ADD COLUMN "favorited" boolean NOT NULL DEFAULT false;
