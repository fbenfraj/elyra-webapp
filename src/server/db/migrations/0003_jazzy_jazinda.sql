CREATE TABLE "generation_jobs" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" text NOT NULL,
	"visual_spec_id" text NOT NULL,
	"direction_data" jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "generation_jobs" ADD CONSTRAINT "generation_jobs_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generation_jobs" ADD CONSTRAINT "generation_jobs_visual_spec_id_visual_specs_id_fk" FOREIGN KEY ("visual_spec_id") REFERENCES "public"."visual_specs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "generation_jobs_session_id_idx" ON "generation_jobs" USING btree ("session_id");