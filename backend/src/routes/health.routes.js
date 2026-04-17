const express = require('express');
const router = express.Router();

/**
 * @swagger
 * /health:
 *   get:
 *     tags: [System]
 *     summary: Health check
 *     responses:
 *       200:
 *         description: OK
 */
router.get('/', (req, res) => {
  res.json({ success: true, message: 'API is running' });
});

module.exports = router;
