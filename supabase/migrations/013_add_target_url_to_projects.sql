-- Migration 013: Add target_url to projects

ALTER TABLE "public"."projects"
ADD COLUMN "target_url" text;
