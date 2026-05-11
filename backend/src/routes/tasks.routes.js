const express = require('express');
const { body, param, query } = require('express-validator');

const pool = require('../db/pool');
const validate = require('../middlewares/validate');
const asyncHandler = require('../utils/asyncHandler');
const { requireAuth, requireRole } = require('../middlewares/auth');
const { sendPushToUser } = require('../services/pushService');

const router = express.Router();

async function isAssignableWorker(userId) {
  const result = await pool.query(
    `SELECT id
     FROM users
     WHERE id = $1
       AND role = 'worker'
       AND is_active = TRUE
       AND deleted_at IS NULL`,
    [userId]
  );

  return result.rowCount > 0;
}

async function markerBelongsToReservoir(markerId, reservoirId) {
  const result = await pool.query(
    `SELECT id
     FROM boundary_markers
     WHERE id = $1 AND reservoir_id = $2`,
    [markerId, reservoirId]
  );

  return result.rowCount > 0;
}

/**
 * @swagger
 * tags:
 *   name: Tasks
 *   description: Quản lý nhiệm vụ
 */

/**
 * @swagger
 * /api/tasks:
 *   get:
 *     tags: [Tasks]
 *     summary: Danh sách task
 *     parameters:
 *       - in: query
 *         name: status
 *         required: false
 *         schema:
 *           type: string
 *           enum: [pending, in_progress, completed, cancelled]
 *       - in: query
 *         name: assignedTo
 *         required: false
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: reservoirId
 *         required: false
 *         schema:
 *           type: string
 *           format: uuid
 *     security:
 *       - bearerAuth: []
 */
router.get(
  '/',
  requireAuth,
  [
    query('status').optional().isIn(['pending', 'in_progress', 'completed', 'cancelled']),
    query('assignedTo').optional().isUUID(),
    query('reservoirId').optional().isUUID()
  ],
  validate,
  asyncHandler(async (req, res) => {
    const conditions = ['1=1'];
    const values = [];

    if (req.query.status) {
      values.push(req.query.status);
      conditions.push(`t.status = $${values.length}`);
    }

    if (req.query.assignedTo) {
      values.push(req.query.assignedTo);
      conditions.push(`t.assigned_to = $${values.length}`);
    }

    if (req.query.reservoirId) {
      values.push(req.query.reservoirId);
      conditions.push(`t.reservoir_id = $${values.length}`);
    }

    if (req.user.role === 'worker') {
      values.push(req.user.sub);
      conditions.push(`t.assigned_to = $${values.length}`);
    }

    const result = await pool.query(
          `SELECT t.*, r.name AS reservoir_name, m.code AS marker_code,
            CASE WHEN m.location IS NULL THEN NULL ELSE ST_AsGeoJSON(m.location)::json END AS marker_location_geojson,
            u.full_name AS assigned_to_name
       FROM tasks t
       JOIN reservoirs r ON r.id = t.reservoir_id
       LEFT JOIN boundary_markers m ON m.id = t.marker_id
       LEFT JOIN users u ON u.id = t.assigned_to
       WHERE ${conditions.join(' AND ')}
       ORDER BY t.created_at DESC`,
      values
    );

    // Compatibility: add Mongo-like `_id` and `coordinates` fields for mobile client
    const formatted = result.rows.map((row) => {
      const coords = row.location_geojson && row.location_geojson.coordinates ? row.location_geojson.coordinates : null;
      return {
        ...row,
        _id: row.id,
        coordinates: coords,
        location: row.location_geojson || (coords ? { type: 'Point', coordinates: coords } : null)
      };
    });

    return res.json({ success: true, data: formatted });
  })
);

/**
 * @swagger
 * /api/tasks:
 *   post:
 *     tags: [Tasks]
 *     summary: Tạo task và phân công worker
 *     security:
 *       - bearerAuth: []
 */
