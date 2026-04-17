const express = require('express');
const { body } = require('express-validator');

const pool = require('../db/pool');
const validate = require('../middlewares/validate');
const asyncHandler = require('../utils/asyncHandler');
const { requireAuth } = require('../middlewares/auth');

const router = express.Router();

router.use(requireAuth);

/**
 * @swagger
 * tags:
 *   name: Notifications
 *   description: Đăng ký push token và lấy thông báo
 */

/**
 * @swagger
 * /api/notifications/devices:
 *   post:
 *     tags: [Notifications]
 *     summary: Đăng ký/cập nhật push token thiết bị mobile
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [deviceToken]
 *             properties:
 *               deviceToken: { type: string }
 *               platform: { type: string, enum: [android, ios], example: android }
 *     security:
 *       - bearerAuth: []
 */
router.post(
  '/devices',
  [body('deviceToken').isString().isLength({ min: 10 }), body('platform').optional().isIn(['android', 'ios'])],
  validate,
  asyncHandler(async (req, res) => {
    const { deviceToken, platform = 'android' } = req.body;

    const result = await pool.query(
      `INSERT INTO mobile_device_tokens (user_id, device_token, platform, is_active, last_seen_at)
       VALUES ($1, $2, $3, TRUE, NOW())
       ON CONFLICT (user_id, device_token)
       DO UPDATE SET platform = EXCLUDED.platform, is_active = TRUE, last_seen_at = NOW()
       RETURNING id, user_id, device_token, platform, is_active, last_seen_at, created_at`,
      [req.user.sub, deviceToken, platform]
    );

    return res.status(201).json({ success: true, data: result.rows[0] });
  })
);

/**
 * @swagger
 * /api/notifications/devices:
 *   delete:
 *     tags: [Notifications]
 *     summary: Hủy đăng ký push token thiết bị
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [deviceToken]
 *             properties:
 *               deviceToken: { type: string }
 *     security:
 *       - bearerAuth: []
 */
router.delete(
  '/devices',
  [body('deviceToken').isString().isLength({ min: 10 })],
  validate,
  asyncHandler(async (req, res) => {
    const { deviceToken } = req.body;

    await pool.query(
      `UPDATE mobile_device_tokens
       SET is_active = FALSE
       WHERE user_id = $1 AND device_token = $2`,
      [req.user.sub, deviceToken]
    );

    return res.json({ success: true, message: 'Hủy đăng ký push token thành công' });
  })
);

/**
 * @swagger
 * /api/notifications:
 *   get:
 *     tags: [Notifications]
 *     summary: Danh sách thông báo của user hiện tại
 *     security:
 *       - bearerAuth: []
 */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const result = await pool.query(
      `SELECT id, user_id, task_id, title, message, is_read, created_at
       FROM notifications
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 100`,
      [req.user.sub]
    );

    return res.json({ success: true, data: result.rows });
  })
);

module.exports = router;
