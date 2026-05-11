-- Create table for recording worker GPS traces while performing tasks
CREATE TABLE IF NOT EXISTS task_location_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  worker_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  location GEOMETRY(POINT,4326) NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_task_location_logs_task ON task_location_logs(task_id);
CREATE INDEX IF NOT EXISTS idx_task_location_logs_worker ON task_location_logs(worker_id);
