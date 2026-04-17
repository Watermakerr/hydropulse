BEGIN;

-- Speed up deleting notifications by task_id during reservoir/task cleanup.
CREATE INDEX IF NOT EXISTS idx_notifications_task ON notifications(task_id);

-- Speed up listing photos by report_id.
CREATE INDEX IF NOT EXISTS idx_report_photos_report ON report_photos(report_id);

-- Speed up dashboard summary for active workers (role + is_active + not deleted).
CREATE INDEX IF NOT EXISTS idx_users_active_workers ON users(role, is_active) WHERE deleted_at IS NULL;

COMMIT;
