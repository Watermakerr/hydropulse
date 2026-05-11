const express = require('express');
const multer = require('multer');
const { body, param, query } = require('express-validator');

const pool = require('../db/pool');
const validate = require('../middlewares/validate');
const asyncHandler = require('../utils/asyncHandler');
const { requireAuth, requireRole } = require('../middlewares/auth');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

function normalizeGeoJsonToPolygon(geojson) {
  if (!geojson) {
    return null;
  }

  if (geojson.type === 'Polygon') {
    return geojson;
  }

  if (geojson.type === 'Feature' && geojson.geometry?.type === 'Polygon') {
    return geojson.geometry;
  }

  if (geojson.type === 'FeatureCollection' && Array.isArray(geojson.features)) {
    const polygonFeature = geojson.features.find((f) => f?.geometry?.type === 'Polygon');
    if (polygonFeature) {
      return polygonFeature.geometry;
    }
  }

  throw new Error('GeoJSON file must contain a Polygon geometry');
}

function extractBoundaryInput(req) {
  if (req.file) {
    const text = req.file.buffer.toString('utf-8');
    const parsed = JSON.parse(text);
    return JSON.stringify(normalizeGeoJsonToPolygon(parsed));
  }

  if (req.body.boundaryGeoJSON === undefined || req.body.boundaryGeoJSON === null || req.body.boundaryGeoJSON === '') {
    return null;
  }

  if (typeof req.body.boundaryGeoJSON === 'string') {
    const parsed = JSON.parse(req.body.boundaryGeoJSON);
    return JSON.stringify(normalizeGeoJsonToPolygon(parsed));
  }

  return JSON.stringify(normalizeGeoJsonToPolygon(req.body.boundaryGeoJSON));
}

/**
 * @swagger
 * tags:
 *   name: Reservoirs
 *   description: Quản lý hồ chứa và cột mốc
 */

/**
 * @swagger
 * /api/reservoirs:
 *   get:
 *     tags: [Reservoirs]
 *     summary: Danh sách hồ chứa
 *     parameters:
 *       - in: query
 *         name: status
 *         required: false
 *         schema:
 *           type: string
 *           enum: [active, inactive, under_review]
 *     security:
 *       - bearerAuth: []
 */
router.get(
  '/',
  requireAuth,
  [query('status').optional().isIn(['active', 'inactive', 'under_review'])],
  validate,
  asyncHandler(async (req, res) => {
    const values = [];
    let whereClause = '';

    if (req.query.status) {
      values.push(req.query.status);
      whereClause = `WHERE status = $${values.length}`;
    }

    const result = await pool.query(
      `SELECT id, name, description, area_ha, status, created_by, created_at,
              CASE WHEN boundary IS NULL THEN NULL ELSE ST_AsGeoJSON(boundary)::json END AS boundary_geojson
       FROM reservoirs
       ${whereClause}
       ORDER BY created_at DESC`,
      values
    );

    // Compatibility: include Mongo-like shape expected by older mobile app
    const formatted = result.rows.map((r) => ({
      ...r,
      _id: r.id,
      boundary: r.boundary_geojson || null
    }));

    return res.json({ success: true, data: formatted });
  })
);

/**
 * @swagger
 * /api/reservoirs:
 *   post:
 *     tags: [Reservoirs]
 *     summary: Tạo hồ chứa mới
 *     security:
 *       - bearerAuth: []
 */
router.post(
  '/',
  requireAuth,
  requireRole('admin'),
  upload.single('geojsonFile'),
  [body('name').isString().isLength({ min: 2 })],
  validate,
  asyncHandler(async (req, res) => {
    const { name, description, status = 'active' } = req.body;
    const boundaryInput = extractBoundaryInput(req);

    const result = await pool.query(
      `INSERT INTO reservoirs (name, description, boundary, status, created_by)
       VALUES ($1, $2, CASE WHEN $3::text IS NULL THEN NULL ELSE ST_SetSRID(ST_GeomFromGeoJSON($3),4326) END, $4, $5)
       RETURNING id, name, description, area_ha, status, created_by, created_at,
                 CASE WHEN boundary IS NULL THEN NULL ELSE ST_AsGeoJSON(boundary)::json END AS boundary_geojson`,
      [name, description || null, boundaryInput, status, req.user.sub]
    );

    return res.status(201).json({ success: true, data: result.rows[0] });
  })
);

