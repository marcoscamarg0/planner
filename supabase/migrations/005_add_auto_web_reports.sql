-- Migration 005: Create auto_web_reports table for Auto Web generator
CREATE TABLE IF NOT EXISTS auto_web_reports (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_url       TEXT,
  source_name      TEXT NOT NULL DEFAULT 'sem nome',
  framework        TEXT NOT NULL DEFAULT 'playwright',
  model_used       TEXT NOT NULL DEFAULT 'kimi-k2',
  project_name     TEXT NOT NULL DEFAULT 'auto-test',
  description      TEXT,
  script_content   TEXT,
  package_json     JSONB,
  report_content   TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS auto_web_reports_user_id_idx ON auto_web_reports (user_id, created_at DESC);

ALTER TABLE auto_web_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own auto_web_reports"
  ON auto_web_reports
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
