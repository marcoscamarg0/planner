-- Migration 004: Create qa_reports table for saving QA artifacts
CREATE TABLE IF NOT EXISTS qa_reports (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type        TEXT NOT NULL CHECK (type IN ('test_cases', 'test_report', 'automation', 'consolidated_report')),
  title       TEXT NOT NULL,
  input_description TEXT,
  framework   TEXT,
  model_used  TEXT NOT NULL DEFAULT 'auto-free',
  result_raw  TEXT,
  result_json JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast queries per user
CREATE INDEX IF NOT EXISTS qa_reports_user_id_idx ON qa_reports (user_id, created_at DESC);

-- Row Level Security
ALTER TABLE qa_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own qa_reports"
  ON qa_reports
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
