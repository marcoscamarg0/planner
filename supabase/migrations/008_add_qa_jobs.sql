-- Migration 008: Create qa_jobs table for background SmartRun testing
CREATE TABLE IF NOT EXISTS qa_jobs (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  job_name         TEXT NOT NULL,
  target_url       TEXT NOT NULL,
  status           TEXT NOT NULL DEFAULT 'running', -- running, completed, failed
  error_msg        TEXT,
  logs             JSONB DEFAULT '[]'::jsonb,
  report_html      TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS qa_jobs_user_id_idx ON qa_jobs (user_id, created_at DESC);

ALTER TABLE qa_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own qa_jobs"
  ON qa_jobs
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
