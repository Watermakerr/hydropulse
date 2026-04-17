const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { body } = require('express-validator');

const pool = require('../db/pool');
const env = require('../config/env');
const validate = require('../middlewares/validate');
const asyncHandler = require('../utils/asyncHandler');
const { requireAuth } = require('../middlewares/auth');

const router = express.Router();

function hashToken(input) {
  return crypto.createHash('sha256').update(input).digest('hex');
}

/**
 * @swagger
 * tags:
 *   name: Auth
 *   description: Xác thực người dùng
 */

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Đăng nhập
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password, platform]
 *             properties:
 *               email: { type: string, example: admin@hydropulse.vn }
 *               password: { type: string, example: Password123! }
 *               platform: { type: string, enum: [web, mobile], example: web }
 *     responses:
 *       200: { description: OK }
 */
router.post(
  '/login',
  [body('email').isEmail(), body('password').isLength({ min: 6 }), body('platform').isIn(['web', 'mobile'])],
  validate,
  asyncHandler(async (req, res) => {
    const { email, password, platform } = req.body;

    const userResult = await pool.query(
      `SELECT id, full_name, email, password_hash, role, is_active
       FROM users
       WHERE email = $1 AND deleted_at IS NULL`,
      [email]
    );

    if (!userResult.rowCount) {
      return res.status(401).json({ success: false, message: 'Sai email hoặc mật khẩu' });
    }

    const user = userResult.rows[0];
    const matched = await bcrypt.compare(password, user.password_hash);

    if (!matched || !user.is_active) {
      return res.status(401).json({ success: false, message: 'Sai email hoặc mật khẩu' });
    }

    if (user.role === 'worker' && platform !== 'mobile') {
      return res.status(403).json({ success: false, message: 'Worker chỉ được đăng nhập từ mobile' });
    }

    const tokenPayload = {
      sub: user.id,
      role: user.role,
      fullName: user.full_name,
      email: user.email
    };

    const accessToken = jwt.sign(tokenPayload, env.jwtSecret, { expiresIn: env.jwtExpiresIn });
    const refreshToken = crypto.randomBytes(48).toString('hex');
    const refreshTokenHash = hashToken(refreshToken);

    const sessionResult = await pool.query(
      `INSERT INTO auth_sessions (user_id, refresh_token_hash, platform, device_info, ip_address, user_agent, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW() + INTERVAL '30 days')
       RETURNING id`,
      [
        user.id,
        refreshTokenHash,
        platform,
        JSON.stringify(req.body.deviceInfo || {}),
        req.ip,
        req.headers['user-agent'] || null
      ]
    );

    await pool.query('UPDATE users SET last_login_at = NOW() WHERE id = $1', [user.id]);

    return res.json({
      success: true,
      data: {
        accessToken,
        refreshToken,
        sessionId: sessionResult.rows[0].id,
        user: {
          id: user.id,
          fullName: user.full_name,
          email: user.email,
          role: user.role
        }
      }
    });
  })
);

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     tags: [Auth]
 *     summary: Đăng xuất theo session
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [sessionId]
 *             properties:
 *               sessionId: { type: string }
 *     responses:
 *       200: { description: OK }
 */
router.post(
  '/logout',
  requireAuth,
  [body('sessionId').isUUID()],
  validate,
  asyncHandler(async (req, res) => {
    const { sessionId } = req.body;
    await pool.query(
      `UPDATE auth_sessions
       SET revoked_at = NOW()
       WHERE id = $1 AND user_id = $2`,
      [sessionId, req.user.sub]
    );

    return res.json({ success: true, message: 'Đăng xuất thành công' });
  })
);

/**
 * @swagger
 * /api/auth/refresh:
 *   post:
 *     tags: [Auth]
 *     summary: Làm mới access token bằng refresh token
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [refreshToken]
 *             properties:
 *               refreshToken: { type: string }
 *     responses:
 *       200: { description: OK }
 */
