const express = require('express');

const pool = require('../db/pool');
const asyncHandler = require('../utils/asyncHandler');
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

module.exports = router;
