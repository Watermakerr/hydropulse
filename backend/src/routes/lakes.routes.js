const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const pool = require('../db/pool');
const { requireAuth } = require('../middlewares/auth');

const router = express.Router();

// Alias route to be compatible with older/mobile client expecting /api/lakes
router.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const result = await pool.query(
      `SELECT id, name, description, area_ha, status, created_by, created_at,
              CASE WHEN boundary IS NULL THEN NULL ELSE ST_AsGeoJSON(boundary)::json END AS boundary
       FROM reservoirs
       ORDER BY created_at DESC`
    );

    const formatted = result.rows.map((r) => ({
      _id: r.id,
      name: r.name,
      description: r.description,
      boundary: r.boundary || null
    }));

    return res.json({ success: true, data: formatted });
  })
);

module.exports = router;
