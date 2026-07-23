-- Migration 006: Fix qa_reports - add smart_runner type + ensure table exists
-- Run this in your Supabase SQL Editor

-- 1. Create table if not exists (with all types including smart_runner)
CREATE TABLE IF NOT EXISTS qa_reports (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type              TEXT        NOT NULL,
  title             TEXT        NOT NULL,
  input_description TEXT,
  framework         TEXT,
  model_used        TEXT        NOT NULL DEFAULT 'auto-free',
  result_raw        TEXT,
  result_json       JSONB,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. If table already existed with the old CHECK constraint (missing smart_runner),
--    drop the old constraint and add a new one that includes smart_runner
DO $$
DECLARE
  constraint_name text;
BEGIN
  SELECT conname INTO constraint_name
  FROM pg_constraint
  WHERE conrelid = 'public.qa_reports'::regclass
    AND contype = 'c'
    AND conname ILIKE '%type%';

  IF constraint_name IS NOT NULL THEN
    EXECUTE 'ALTER TABLE qa_reports DROP CONSTRAINT ' || quote_ident(constraint_name);
  END IF;
END;
$$;

ALTER TABLE qa_reports
  ADD CONSTRAINT qa_reports_type_check
  CHECK (type IN ('test_cases', 'test_report', 'automation', 'consolidated_report', 'smart_runner'));

-- 3. Index for fast queries per user
CREATE INDEX IF NOT EXISTS qa_reports_user_id_idx
  ON qa_reports (user_id, created_at DESC);

-- 4. Enable Row Level Security
ALTER TABLE qa_reports ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policy (drop if exists to avoid duplicate error)
DROP POLICY IF EXISTS "Users can manage their own qa_reports" ON qa_reports;

CREATE POLICY "Users can manage their own qa_reports"
  ON qa_reports
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
