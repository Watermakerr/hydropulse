const express = require('express');
const bcrypt = require('bcryptjs');
const { body, param, query } = require('express-validator');

const pool = require('../db/pool');
const validate = require('../middlewares/validate');
const asyncHandler = require('../utils/asyncHandler');
const { requireAuth, requireRole } = require('../middlewares/auth');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Users
 *   description: Quản lý người dùng (Admin)
 */

router.use(requireAuth, requireRole('admin'));

/**
 * @swagger
 * /api/users:
 *   get:
 *     tags: [Users]
 *     summary: Lấy danh sách người dùng
 *     parameters:
 *       - in: query
 *         name: role
 *         required: false
 *         schema:
 *           type: string
 *           enum: [admin, worker]
 *       - in: query
 *         name: isActive
 *         required: false
 *         schema:
 *           type: boolean
 *     security:
 *       - bearerAuth: []
 */
router.get(
  '/',
  [query('role').optional().isIn(['admin', 'worker']), query('isActive').optional().isBoolean()],
  validate,
  asyncHandler(async (req, res) => {
    const conditions = ['deleted_at IS NULL'];
    const values = [];

    if (req.query.role) {
      values.push(req.query.role);
      conditions.push(`role = $${values.length}`);
    }

    if (req.query.isActive !== undefined) {
      values.push(req.query.isActive === 'true');
      conditions.push(`is_active = $${values.length}`);
    }

    const result = await pool.query(
      `SELECT id, full_name, email, role, is_active, last_login_at, created_at
       FROM users
       WHERE ${conditions.join(' AND ')}
       ORDER BY created_at DESC`,
      values
    );

    res.json({ success: true, data: result.rows });
  })
);

/**
 * @swagger
 * /api/users:
 *   post:
 *     tags: [Users]
 *     summary: Tạo user mới
 *     security:
 *       - bearerAuth: []
 */
router.post(
  '/',
  [
    body('fullName').isString().isLength({ min: 2 }),
    body('email').isEmail(),
    body('password').isLength({ min: 6 }),
    body('role').optional().isIn(['admin', 'worker'])
  ],
  validate,
  asyncHandler(async (req, res) => {
    const { fullName, email, password, role = 'worker' } = req.body;
    const passwordHash = await bcrypt.hash(password, 10);

    const result = await pool.query(
      `INSERT INTO users (full_name, email, password_hash, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, full_name, email, role, is_active, created_at`,
      [fullName, email, passwordHash, role]
    );

    res.status(201).json({ success: true, data: result.rows[0] });
  })
);

/**
 * @swagger
 * /api/users/{id}:
 *   patch:
 *     tags: [Users]
 *     summary: Cập nhật user
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
  [
    param('id').isUUID(),
    body('fullName').optional().isString().isLength({ min: 2 }),
    body('role').optional().isIn(['admin', 'worker']),
    body('isActive').optional().isBoolean()
  ],
  validate,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const fields = [];
    const values = [];

    if (req.body.fullName !== undefined) {
      values.push(req.body.fullName);
      fields.push(`full_name = $${values.length}`);
    }
    if (req.body.role !== undefined) {
      values.push(req.body.role);
      fields.push(`role = $${values.length}`);
    }
    if (req.body.isActive !== undefined) {
      values.push(req.body.isActive);
      fields.push(`is_active = $${values.length}`);
    }

    if (!fields.length) {
      return res.status(400).json({ success: false, message: 'Không có dữ liệu cập nhật' });
    }

    values.push(id);
    const result = await pool.query(
      `UPDATE users
       SET ${fields.join(', ')}
       WHERE id = $${values.length} AND deleted_at IS NULL
       RETURNING id, full_name, email, role, is_active, last_login_at, created_at`,
      values
    );

    if (!result.rowCount) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy user' });
    }

    return res.json({ success: true, data: result.rows[0] });
  })
);

/**
 * @swagger
 * /api/users/{id}/password:
 *   patch:
 *     tags: [Users]
 *     summary: Admin đặt lại mật khẩu user
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
  '/:id/password',
  [param('id').isUUID(), body('newPassword').isLength({ min: 6 })],
  validate,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { newPassword } = req.body;

    const passwordHash = await bcrypt.hash(newPassword, 10);

    const result = await pool.query(
      `UPDATE users
       SET password_hash = $1
       WHERE id = $2 AND deleted_at IS NULL
       RETURNING id`,
      [passwordHash, id]
    );

    if (!result.rowCount) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy user' });
    }

    return res.json({ success: true, message: 'Đặt lại mật khẩu thành công' });
  })
);

/**
 * @swagger
 * /api/users/{id}:
 *   delete:
 *     tags: [Users]
 *     summary: Xóa mềm user
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
  [param('id').isUUID()],
  validate,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const result = await pool.query(
      `UPDATE users
       SET deleted_at = NOW(), is_active = FALSE
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING id`,
      [id]
    );

    if (!result.rowCount) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy user' });
    }

    return res.json({ success: true, message: 'Xóa user thành công' });
  })
);

module.exports = router;
