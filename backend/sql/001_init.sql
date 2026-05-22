CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    CREATE TYPE user_role AS ENUM ('admin', 'worker');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'reservoir_status') THEN
    CREATE TYPE reservoir_status AS ENUM ('active', 'inactive', 'under_review');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'marker_status') THEN
    CREATE TYPE marker_status AS ENUM ('normal', 'damaged', 'missing', 'needs_inspection');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'task_status') THEN
    CREATE TYPE task_status AS ENUM ('pending', 'in_progress', 'completed', 'cancelled');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'task_priority') THEN
    CREATE TYPE task_priority AS ENUM ('low', 'medium', 'high', 'urgent');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'condition_status') THEN
    CREATE TYPE condition_status AS ENUM ('good', 'minor_damage', 'major_damage', 'destroyed');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_platform') THEN
    CREATE TYPE app_platform AS ENUM ('web', 'mobile');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'sync_status') THEN
    CREATE TYPE sync_status AS ENUM ('pending', 'synced', 'failed');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'upload_status') THEN
    CREATE TYPE upload_status AS ENUM ('pending', 'uploaded', 'failed');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS users (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    full_name     VARCHAR(100) NOT NULL,
    email         VARCHAR(150) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role          user_role NOT NULL DEFAULT 'worker',
    is_active     BOOLEAN NOT NULL DEFAULT TRUE,
    last_login_at TIMESTAMP,
    deleted_at    TIMESTAMP,
    created_at    TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS reservoirs (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name        VARCHAR(200) NOT NULL,
    description TEXT,
    area_ha     DECIMAL(10, 2),
    boundary    GEOMETRY(POLYGON, 4326),
    status      reservoir_status NOT NULL DEFAULT 'active',
    created_by  UUID NOT NULL REFERENCES users(id),
    created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_reservoir_boundary_valid
      CHECK (boundary IS NULL OR (ST_SRID(boundary) = 4326 AND ST_IsValid(boundary)))
);
CREATE INDEX IF NOT EXISTS idx_reservoirs_boundary ON reservoirs USING GIST(boundary);

CREATE TABLE IF NOT EXISTS boundary_markers (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reservoir_id  UUID NOT NULL REFERENCES reservoirs(id) ON DELETE CASCADE,
    code          VARCHAR(50) NOT NULL UNIQUE,
    name          VARCHAR(150),
    location      GEOMETRY(POINT, 4326) NOT NULL,
    order_index   INTEGER NOT NULL DEFAULT 0,
    status        marker_status NOT NULL DEFAULT 'normal',
    created_at    TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_marker_location_valid
      CHECK (ST_SRID(location) = 4326 AND ST_IsValid(location))
);
CREATE INDEX IF NOT EXISTS idx_markers_location ON boundary_markers USING GIST(location);
CREATE INDEX IF NOT EXISTS idx_markers_reservoir ON boundary_markers(reservoir_id);

CREATE TABLE IF NOT EXISTS tasks (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reservoir_id  UUID NOT NULL REFERENCES reservoirs(id),
    marker_id     UUID REFERENCES boundary_markers(id),
    assigned_to   UUID REFERENCES users(id),
    created_by    UUID NOT NULL REFERENCES users(id),
    title         VARCHAR(200) NOT NULL,
    description   TEXT,
  template      TEXT,
    status        task_status NOT NULL DEFAULT 'pending',
    priority      task_priority NOT NULL DEFAULT 'medium',
    due_date      DATE,
    created_at    TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_reservoir ON tasks(reservoir_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks(created_at);

CREATE TABLE IF NOT EXISTS task_reports (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id          UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    worker_id        UUID NOT NULL REFERENCES users(id),
    description      TEXT,
    condition_status condition_status NOT NULL DEFAULT 'good',
  template         TEXT,
  form_data        JSONB,
    location         GEOMETRY(POINT, 4326),
    sync_status      sync_status NOT NULL DEFAULT 'pending',
    sync_error       TEXT,
    synced_at        TIMESTAMP,
    reported_at      TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_reports_task ON task_reports(task_id);
CREATE INDEX IF NOT EXISTS idx_reports_worker ON task_reports(worker_id);
CREATE INDEX IF NOT EXISTS idx_task_reports_sync_status ON task_reports(sync_status);

CREATE TABLE IF NOT EXISTS report_photos (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    report_id        UUID NOT NULL REFERENCES task_reports(id) ON DELETE CASCADE,
    url              TEXT NOT NULL,
    caption          VARCHAR(255),
    storage_provider VARCHAR(50) NOT NULL DEFAULT 'azure_blob',
    blob_path        TEXT,
    upload_status    upload_status NOT NULL DEFAULT 'pending',
    upload_error     TEXT,
    metadata         JSONB,
    taken_at         TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_report_photos_upload_status ON report_photos(upload_status);

CREATE TABLE IF NOT EXISTS notifications (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    task_id    UUID REFERENCES tasks(id),
    title      VARCHAR(200) NOT NULL,
    message    TEXT,
    is_read    BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notif_is_read ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS mobile_device_tokens (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_token TEXT NOT NULL,
  platform     VARCHAR(20) NOT NULL DEFAULT 'android',
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  last_seen_at TIMESTAMP NOT NULL DEFAULT NOW(),
  created_at   TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, device_token)
);
CREATE INDEX IF NOT EXISTS idx_mobile_device_tokens_user ON mobile_device_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_mobile_device_tokens_active ON mobile_device_tokens(user_id, is_active);

CREATE TABLE IF NOT EXISTS auth_sessions (
    id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id            UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    refresh_token_hash TEXT NOT NULL UNIQUE,
    platform           app_platform NOT NULL,
    device_info        JSONB,
    ip_address         INET,
    user_agent         TEXT,
    expires_at         TIMESTAMP NOT NULL,
    revoked_at         TIMESTAMP,
    created_at         TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_user ON auth_sessions(user_id);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash  TEXT NOT NULL UNIQUE,
    expires_at  TIMESTAMP NOT NULL,
    used_at     TIMESTAMP,
    created_at  TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_tasks_updated_at ON tasks;
CREATE TRIGGER trg_tasks_updated_at
BEFORE UPDATE ON tasks
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE FUNCTION enforce_worker_mobile_login()
RETURNS TRIGGER AS $$
DECLARE v_role user_role;
BEGIN
  SELECT role INTO v_role FROM users WHERE id = NEW.user_id;
  IF v_role = 'worker' AND NEW.platform <> 'mobile' THEN
    RAISE EXCEPTION 'Worker is only allowed to login from mobile platform';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_enforce_worker_mobile_login ON auth_sessions;
CREATE TRIGGER trg_enforce_worker_mobile_login
BEFORE INSERT ON auth_sessions
FOR EACH ROW EXECUTE FUNCTION enforce_worker_mobile_login();

CREATE OR REPLACE FUNCTION enforce_marker_inside_reservoir()
RETURNS TRIGGER AS $$
DECLARE r_boundary geometry(POLYGON, 4326);
BEGIN
  SELECT boundary INTO r_boundary
  FROM reservoirs
  WHERE id = NEW.reservoir_id;

  IF r_boundary IS NOT NULL AND NOT ST_Covers(r_boundary, NEW.location) THEN
    RAISE EXCEPTION 'Marker location must be inside reservoir boundary';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_marker_inside_reservoir ON boundary_markers;
CREATE TRIGGER trg_marker_inside_reservoir
BEFORE INSERT OR UPDATE OF location, reservoir_id ON boundary_markers
FOR EACH ROW EXECUTE FUNCTION enforce_marker_inside_reservoir();

CREATE OR REPLACE FUNCTION set_reservoir_area_ha()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.boundary IS NOT NULL THEN
    NEW.area_ha := ROUND((ST_Area(NEW.boundary::geography) / 10000.0)::numeric, 2);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_reservoir_area_ha ON reservoirs;
CREATE TRIGGER trg_reservoir_area_ha
BEFORE INSERT OR UPDATE OF boundary ON reservoirs
FOR EACH ROW EXECUTE FUNCTION set_reservoir_area_ha();

CREATE OR REPLACE FUNCTION notify_task_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.assigned_to IS NOT NULL THEN
      INSERT INTO notifications(user_id, task_id, title, message)
      VALUES (NEW.assigned_to, NEW.id, 'Nhiệm vụ mới', 'Bạn được giao nhiệm vụ: ' || NEW.title);
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.assigned_to IS DISTINCT FROM OLD.assigned_to AND NEW.assigned_to IS NOT NULL THEN
      INSERT INTO notifications(user_id, task_id, title, message)
      VALUES (NEW.assigned_to, NEW.id, 'Nhiệm vụ được phân công lại', 'Bạn được phân công nhiệm vụ: ' || NEW.title);
    END IF;

    IF NEW.status IS DISTINCT FROM OLD.status THEN
      INSERT INTO notifications(user_id, task_id, title, message)
      VALUES (NEW.created_by, NEW.id, 'Cập nhật trạng thái nhiệm vụ',
              'Nhiệm vụ "' || NEW.title || '" chuyển sang trạng thái: ' || NEW.status::text);
    END IF;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_notify_task_changes ON tasks;
CREATE TRIGGER trg_notify_task_changes
AFTER INSERT OR UPDATE OF assigned_to, status ON tasks
FOR EACH ROW EXECUTE FUNCTION notify_task_changes();

DROP VIEW IF EXISTS v_dashboard_summary CASCADE;
CREATE OR REPLACE VIEW v_dashboard_summary AS
SELECT
  (SELECT COUNT(*) FROM reservoirs WHERE status = 'active') AS active_reservoirs,
  (SELECT COUNT(*) FROM boundary_markers) AS total_markers,
  (SELECT COUNT(*) FROM tasks WHERE status = 'pending') AS tasks_pending,
  (SELECT COUNT(*) FROM tasks WHERE status = 'in_progress') AS tasks_in_progress,
  (SELECT COUNT(*) FROM tasks WHERE status = 'completed') AS tasks_completed,
  (SELECT COUNT(*) FROM users WHERE is_active = TRUE AND role = 'worker' AND deleted_at IS NULL) AS active_workers,
  NOW() AS generated_at;
