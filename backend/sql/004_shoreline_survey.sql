DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'shoreline_season') THEN
    CREATE TYPE shoreline_season AS ENUM ('dry', 'wet', 'normal', 'transition', 'unknown');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'shoreline_boundary_type') THEN
    CREATE TYPE shoreline_boundary_type AS ENUM ('baseline', 'scan', 'survey');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'shoreline_source') THEN
    CREATE TYPE shoreline_source AS ENUM ('gee', 'planet', 'manual', 'survey', 'import');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'survey_plan_status') THEN
    CREATE TYPE survey_plan_status AS ENUM ('draft', 'assigned', 'in_progress', 'completed', 'archived');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS shoreline_boundaries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reservoir_id UUID NOT NULL REFERENCES reservoirs(id) ON DELETE CASCADE,
  boundary_type shoreline_boundary_type NOT NULL DEFAULT 'scan',
  season shoreline_season NOT NULL DEFAULT 'unknown',
  source shoreline_source NOT NULL DEFAULT 'manual',
  capture_date DATE,
  area_m2 DOUBLE PRECISION,
  boundary GEOMETRY(POLYGON, 4326) NOT NULL,
  is_current BOOLEAN NOT NULL DEFAULT FALSE,
  metadata JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shoreline_boundaries_reservoir ON shoreline_boundaries(reservoir_id);
CREATE INDEX IF NOT EXISTS idx_shoreline_boundaries_type ON shoreline_boundaries(boundary_type);
CREATE INDEX IF NOT EXISTS idx_shoreline_boundaries_season ON shoreline_boundaries(season);
CREATE INDEX IF NOT EXISTS idx_shoreline_boundaries_current ON shoreline_boundaries(reservoir_id, is_current);
CREATE INDEX IF NOT EXISTS idx_shoreline_boundaries_geom ON shoreline_boundaries USING GIST(boundary);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_shoreline_baseline
ON shoreline_boundaries(reservoir_id, season, boundary_type)
WHERE boundary_type = 'baseline';

CREATE TABLE IF NOT EXISTS survey_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reservoir_id UUID NOT NULL REFERENCES reservoirs(id) ON DELETE CASCADE,
  title VARCHAR(200) NOT NULL,
  area TEXT,
  marker_ids UUID[],
  start_date DATE,
  end_date DATE,
  lead_user_id UUID REFERENCES users(id),
  checklist JSONB,
  status survey_plan_status NOT NULL DEFAULT 'draft',
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_survey_plans_reservoir ON survey_plans(reservoir_id);
CREATE INDEX IF NOT EXISTS idx_survey_plans_status ON survey_plans(status);
CREATE INDEX IF NOT EXISTS idx_survey_plans_dates ON survey_plans(start_date, end_date);

DROP TRIGGER IF EXISTS trg_survey_plans_updated_at ON survey_plans;
CREATE TRIGGER trg_survey_plans_updated_at
BEFORE UPDATE ON survey_plans
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS plan_id UUID REFERENCES survey_plans(id);

CREATE INDEX IF NOT EXISTS idx_tasks_plan_id ON tasks(plan_id);

ALTER TABLE satellite_analysis
  ADD COLUMN IF NOT EXISTS season shoreline_season,
  ADD COLUMN IF NOT EXISTS boundary_id UUID REFERENCES shoreline_boundaries(id),
  ADD COLUMN IF NOT EXISTS baseline_boundary_id UUID REFERENCES shoreline_boundaries(id),
  ADD COLUMN IF NOT EXISTS baseline_area_m2 DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS delta_previous_percent DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS compare_mode VARCHAR(20) DEFAULT 'seasonal';

CREATE OR REPLACE VIEW v_dashboard_summary AS
SELECT
  (SELECT COUNT(*) FROM reservoirs WHERE status = 'active') AS active_reservoirs,
  (SELECT COUNT(*) FROM boundary_markers) AS total_markers,
  (SELECT COUNT(*) FROM tasks WHERE status = 'pending') AS tasks_pending,
  (SELECT COUNT(*) FROM tasks WHERE status = 'in_progress') AS tasks_in_progress,
  (SELECT COUNT(*) FROM tasks WHERE status = 'completed') AS tasks_completed,
  (SELECT COUNT(*) FROM users WHERE role = 'worker' AND is_active = TRUE AND deleted_at IS NULL) AS active_workers,
  NOW() AS generated_at,
  (SELECT MAX(capture_date) FROM satellite_analysis) AS latest_satellite_scan,
  (SELECT alert_level FROM satellite_analysis ORDER BY capture_date DESC LIMIT 1) AS latest_alert_level;
