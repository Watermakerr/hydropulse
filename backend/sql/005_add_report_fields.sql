-- Add optional fields to task_reports for richer field reports
ALTER TABLE task_reports
  ADD COLUMN IF NOT EXISTS weather TEXT,
  ADD COLUMN IF NOT EXISTS water_level NUMERIC,
  ADD COLUMN IF NOT EXISTS damage_type TEXT;
