-- Migration: Replace selected_direction_index (integer) with selected_direction_id (text)
ALTER TABLE "sessions" ADD COLUMN "selected_direction_id" text;

-- Backfill: Convert index-based selection to ID-based selection for in-flight sessions.
-- The direction ID is stored in generation_jobs.direction_data → directions[index] → id.
UPDATE "sessions" s
SET "selected_direction_id" = (
  SELECT gj.direction_data->'directions'->s.selected_direction_index->>'id'
  FROM "generation_jobs" gj
  WHERE gj.id = s.selected_generation_job_id
  LIMIT 1
)
WHERE s.selected_direction_index IS NOT NULL
  AND s.selected_generation_job_id IS NOT NULL;

ALTER TABLE "sessions" DROP COLUMN IF EXISTS "selected_direction_index";
