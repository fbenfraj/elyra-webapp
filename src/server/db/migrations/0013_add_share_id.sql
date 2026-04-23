ALTER TABLE "sessions" ADD COLUMN "share_id" text;
CREATE UNIQUE INDEX "sessions_share_id_idx" ON "sessions" USING btree ("share_id");