/**
 * @swagger
 * /api/reservoirs/{id}:
 *   patch:
 *     tags: [Reservoirs]
 *     summary: Cập nhật hồ chứa
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
  upload.single('geojsonFile'),
  [
    param('id').isUUID(),
    body('name').optional().isString().isLength({ min: 2 }),
    body('status').optional().isIn(['active', 'inactive', 'under_review'])
  ],
  validate,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { name, description, status } = req.body;
    const boundaryInput = extractBoundaryInput(req);

    const result = await pool.query(
      `UPDATE reservoirs
       SET name = COALESCE($1, name),
           description = COALESCE($2, description),
           status = COALESCE($3, status),
           boundary = CASE WHEN $4::text IS NULL THEN boundary ELSE ST_SetSRID(ST_GeomFromGeoJSON($4),4326) END
       WHERE id = $5
       RETURNING id, name, description, area_ha, status, created_by, created_at,
                 CASE WHEN boundary IS NULL THEN NULL ELSE ST_AsGeoJSON(boundary)::json END AS boundary_geojson`,
      [name || null, description || null, status || null, boundaryInput, id]
    );

    if (!result.rowCount) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy hồ chứa' });
    }

    return res.json({ success: true, data: result.rows[0] });
  })
);

/**
 * @swagger
 * /api/reservoirs/{id}:
 *   delete:
 *     tags: [Reservoirs]
 *     summary: Xóa hồ chứa
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
router.delete(
  '/:id',
  requireAuth,
  requireRole('admin'),
  [param('id').isUUID()],
  validate,
  asyncHandler(async (req, res) => {
    const client = await pool.connect();
    let result;

    try {
      await client.query('BEGIN');

      const taskIds = await client.query('SELECT id FROM tasks WHERE reservoir_id = $1', [req.params.id]);
      const ids = taskIds.rows.map((row) => row.id);

      if (ids.length) {
        await client.query('DELETE FROM notifications WHERE task_id = ANY($1::uuid[])', [ids]);
      }

      await client.query('DELETE FROM tasks WHERE reservoir_id = $1', [req.params.id]);
      result = await client.query('DELETE FROM reservoirs WHERE id = $1 RETURNING id', [req.params.id]);

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    if (!result.rowCount) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy hồ chứa' });
    }

    return res.json({ success: true, message: 'Xóa hồ chứa thành công' });
  })
);

/**
 * @swagger
 * /api/reservoirs/{id}/markers:
 *   get:
 *     tags: [Reservoirs]
 *     summary: Danh sách cột mốc của hồ chứa
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
router.get(
  '/:id/markers',
  requireAuth,
  [param('id').isUUID()],
  validate,
  asyncHandler(async (req, res) => {
    const result = await pool.query(
      `SELECT id, reservoir_id, code, name, order_index, status, created_at,
              ST_AsGeoJSON(location)::json AS location_geojson
       FROM boundary_markers
       WHERE reservoir_id = $1
       ORDER BY order_index ASC, created_at ASC`,
      [req.params.id]
    );

    return res.json({ success: true, data: result.rows });
  })
);

/**
 * @swagger
 * /api/reservoirs/{id}/markers:
 *   post:
 *     tags: [Reservoirs]
 *     summary: Tạo cột mốc
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
router.post(
  '/:id/markers',
  requireAuth,
  requireRole('admin'),
  [
    param('id').isUUID(),
    body('code').isString().isLength({ min: 2 }),
    body('locationGeoJSON').isObject(),
    body('status').optional().isIn(['normal', 'damaged', 'missing', 'needs_inspection'])
  ],
  validate,
  asyncHandler(async (req, res) => {
    const { code, name, orderIndex = 0, status = 'normal', locationGeoJSON } = req.body;

    const result = await pool.query(
      `INSERT INTO boundary_markers (reservoir_id, code, name, location, order_index, status)
       VALUES ($1, $2, $3, ST_SetSRID(ST_GeomFromGeoJSON($4),4326), $5, $6)
       RETURNING id, reservoir_id, code, name, order_index, status, created_at,
                 ST_AsGeoJSON(location)::json AS location_geojson`,
      [req.params.id, code, name || null, JSON.stringify(locationGeoJSON), orderIndex, status]
    );

    return res.status(201).json({ success: true, data: result.rows[0] });
  })
);

/**
 * @swagger
 * /api/reservoirs/markers/{markerId}:
 *   patch:
 *     tags: [Reservoirs]
 *     summary: Cập nhật cột mốc
 *     parameters:
 *       - in: path
 *         name: markerId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     security:
 *       - bearerAuth: []
 */
router.patch(
  '/markers/:markerId',
  requireAuth,
  requireRole('admin'),
  [
    param('markerId').isUUID(),
    body('name').optional().isString(),
    body('orderIndex').optional().isInt(),
    body('status').optional().isIn(['normal', 'damaged', 'missing', 'needs_inspection']),
    body('locationGeoJSON').optional().isObject()
  ],
  validate,
  asyncHandler(async (req, res) => {
    const result = await pool.query(
      `UPDATE boundary_markers
       SET name = COALESCE($1, name),
           order_index = COALESCE($2, order_index),
           status = COALESCE($3, status),
           location = CASE WHEN $4::text IS NULL THEN location ELSE ST_SetSRID(ST_GeomFromGeoJSON($4),4326) END
       WHERE id = $5
       RETURNING id, reservoir_id, code, name, order_index, status, created_at,
                 ST_AsGeoJSON(location)::json AS location_geojson`,
      [
        req.body.name || null,
        req.body.orderIndex ?? null,
        req.body.status || null,
        req.body.locationGeoJSON ? JSON.stringify(req.body.locationGeoJSON) : null,
        req.params.markerId
      ]
    );

    if (!result.rowCount) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy cột mốc' });
    }

    return res.json({ success: true, data: result.rows[0] });
  })
);

/**
 * @swagger
 * /api/reservoirs/markers/{markerId}:
 *   delete:
 *     tags: [Reservoirs]
 *     summary: Xóa cột mốc
 *     parameters:
 *       - in: path
 *         name: markerId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     security:
 *       - bearerAuth: []
 */
router.delete(
  '/markers/:markerId',
  requireAuth,
  requireRole('admin'),
  [param('markerId').isUUID()],
  validate,
  asyncHandler(async (req, res) => {
    const result = await pool.query('DELETE FROM boundary_markers WHERE id = $1 RETURNING id', [req.params.markerId]);

    if (!result.rowCount) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy cột mốc' });
    }

    return res.json({ success: true, message: 'Xóa cột mốc thành công' });
  })
);

module.exports = router;
