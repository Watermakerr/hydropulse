const express = require('express');
const multer = require('multer');
const { body, param, query } = require('express-validator');

const pool = require('../db/pool');
const validate = require('../middlewares/validate');
const asyncHandler = require('../utils/asyncHandler');
const { requireAuth, requireRole } = require('../middlewares/auth');
const { parseMonthList, determineSeason } = require('../utils/season');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

const DEFAULT_WET_MONTHS = [6, 7, 8, 9, 10];
const DEFAULT_DRY_MONTHS = [11, 12, 1, 2, 3, 4];

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

function parseBoundaryGeoJson(value) {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  if (typeof value === 'string') {
    const parsed = JSON.parse(value);
    return normalizeGeoJsonToPolygon(parsed);
  }

  return normalizeGeoJsonToPolygon(value);
}

function resolveSeason(explicitSeason, captureDate) {
  if (explicitSeason) {
    return explicitSeason;
  }

  const wetMonths = parseMonthList(process.env.GEE_WET_MONTHS, DEFAULT_WET_MONTHS);
  const dryMonths = parseMonthList(process.env.GEE_DRY_MONTHS, DEFAULT_DRY_MONTHS);
  return determineSeason(captureDate, wetMonths, dryMonths);
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

/**
 * @swagger
 * /api/reservoirs/{id}/shorelines:
 *   get:
 *     tags: [Reservoirs]
 *     summary: Danh sách ranh giới theo mùa
 */
router.get(
  '/:id/shorelines',
  requireAuth,
  [
    param('id').isUUID(),
    query('season').optional().isIn(['dry', 'wet', 'normal', 'transition', 'unknown']),
    query('type').optional().isIn(['baseline', 'scan', 'survey']),
    query('current').optional().isBoolean()
  ],
  validate,
  asyncHandler(async (req, res) => {
    const conditions = ['reservoir_id = $1'];
    const values = [req.params.id];

    if (req.query.season) {
      values.push(req.query.season);
      conditions.push(`season = $${values.length}`);
    }

    if (req.query.type) {
      values.push(req.query.type);
      conditions.push(`boundary_type = $${values.length}`);
    }

    if (req.query.current !== undefined) {
      values.push(req.query.current === 'true');
      conditions.push(`is_current = $${values.length}`);
    }

    const result = await pool.query(
      `SELECT id, reservoir_id, boundary_type, season, source, capture_date, area_m2, is_current, metadata,
              ST_AsGeoJSON(boundary)::json AS boundary_geojson, created_at
       FROM shoreline_boundaries
       WHERE ${conditions.join(' AND ')}
       ORDER BY capture_date DESC NULLS LAST, created_at DESC`,
      values
    );

    return res.json({ success: true, data: result.rows });
  })
);

/**
 * @swagger
 * /api/reservoirs/{id}/shorelines:
 *   post:
 *     tags: [Reservoirs]
 *     summary: Tạo hoặc cập nhật ranh giới theo mùa
 */
router.post(
  '/:id/shorelines',
  requireAuth,
  requireRole('admin'),
  [
    param('id').isUUID(),
    body('boundaryGeoJSON').exists(),
    body('boundaryType').optional().isIn(['baseline', 'scan', 'survey']),
    body('season').optional().isIn(['dry', 'wet', 'normal', 'transition', 'unknown']),
    body('source').optional().isIn(['gee', 'planet', 'manual', 'survey', 'import']),
    body('captureDate').optional().isISO8601(),
    body('isCurrent').optional().isBoolean(),
    body('metadata').optional()
  ],
  validate,
  asyncHandler(async (req, res) => {
    const boundaryType = req.body.boundaryType || 'scan';
    const captureDate = req.body.captureDate || null;
    const season = resolveSeason(req.body.season, captureDate);
    const source = req.body.source || 'manual';
    const isCurrent = req.body.isCurrent !== undefined ? req.body.isCurrent : boundaryType === 'scan';
    const metadata = typeof req.body.metadata === 'string' ? JSON.parse(req.body.metadata) : req.body.metadata || null;

    const boundary = parseBoundaryGeoJson(req.body.boundaryGeoJSON);
    if (!boundary) {
      return res.status(400).json({ success: false, message: 'Thiếu dữ liệu boundaryGeoJSON' });
    }

    const boundaryString = JSON.stringify(boundary);
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      if (boundaryType === 'baseline') {
        await client.query(
          `DELETE FROM shoreline_boundaries
           WHERE reservoir_id = $1 AND boundary_type = 'baseline' AND season = $2`,
          [req.params.id, season]
        );
      }

      if (isCurrent) {
        await client.query(
          `UPDATE shoreline_boundaries
           SET is_current = FALSE
           WHERE reservoir_id = $1 AND boundary_type = 'scan' AND is_current = TRUE`,
          [req.params.id]
        );
      }

      const result = await client.query(
        `INSERT INTO shoreline_boundaries
          (reservoir_id, boundary_type, season, source, capture_date, area_m2, boundary, is_current, metadata)
         VALUES
          ($1, $2, $3, $4, $5,
           ST_Area(ST_SetSRID(ST_GeomFromGeoJSON($6),4326)::geography),
           ST_SetSRID(ST_GeomFromGeoJSON($6),4326),
           $7, $8)
         RETURNING id, reservoir_id, boundary_type, season, source, capture_date, area_m2, is_current,
                   ST_AsGeoJSON(boundary)::json AS boundary_geojson, created_at`,
        [
          req.params.id,
          boundaryType,
          season,
          source,
          captureDate,
          boundaryString,
          isCurrent,
          metadata
        ]
      );

      await client.query('COMMIT');
      return res.status(201).json({ success: true, data: result.rows[0] });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  })
);

/**
 * @swagger
 * /api/reservoirs/{id}/shorelines/flood-expansion:
 *   get:
 *     tags: [Reservoirs]
 *     summary: Vùng ngập mở rộng (mưa - khô)
 */
router.get(
  '/:id/shorelines/flood-expansion',
  requireAuth,
  [param('id').isUUID()],
  validate,
  asyncHandler(async (req, res) => {
    const result = await pool.query(
      `WITH wet AS (
         SELECT boundary
         FROM shoreline_boundaries
         WHERE reservoir_id = $1 AND boundary_type = 'baseline' AND season = 'wet'
         ORDER BY created_at DESC
         LIMIT 1
       ),
       dry AS (
         SELECT boundary
         FROM shoreline_boundaries
         WHERE reservoir_id = $1 AND boundary_type = 'baseline' AND season = 'dry'
         ORDER BY created_at DESC
         LIMIT 1
       )
       SELECT ST_AsGeoJSON(ST_Difference(wet.boundary, dry.boundary))::json AS boundary_geojson,
              ST_Area(ST_Difference(wet.boundary, dry.boundary)::geography) AS area_m2
       FROM wet, dry`,
      [req.params.id]
    );

    if (!result.rowCount || !result.rows[0].boundary_geojson) {
      return res.status(404).json({ success: false, message: 'Thiếu ranh giới baseline mùa mưa/khô' });
    }

    return res.json({ success: true, data: result.rows[0] });
  })
);

module.exports = router;
