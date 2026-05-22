const express = require('express');
const { param } = require('express-validator');

const pool = require('../db/pool');
const asyncHandler = require('../utils/asyncHandler');
const validate = require('../middlewares/validate');
const { requireAuth, requireRole } = require('../middlewares/auth');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Dashboard
 *   description: Dashboard tổng quan cho Admin
 */

/**
 * @swagger
 * /api/dashboard/summary:
 *   get:
 *     tags: [Dashboard]
 *     summary: Số liệu tổng quan
 *     security:
 *       - bearerAuth: []
 */
router.get(
  '/summary',
  requireAuth,
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const result = await pool.query('SELECT * FROM v_dashboard_summary');
    return res.json({ success: true, data: result.rows[0] || null });
  })
);

/**
 * @swagger
 * /api/dashboard/reservoir/{id}:
 *   get:
 *     tags: [Dashboard]
 *     summary: Tổng quan tình trạng hồ
 */
router.get(
  '/reservoir/:id',
  requireAuth,
  requireRole('admin'),
  [param('id').isUUID()],
  validate,
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    const base = await pool.query(
      `SELECT r.id, r.name, r.area_ha, r.status,
              (SELECT COUNT(*) FROM boundary_markers WHERE reservoir_id = r.id) AS markers_total,
              (SELECT COUNT(*) FROM boundary_markers WHERE reservoir_id = r.id AND status <> 'normal') AS markers_warning,
              (SELECT COUNT(*) FROM tasks WHERE reservoir_id = r.id) AS tasks_total,
              (SELECT COUNT(*) FROM tasks WHERE reservoir_id = r.id AND status = 'pending') AS tasks_pending,
              (SELECT COUNT(*) FROM tasks WHERE reservoir_id = r.id AND status = 'in_progress') AS tasks_in_progress,
              (SELECT COUNT(*) FROM tasks WHERE reservoir_id = r.id AND status = 'completed') AS tasks_completed,
              (SELECT COUNT(*) FROM survey_plans WHERE reservoir_id = r.id) AS plans_total
       FROM reservoirs r
       WHERE r.id = $1`,
      [id]
    );

    if (!base.rowCount) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy hồ chứa' });
    }

    const latestScan = await pool.query(
      `SELECT id, capture_date, water_surface_area, change_percentage, alert_level, season,
              baseline_area_m2, delta_previous_percent, compare_mode, boundary_id
       FROM satellite_analysis
       WHERE reservoir_id = $1
       ORDER BY capture_date DESC
       LIMIT 1`,
      [id]
    );

    const currentBoundary = await pool.query(
      `SELECT id, season, area_m2, capture_date, source,
              ST_AsGeoJSON(boundary)::json AS boundary_geojson
       FROM shoreline_boundaries
       WHERE reservoir_id = $1 AND is_current = TRUE
       ORDER BY capture_date DESC NULLS LAST, created_at DESC
       LIMIT 1`,
      [id]
    );

    return res.json({
      success: true,
      data: {
        ...base.rows[0],
        latest_scan: latestScan.rows[0] || null,
        current_boundary: currentBoundary.rows[0] || null
      }
    });
  })
);

module.exports = router;
