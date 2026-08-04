-- Migration 011: Add project_id to qa_reports

ALTER TABLE qa_reports
ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS qa_reports_project_id_idx ON qa_reports (project_id, created_at DESC);