router.post(
  '/refresh',
  [body('refreshToken').isString().isLength({ min: 32 })],
  validate,
  asyncHandler(async (req, res) => {
    const { refreshToken } = req.body;
    const refreshTokenHash = hashToken(refreshToken);

    const sessionResult = await pool.query(
      `SELECT s.id, s.user_id, s.platform, u.full_name, u.email, u.role, u.is_active
       FROM auth_sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.refresh_token_hash = $1
         AND s.revoked_at IS NULL
         AND s.expires_at > NOW()
         AND u.deleted_at IS NULL
       LIMIT 1`,
      [refreshTokenHash]
    );

    if (!sessionResult.rowCount) {
      return res.status(401).json({ success: false, message: 'Refresh token không hợp lệ hoặc đã hết hạn' });
    }

    const session = sessionResult.rows[0];

    if (!session.is_active) {
      return res.status(401).json({ success: false, message: 'Tài khoản đã bị vô hiệu hóa' });
    }

    if (session.role === 'worker' && session.platform !== 'mobile') {
      return res.status(403).json({ success: false, message: 'Worker chỉ được đăng nhập từ mobile' });
    }

    const tokenPayload = {
      sub: session.user_id,
      role: session.role,
      fullName: session.full_name,
      email: session.email
    };

    const newAccessToken = jwt.sign(tokenPayload, env.jwtSecret, { expiresIn: env.jwtExpiresIn });
    const newRefreshToken = crypto.randomBytes(48).toString('hex');
    const newRefreshTokenHash = hashToken(newRefreshToken);

    await pool.query(
      `UPDATE auth_sessions
       SET refresh_token_hash = $1,
           expires_at = NOW() + INTERVAL '30 days'
       WHERE id = $2`,
      [newRefreshTokenHash, session.id]
    );

    return res.json({
      success: true,
      data: {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        sessionId: session.id,
        user: {
          id: session.user_id,
          fullName: session.full_name,
          email: session.email,
          role: session.role
        }
      }
    });
  })
);

/**
 * @swagger
 * /api/auth/forgot-password:
 *   post:
 *     tags: [Auth]
 *     summary: Tạo token quên mật khẩu
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email: { type: string }
 *     responses:
 *       200: { description: OK }
 */
router.post(
  '/forgot-password',
  [body('email').isEmail()],
  validate,
  asyncHandler(async (req, res) => {
    const { email } = req.body;
    const userResult = await pool.query('SELECT id FROM users WHERE email = $1 AND deleted_at IS NULL', [email]);

    if (userResult.rowCount) {
      const rawToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = hashToken(rawToken);
      await pool.query(
        `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
         VALUES ($1, $2, NOW() + INTERVAL '30 minutes')`,
        [userResult.rows[0].id, tokenHash]
      );

      return res.json({
        success: true,
        message: 'Token reset đã tạo. Dùng token này để test API.',
        data: { resetToken: rawToken }
      });
    }

    return res.json({ success: true, message: 'Nếu email tồn tại, token sẽ được gửi.' });
  })
);

/**
 * @swagger
 * /api/auth/reset-password:
 *   post:
 *     tags: [Auth]
 *     summary: Đặt lại mật khẩu
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token, newPassword]
 *             properties:
 *               token: { type: string }
 *               newPassword: { type: string, minLength: 6 }
 *     responses:
 *       200: { description: OK }
 */
router.post(
  '/reset-password',
  [body('token').isString().isLength({ min: 10 }), body('newPassword').isLength({ min: 6 })],
  validate,
  asyncHandler(async (req, res) => {
    const { token, newPassword } = req.body;
    const tokenHash = hashToken(token);

    const tokenResult = await pool.query(
      `SELECT id, user_id
       FROM password_reset_tokens
       WHERE token_hash = $1 AND used_at IS NULL AND expires_at > NOW()
       ORDER BY created_at DESC
       LIMIT 1`,
      [tokenHash]
    );

    if (!tokenResult.rowCount) {
      return res.status(400).json({ success: false, message: 'Token không hợp lệ hoặc đã hết hạn' });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);

    await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [passwordHash, tokenResult.rows[0].user_id]);
    await pool.query('UPDATE password_reset_tokens SET used_at = NOW() WHERE id = $1', [tokenResult.rows[0].id]);

    return res.json({ success: true, message: 'Đổi mật khẩu thành công' });
  })
);

module.exports = router;
