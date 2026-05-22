const express = require('express');
const { body } = require('express-validator');
const validate = require('../middlewares/validate');
const router = express.Router();
const satelliteService = require('../services/satelliteService');
const pool = require('../db/pool');
const { requireAuth, requireRole } = require('../middlewares/auth');

/**
 * @swagger
 * /api/satellite/analyze/{reservoirId}:
 *   post:
 *     summary: Trigger satellite analysis for a specific reservoir
 *     tags: [Satellite]
 */
router.post(
  '/analyze/:reservoirId',
  requireAuth,
  requireRole('admin'),
  [body('mode').optional().isIn(['auto', 'gee', 'planet'])],
  validate,
  async (req, res, next) => {
  try {
    const { reservoirId } = req.params;
    const { date, mode } = req.body;
    const dateStr = date || new Date().toISOString().split('T')[0];

    const result = await satelliteService.analyzeReservoir(reservoirId, dateStr, mode || 'auto');
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
  }
);

/**
 * @swagger
 * /api/satellite/analyze-all:
 *   post:
 *     summary: Trigger satellite analysis for all active reservoirs
 *     tags: [Satellite]
 */
router.post(
  '/analyze-all',
  requireAuth,
  requireRole('admin'),
  [body('mode').optional().isIn(['auto', 'gee', 'planet'])],
  validate,
  async (req, res, next) => {
  try {
    const { mode } = req.body || {};
    const results = await satelliteService.analyzeAllReservoirs(mode || 'auto');
    res.json({ success: true, data: { total: results.length, results } });
  } catch (error) {
    next(error);
  }
  }
);

/**
 * @swagger
 * /api/satellite/history/{reservoirId}:
 *   get:
 *     summary: Get satellite analysis history for a reservoir
 *     tags: [Satellite]
 */
router.get('/history/:reservoirId', requireAuth, async (req, res, next) => {
  try {
    const { reservoirId } = req.params;
    const result = await pool.query(
      `SELECT id, capture_date, water_surface_area, change_percentage, alert_level, raw_response, created_at,
              season, baseline_area_m2, delta_previous_percent, compare_mode, boundary_id
       FROM satellite_analysis
       WHERE reservoir_id = $1
       ORDER BY capture_date DESC
       LIMIT 90`,
      [reservoirId]
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/satellite/thumbnail/{sceneId}:
 *   get:
 *     summary: Get satellite thumbnail image
 *     tags: [Satellite]
 */
router.get('/thumbnail/:sceneId', async (req, res, next) => {
  try {
    const { sceneId } = req.params;
    const { width } = req.query;
    const { default: axios } = await import('axios'); 
    
    let url = `https://tiles.planet.com/data/v1/item-types/PSScene/items/${sceneId}/thumb`;
    if (width) {
      url += `?width=${width}`;
    }
    
    const response = await axios({
      url,
      method: 'GET',
      responseType: 'stream',
      auth: { username: process.env.PLANET_API_KEY, password: '' }
    });
    
    res.set('Content-Type', response.headers['content-type'] || 'image/png');
    response.data.pipe(res);
  } catch (error) {
    if (error.response) {
       res.status(error.response.status).json({ message: 'Error fetching thumbnail' });
    } else {
       next(error);
    }
  }
});

router.get('/tiles/:sceneId/:z/:x/:y', async (req, res, next) => {
  try {
    const { sceneId, z, x, y } = req.params;
    const apiKey = process.env.PLANET_API_KEY;
    const { default: axios } = await import('axios');
    
    // Y might contain .png, strip it or append it
    const yParam = y.replace('.png', '');
    const url = `https://tiles0.planet.com/data/v1/PSScene/${sceneId}/${z}/${x}/${yParam}.png?api_key=${apiKey}`;
    
    const response = await axios({
      url,
      method: 'GET',
      responseType: 'stream'
    });
    
    res.set('Content-Type', 'image/png');
    res.set('Cache-Control', 'public, max-age=86400');
    // Forward the stream
    response.data.pipe(res);
  } catch (error) {
    if (error.response && error.response.status === 404) {
      return res.status(404).send('Tile not found');
    }
    console.error('Tile proxy error:', error.message);
    res.status(500).json({ success: false, message: 'Lỗi tải tile vệ tinh' });
  }
});

module.exports = router;
