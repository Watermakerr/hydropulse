const express = require('express');
const multer = require('multer');
const { body, param } = require('express-validator');
const crypto = require('crypto');

const pool = require('../db/pool');
const validate = require('../middlewares/validate');
const asyncHandler = require('../utils/asyncHandler');
const { requireAuth } = require('../middlewares/auth');
const { uploadBuffer, getReadUrl } = require('../services/blobStorage');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Reports
 *   description: Báo cáo hiện trường và ảnh
 */

/**
 * @swagger
 * /api/reports/task/{taskId}:
 *   get:
 *     tags: [Reports]
 *     summary: Lấy danh sách báo cáo theo task
 *     parameters:
 *       - in: path
 *         name: taskId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     security:
 *       - bearerAuth: []
 */
router.get(
  '/task/:taskId',
  requireAuth,
  [param('taskId').isUUID()],
  validate,
  asyncHandler(async (req, res) => {
    const { taskId } = req.params;

    if (req.user.role === 'worker') {
      const allowed = await pool.query(
        `SELECT id FROM tasks WHERE id = $1 AND assigned_to = $2`,
        [taskId, req.user.sub]
      );

      if (!allowed.rowCount) {
        return res.status(403).json({ success: false, message: 'Không có quyền xem báo cáo task này' });
      }
    }

    const result = await pool.query(
      `SELECT id, task_id, worker_id, description, condition_status, sync_status, reported_at,
              CASE WHEN location IS NULL THEN NULL ELSE ST_AsGeoJSON(location)::json END AS location_geojson
       FROM task_reports
       WHERE task_id = $1
       ORDER BY reported_at DESC`,
      [taskId]
    );

    return res.json({ success: true, data: result.rows });
  })
);

/**
 * @swagger
 * /api/reports/{id}/photos:
 *   get:
 *     tags: [Reports]
 *     summary: Lấy danh sách ảnh của báo cáo
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
  '/:id/photos',
  requireAuth,
  [param('id').isUUID()],
  validate,
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    if (req.user.role === 'worker') {
      const allowed = await pool.query(
        `SELECT tr.id
         FROM task_reports tr
         JOIN tasks t ON t.id = tr.task_id
         WHERE tr.id = $1 AND t.assigned_to = $2`,
        [id, req.user.sub]
      );

      if (!allowed.rowCount) {
        return res.status(403).json({ success: false, message: 'Không có quyền xem ảnh báo cáo này' });
      }
    }

    const result = await pool.query(
      `SELECT id, report_id, url, caption, storage_provider, blob_path, upload_status, upload_error, metadata, taken_at
       FROM report_photos
       WHERE report_id = $1
       ORDER BY taken_at DESC`,
      [id]
    );

    const rows = await Promise.all(
      result.rows.map(async (row) => {
        if (row.blob_path && row.upload_status === 'uploaded') {
          return {
            ...row,
            url: await getReadUrl(row.blob_path)
          };
        }

        return row;
      })
    );

    return res.json({ success: true, data: rows });
  })
);

/**
 * @swagger
 * /api/reports:
 *   post:
 *     tags: [Reports]
 *     summary: Tạo báo cáo hiện trường cho task
 *     security:
 *       - bearerAuth: []
 */
router.post(
  '/',
  requireAuth,
  [
    body('taskId').isUUID(),
    body('description').optional().isString(),
    body('conditionStatus').optional().isIn(['good', 'minor_damage', 'major_damage', 'destroyed'])
  ],
  validate,
  asyncHandler(async (req, res) => {
    const { taskId, description, conditionStatus = 'good', locationGeoJSON } = req.body;

    const result = await pool.query(
      `INSERT INTO task_reports (task_id, worker_id, description, condition_status, location, sync_status)
       VALUES ($1, $2, $3, $4,
               CASE WHEN $5::text IS NULL THEN NULL ELSE ST_SetSRID(ST_GeomFromGeoJSON($5),4326) END,
               'pending')
       RETURNING id, task_id, worker_id, description, condition_status, sync_status, reported_at,
                 CASE WHEN location IS NULL THEN NULL ELSE ST_AsGeoJSON(location)::json END AS location_geojson`,
      [taskId, req.user.sub, description || null, conditionStatus, locationGeoJSON ? JSON.stringify(locationGeoJSON) : null]
    );

    return res.status(201).json({ success: true, data: result.rows[0] });
  })
);

/**
 * @swagger
 * /api/reports/{id}/photos:
 *   post:
 *     tags: [Reports]
 *     summary: Upload ảnh báo cáo lên Azure Blob
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [photo]
 *             properties:
 *               photo:
 *                 type: string
 *                 format: binary
 *               caption:
 *                 type: string
 */
router.post(
  '/:id/photos',
  requireAuth,
  [param('id').isUUID()],
  validate,
  upload.single('photo'),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Thiếu file ảnh' });
    }

    const reportId = req.params.id;
    const blobName = `reports/${reportId}/${Date.now()}-${crypto.randomUUID()}-${req.file.originalname}`;

    let uploadStatus = 'uploaded';
    let uploadError = null;
    let uploaded;

    try {
      uploaded = await uploadBuffer(req.file.buffer, blobName, req.file.mimetype);
    } catch (error) {
      uploadStatus = 'failed';
      uploadError = error.message;
    }

    const result = await pool.query(
      `INSERT INTO report_photos (report_id, url, caption, blob_path, upload_status, upload_error, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        reportId,
        uploaded ? uploaded.url : '',
        req.body.caption || null,
        uploaded ? uploaded.blobPath : blobName,
        uploadStatus,
        uploadError,
        JSON.stringify({
          originalName: req.file.originalname,
          mimeType: req.file.mimetype,
          size: req.file.size
        })
      ]
    );

    if (!uploaded) {
      return res.status(502).json({
        success: false,
        message: 'Upload Azure Blob thất bại',
        data: result.rows[0]
      });
    }

    await pool.query(
      `UPDATE task_reports
       SET sync_status = 'synced', synced_at = NOW(), sync_error = NULL
       WHERE id = $1`,
      [reportId]
    );

    const row = result.rows[0];
    const responseRow =
      row.blob_path && row.upload_status === 'uploaded'
        ? {
            ...row,
            url: await getReadUrl(row.blob_path)
          }
        : row;

    return res.status(201).json({ success: true, data: responseRow });
  })
);

module.exports = router;
