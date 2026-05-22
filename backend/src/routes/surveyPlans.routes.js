const express = require('express');
const { body, param, query } = require('express-validator');

const pool = require('../db/pool');
const validate = require('../middlewares/validate');
const asyncHandler = require('../utils/asyncHandler');
const { requireAuth, requireRole } = require('../middlewares/auth');

const router = express.Router();

async function markersBelongToReservoir(markerIds, reservoirId) {
  if (!markerIds || markerIds.length === 0) {
    return true;
  }

  const result = await pool.query(
    `SELECT COUNT(*)::int AS total
     FROM boundary_markers
     WHERE reservoir_id = $1 AND id = ANY($2::uuid[])`,
    [reservoirId, markerIds]
  );

  return result.rows[0].total === markerIds.length;
}

/**
 * @swagger
 * tags:
 *   name: SurveyPlans
 *   description: Kế hoạch khảo sát cột mốc
 */

/**
 * @swagger
 * /api/survey-plans:
 *   get:
 *     tags: [SurveyPlans]
 *     summary: Danh sách kế hoạch khảo sát
 */
router.get(
  '/',
  requireAuth,
  [
    query('reservoirId').optional().isUUID(),
    query('status').optional().isIn(['draft', 'assigned', 'in_progress', 'completed', 'archived'])
  ],
  validate,
  asyncHandler(async (req, res) => {
    const conditions = ['1=1'];
    const values = [];

    if (req.query.reservoirId) {
      values.push(req.query.reservoirId);
      conditions.push(`sp.reservoir_id = $${values.length}`);
    }

    if (req.query.status) {
      values.push(req.query.status);
      conditions.push(`sp.status = $${values.length}`);
    }

    const result = await pool.query(
      `SELECT sp.*, r.name AS reservoir_name, u.full_name AS lead_name
       FROM survey_plans sp
       JOIN reservoirs r ON r.id = sp.reservoir_id
       LEFT JOIN users u ON u.id = sp.lead_user_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY sp.created_at DESC`,
      values
    );

    return res.json({ success: true, data: result.rows });
  })
);

/**
 * @swagger
 * /api/survey-plans:
 *   post:
 *     tags: [SurveyPlans]
 *     summary: Tạo kế hoạch khảo sát
 */
