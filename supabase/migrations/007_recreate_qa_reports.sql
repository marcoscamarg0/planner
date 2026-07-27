-- Migration 007: Recreate qa_reports definitively, safe for any state
-- Run this in your Supabase SQL Editor if you see PGRST205 errors

-- Drop and recreate cleanly (data loss is acceptable for fresh installs)
DROP TABLE IF EXISTS qa_reports CASCADE;

CREATE TABLE qa_reports (
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

-- Index for fast per-user queries
CREATE INDEX qa_reports_user_id_idx ON qa_reports (user_id, created_at DESC);

-- RLS
ALTER TABLE qa_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own qa_reports"
  ON qa_reports
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
