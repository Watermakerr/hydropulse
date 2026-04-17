const express = require('express');
const { body, param, query } = require('express-validator');

const pool = require('../db/pool');
const validate = require('../middlewares/validate');
const asyncHandler = require('../utils/asyncHandler');
const { requireAuth, requireRole } = require('../middlewares/auth');
const { sendPushToUser } = require('../services/pushService');

const router = express.Router();

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
              u.full_name AS assigned_to_name
       FROM tasks t
       JOIN reservoirs r ON r.id = t.reservoir_id
       LEFT JOIN boundary_markers m ON m.id = t.marker_id
       LEFT JOIN users u ON u.id = t.assigned_to
       WHERE ${conditions.join(' AND ')}
       ORDER BY t.created_at DESC`,
      values
    );

    return res.json({ success: true, data: result.rows });
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

    const oldTask = await pool.query('SELECT assigned_to, title FROM tasks WHERE id = $1', [id]);
    if (!oldTask.rowCount) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy task' });
    }

    const result = await pool.query(
      `UPDATE tasks
       SET title = COALESCE($1, title),
           description = COALESCE($2, description),
           status = COALESCE($3, status),
           priority = COALESCE($4, priority),
           assigned_to = CASE WHEN $5::text IS NULL THEN assigned_to ELSE $5::uuid END,
           marker_id = CASE WHEN $6::text IS NULL THEN marker_id ELSE $6::uuid END,
           due_date = CASE WHEN $7::text IS NULL THEN due_date ELSE $7::date END
       WHERE id = $8
       RETURNING *`,
      [
        title || null,
        description || null,
        status || null,
        priority || null,
        assignedTo === undefined ? null : assignedTo,
        markerId === undefined ? null : markerId,
        dueDate === undefined ? null : dueDate,
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

module.exports = router;