router.post(
  '/',
  requireAuth,
  requireRole('admin'),
  [
    body('reservoirId').isUUID(),
    body('title').isString().isLength({ min: 3 }),
    body('area').optional().isString(),
    body('markerIds').optional().isArray(),
    body('markerIds.*').optional().isUUID(),
    body('startDate').optional().isISO8601(),
    body('endDate').optional().isISO8601(),
    body('leadUserId').optional().isUUID(),
    body('checklist').optional(),
    body('status').optional().isIn(['draft', 'assigned', 'in_progress', 'completed', 'archived'])
  ],
  validate,
  asyncHandler(async (req, res) => {
    const {
      reservoirId,
      title,
      area,
      markerIds,
      startDate,
      endDate,
      leadUserId,
      checklist,
      status = 'draft'
    } = req.body;

    const cleanedMarkerIds = Array.isArray(markerIds) ? Array.from(new Set(markerIds)) : [];

    if (cleanedMarkerIds.length) {
      const valid = await markersBelongToReservoir(cleanedMarkerIds, reservoirId);
      if (!valid) {
        return res.status(400).json({ success: false, message: 'markerIds không thuộc hồ đã chọn' });
      }
    }

    let checklistValue = null;
    if (checklist !== undefined) {
      if (typeof checklist === 'string') {
        try {
          checklistValue = JSON.parse(checklist);
        } catch (error) {
          return res.status(400).json({ success: false, message: 'checklist không hợp lệ' });
        }
      } else {
        checklistValue = checklist;
      }
    }

    const result = await pool.query(
      `INSERT INTO survey_plans
        (reservoir_id, title, area, marker_ids, start_date, end_date, lead_user_id, checklist, status, created_by)
       VALUES
        ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        reservoirId,
        title,
        area || null,
        cleanedMarkerIds.length ? cleanedMarkerIds : null,
        startDate || null,
        endDate || null,
        leadUserId || null,
        checklistValue ? JSON.stringify(checklistValue) : null,
        status,
        req.user.sub
      ]
    );

    return res.status(201).json({ success: true, data: result.rows[0] });
  })
);

/**
 * @swagger
 * /api/survey-plans/{id}:
 *   get:
 *     tags: [SurveyPlans]
 *     summary: Chi tiết kế hoạch khảo sát
 */
router.get(
  '/:id',
  requireAuth,
  [param('id').isUUID()],
  validate,
  asyncHandler(async (req, res) => {
    const result = await pool.query(
      `SELECT sp.*, r.name AS reservoir_name, u.full_name AS lead_name
       FROM survey_plans sp
       JOIN reservoirs r ON r.id = sp.reservoir_id
       LEFT JOIN users u ON u.id = sp.lead_user_id
       WHERE sp.id = $1`,
      [req.params.id]
    );

    if (!result.rowCount) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy kế hoạch khảo sát' });
    }

    return res.json({ success: true, data: result.rows[0] });
  })
);

/**
 * @swagger
 * /api/survey-plans/{id}:
 *   patch:
 *     tags: [SurveyPlans]
 *     summary: Cập nhật kế hoạch khảo sát
 */
router.patch(
  '/:id',
  requireAuth,
  requireRole('admin'),
  [
    param('id').isUUID(),
    body('title').optional().isString().isLength({ min: 3 }),
    body('area').optional().isString(),
    body('markerIds').optional().isArray(),
    body('markerIds.*').optional().isUUID(),
    body('startDate').optional().isISO8601(),
    body('endDate').optional().isISO8601(),
    body('leadUserId').optional({ nullable: true }).isUUID(),
    body('checklist').optional(),
    body('status').optional().isIn(['draft', 'assigned', 'in_progress', 'completed', 'archived'])
  ],
  validate,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const {
      title,
      area,
      markerIds,
      startDate,
      endDate,
      leadUserId,
      checklist,
      status
    } = req.body;

    const existing = await pool.query('SELECT reservoir_id FROM survey_plans WHERE id = $1', [id]);
    if (!existing.rowCount) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy kế hoạch khảo sát' });
    }

    const cleanedMarkerIds = Array.isArray(markerIds) ? Array.from(new Set(markerIds)) : null;

    if (cleanedMarkerIds && cleanedMarkerIds.length) {
      const valid = await markersBelongToReservoir(cleanedMarkerIds, existing.rows[0].reservoir_id);
      if (!valid) {
        return res.status(400).json({ success: false, message: 'markerIds không thuộc hồ đã chọn' });
      }
    }

    let checklistValue = null;
    if (checklist !== undefined) {
      if (typeof checklist === 'string') {
        try {
          checklistValue = JSON.parse(checklist);
        } catch (error) {
          return res.status(400).json({ success: false, message: 'checklist không hợp lệ' });
        }
      } else {
        checklistValue = checklist;
      }
    }

    const result = await pool.query(
      `UPDATE survey_plans
       SET title = COALESCE($1, title),
           area = COALESCE($2, area),
           marker_ids = COALESCE($3, marker_ids),
           start_date = COALESCE($4, start_date),
           end_date = COALESCE($5, end_date),
           lead_user_id = COALESCE($6, lead_user_id),
           checklist = COALESCE($7, checklist),
           status = COALESCE($8, status)
       WHERE id = $9
       RETURNING *`,
      [
        title || null,
        area || null,
        cleanedMarkerIds ? cleanedMarkerIds : null,
        startDate || null,
        endDate || null,
        leadUserId === undefined ? null : leadUserId,
        checklistValue ? JSON.stringify(checklistValue) : null,
        status || null,
        id
      ]
    );

    return res.json({ success: true, data: result.rows[0] });
  })
);

module.exports = router;
