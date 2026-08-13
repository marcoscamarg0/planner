-- Migration 013: Add target_url to projects

ALTER TABLE "public"."projects"
ADD COLUMN IF NOT EXISTS "target_url" text;