router.post(
  '/',
  requireAuth,
  requireRole('admin'),
  [
    body('reservoirId').isUUID(),
    body('markerId').optional().isUUID(),
    body('assignedTo').optional().isUUID(),
    body('title').isString().isLength({ min: 3 }),
    body('status').optional().isIn(['pending', 'in_progress', 'completed', 'cancelled']),
    body('priority').optional().isIn(['low', 'medium', 'high', 'urgent'])
  ],
  validate,
  asyncHandler(async (req, res) => {
    const { reservoirId, markerId, assignedTo, title, description, status = 'pending', priority = 'medium', dueDate } = req.body;

    if (assignedTo) {
      const workerEligible = await isAssignableWorker(assignedTo);
      if (!workerEligible) {
        return res.status(400).json({ success: false, message: 'assignedTo phải là worker đang hoạt động' });
      }
    }

    if (markerId) {
      const markerValid = await markerBelongsToReservoir(markerId, reservoirId);
      if (!markerValid) {
        return res.status(400).json({ success: false, message: 'markerId không thuộc reservoirId đã chọn' });
      }
    }

    const result = await pool.query(
      `INSERT INTO tasks (reservoir_id, marker_id, assigned_to, created_by, title, description, status, priority, due_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [reservoirId, markerId || null, assignedTo || null, req.user.sub, title, description || null, status, priority, dueDate || null]
    );

    if (assignedTo) {
      await sendPushToUser(assignedTo, {
        title: 'Nhiệm vụ mới',
        body: `Bạn được giao nhiệm vụ: ${title}`,
        data: {
          taskId: result.rows[0].id,
          type: 'task_assigned'
        }
      });
    }

    return res.status(201).json({ success: true, data: result.rows[0] });
  })
);

/**
 * @swagger
 * /api/tasks/{id}:
 *   patch:
 *     tags: [Tasks]
 *     summary: Cập nhật task (admin)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     security:
 *       - bearerAuth: []
 */
router.patch(
  '/:id',
  requireAuth,
  requireRole('admin'),
  [
    param('id').isUUID(),
    body('title').optional().isString().isLength({ min: 3 }),
    body('description').optional().isString(),
    body('status').optional().isIn(['pending', 'in_progress', 'completed', 'cancelled']),
    body('priority').optional().isIn(['low', 'medium', 'high', 'urgent']),
    body('assignedTo').optional({ nullable: true }).isUUID(),
    body('markerId').optional({ nullable: true }).isUUID(),
    body('dueDate').optional({ nullable: true }).isISO8601()
  ],
  validate,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { title, description, status, priority, assignedTo, markerId, dueDate } = req.body;
    const hasAssignedTo = Object.prototype.hasOwnProperty.call(req.body, 'assignedTo');
    const hasMarkerId = Object.prototype.hasOwnProperty.call(req.body, 'markerId');
    const hasDueDate = Object.prototype.hasOwnProperty.call(req.body, 'dueDate');

    const oldTask = await pool.query('SELECT assigned_to, title, reservoir_id FROM tasks WHERE id = $1', [id]);
    if (!oldTask.rowCount) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy task' });
    }

    if (hasAssignedTo && assignedTo !== null) {
      const workerEligible = await isAssignableWorker(assignedTo);
      if (!workerEligible) {
        return res.status(400).json({ success: false, message: 'assignedTo phải là worker đang hoạt động' });
      }
    }

    if (hasMarkerId && markerId !== null) {
      const markerValid = await markerBelongsToReservoir(markerId, oldTask.rows[0].reservoir_id);
      if (!markerValid) {
        return res.status(400).json({ success: false, message: 'markerId không thuộc reservoir của task' });
      }
    }

    const result = await pool.query(
      `UPDATE tasks
       SET title = COALESCE($1, title),
           description = COALESCE($2, description),
           status = COALESCE($3, status),
           priority = COALESCE($4, priority),
           assigned_to = CASE WHEN $5::boolean THEN $6::uuid ELSE assigned_to END,
           marker_id = CASE WHEN $7::boolean THEN $8::uuid ELSE marker_id END,
           due_date = CASE WHEN $9::boolean THEN $10::date ELSE due_date END
       WHERE id = $11
       RETURNING *`,
      [
        title || null,
        description || null,
        status || null,
        priority || null,
        hasAssignedTo,
        assignedTo ?? null,
        hasMarkerId,
        markerId ?? null,
        hasDueDate,
        dueDate ?? null,
        id
      ]
    );

    if (!result.rowCount) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy task' });
    }

    const oldAssignedTo = oldTask.rows[0].assigned_to;
    const newAssignedTo = result.rows[0].assigned_to;
    const taskTitle = result.rows[0].title;

    if (newAssignedTo && oldAssignedTo !== newAssignedTo) {
      await sendPushToUser(newAssignedTo, {
        title: 'Nhiệm vụ được phân công',
        body: `Bạn được phân công nhiệm vụ: ${taskTitle}`,
        data: {
          taskId: result.rows[0].id,
          type: 'task_reassigned'
        }
      });
    }

    return res.json({ success: true, data: result.rows[0] });
  })
);

/**
 * @swagger
 * /api/tasks/{id}/status:
 *   patch:
 *     tags: [Tasks]
 *     summary: Cập nhật trạng thái task
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     security:
 *       - bearerAuth: []
 */
router.patch(
  '/:id/status',
  requireAuth,
  [param('id').isUUID(), body('status').isIn(['pending', 'in_progress', 'completed', 'cancelled'])],
  validate,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;

    let sql = `UPDATE tasks SET status = $1 WHERE id = $2`;
    const values = [status, id];

    if (req.user.role === 'worker') {
      sql += ` AND assigned_to = $3`;
      values.push(req.user.sub);
    }

    sql += ' RETURNING *';

    const result = await pool.query(sql, values);

    if (!result.rowCount) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy task hoặc không có quyền' });
    }

    return res.json({ success: true, data: result.rows[0] });
  })
);

/**
 * Worker accepts assigned task
 */
router.post(
  '/:id/accept',
  requireAuth,
  requireRole('worker'),
  [param('id').isUUID()],
  validate,
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    // ensure task assigned to this worker
    const allowed = await pool.query('SELECT id FROM tasks WHERE id = $1 AND assigned_to = $2', [id, req.user.sub]);
    if (!allowed.rowCount) {
      return res.status(403).json({ success: false, message: 'Không có quyền chấp nhận task này' });
    }

    const result = await pool.query(
      `UPDATE tasks SET status = 'in_progress' WHERE id = $1 AND assigned_to = $2 RETURNING *`,
      [id, req.user.sub]
    );

    if (!result.rowCount) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy task hoặc không có quyền' });
    }

    return res.json({ success: true, data: result.rows[0] });
  })
);

/**
 * Worker declines assigned task (unassign)
 */
router.post(
  '/:id/decline',
  requireAuth,
  requireRole('worker'),
  [param('id').isUUID()],
  validate,
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    const allowed = await pool.query('SELECT id FROM tasks WHERE id = $1 AND assigned_to = $2', [id, req.user.sub]);
    if (!allowed.rowCount) {
      return res.status(403).json({ success: false, message: 'Không có quyền từ chối task này' });
    }

    const result = await pool.query(
      `UPDATE tasks SET assigned_to = NULL, status = 'pending' WHERE id = $1 AND assigned_to = $2 RETURNING *`,
      [id, req.user.sub]
    );

    if (!result.rowCount) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy task hoặc không có quyền' });
    }

    return res.json({ success: true, data: result.rows[0] });
  })
);

/**
 * Get location logs for a task (admin or assigned worker can view)
 */
router.get(
  '/:id/location-logs',
  requireAuth,
  [param('id').isUUID()],
  validate,
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    // Admin can view all tasks, worker can only view their assigned task
    if (req.user.role === 'worker') {
      const allowed = await pool.query('SELECT id FROM tasks WHERE id = $1 AND assigned_to = $2', [id, req.user.sub]);
      if (!allowed.rowCount) {
        return res.status(403).json({ success: false, message: 'Không có quyền xem vị trí cho task này' });
      }
    }

    const result = await pool.query(
      `SELECT id, task_id, worker_id, recorded_at, ST_AsGeoJSON(location)::json AS location_geojson
       FROM task_location_logs
       WHERE task_id = $1
       ORDER BY recorded_at ASC`,
      [id]
    );

    return res.json({ success: true, data: result.rows });
  })
);

/**
 * Worker posts location logs for a task (single point)
 */
router.post(
  '/:id/location',
  requireAuth,
  requireRole('worker'),
  [param('id').isUUID(), body('lat').isFloat(), body('lng').isFloat(), body('recordedAt').optional().isISO8601()],
  validate,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { lat, lng, recordedAt } = req.body;

    // ensure worker is assigned to the task
    const allowed = await pool.query('SELECT id FROM tasks WHERE id = $1 AND assigned_to = $2', [id, req.user.sub]);
    if (!allowed.rowCount) {
      return res.status(403).json({ success: false, message: 'Không có quyền gửi vị trí cho task này' });
    }

    const result = await pool.query(
      `INSERT INTO task_location_logs (task_id, worker_id, location, recorded_at)
       VALUES ($1, $2, ST_SetSRID(ST_MakePoint($3, $4), 4326), COALESCE($5, NOW()))
       RETURNING *`,
      [id, req.user.sub, lng, lat, recordedAt ? recordedAt : null]
    );

    return res.status(201).json({ success: true, data: result.rows[0] });
  })
);

module.exports = router;

