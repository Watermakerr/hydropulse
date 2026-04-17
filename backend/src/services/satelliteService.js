const axios = require('axios');
const pool = require('../db/pool');

/**
 * SatelliteService — Uses Planet Data API (api.planet.com) with API Key
 * to search for Sentinel-2 imagery and track reservoir changes.
 *
 * Flow:
 *  1. Search Planet catalog for recent Sentinel-2 scenes covering the reservoir
 *  2. Extract cloud cover & visible area metadata
 *  3. Compare with previous records to detect changes
 *  4. Save analysis results and generate alerts
 */
class SatelliteService {
  constructor() {
    this.apiKey = process.env.PLANET_API_KEY;
    this.baseUrl = 'https://api.planet.com/data/v1';
  }

  /**
   * Get auth config for axios (Basic Auth with API Key as username)
   */
  getAuth() {
    return { username: this.apiKey, password: '' };
  }

  /**
   * Convert PostGIS geometry to GeoJSON (if stored as WKB/WKT)
   */
  async getReservoirGeoJSON(reservoirId) {
    const result = await pool.query(
      `SELECT id, name, area_ha,
              ST_AsGeoJSON(boundary)::json AS geojson_boundary
       FROM reservoirs
       WHERE id = $1 AND boundary IS NOT NULL`,
      [reservoirId]
    );
    if (result.rows.length === 0) {
      throw new Error(`Reservoir ${reservoirId} not found or has no boundary`);
    }
    return result.rows[0];
  }

  /**
   * Search Planet catalog for Sentinel-2 scenes
   * covering the given reservoir geometry
   */
  async searchScenes(geometry, dateFrom, dateTo) {
    const searchPayload = {
      item_types: ['PSScene'],
      filter: {
        type: 'AndFilter',
        config: [
          {
            type: 'GeometryFilter',
            field_name: 'geometry',
            config: geometry
          },
          {
            type: 'DateRangeFilter',
            field_name: 'acquired',
            config: {
              gte: `${dateFrom}T00:00:00Z`,
              lte: `${dateTo}T23:59:59Z`
            }
          },
          {
            type: 'RangeFilter',
            field_name: 'cloud_cover',
            config: { lte: 0.3 } // Max 30% cloud cover
          }
        ]
      }
    };

    try {
      const response = await axios.post(
        `${this.baseUrl}/quick-search`,
        searchPayload,
        {
          auth: this.getAuth(),
          headers: { 'Content-Type': 'application/json' }
        }
      );
      return response.data.features || [];
    } catch (error) {
      console.error('Planet search error:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Analyze a reservoir using Planet Data API
   * Searches for recent Sentinel-2 scenes and extracts metadata
   */
  async analyzeReservoir(reservoirId, date) {
    if (!this.apiKey) {
      throw new Error('PLANET_API_KEY is required');
    }

    // 1. Get reservoir geometry from DB
    const reservoir = await this.getReservoirGeoJSON(reservoirId);
    console.log(`  Reservoir: ${reservoir.name}, Area: ${reservoir.area_ha} ha`);

    if (!reservoir.geojson_boundary) {
      throw new Error('Reservoir has no boundary geometry');
    }

    // 2. Search for scenes in the last 30 days up to the target date
    const dateTo = date || new Date().toISOString().split('T')[0];
    const dateFromObj = new Date(dateTo);
    dateFromObj.setDate(dateFromObj.getDate() - 30);
    const dateFrom = dateFromObj.toISOString().split('T')[0];

    console.log(`  Searching scenes from ${dateFrom} to ${dateTo}...`);
    const scenes = await this.searchScenes(reservoir.geojson_boundary, dateFrom, dateTo);

    if (scenes.length === 0) {
      console.log('  No clear scenes found in the date range.');
      return {
        reservoirId,
        date: dateTo,
        scenesFound: 0,
        status: 'NO_DATA'
      };
    }

    // 3. Pick the most recent, clearest scene
    const bestScene = scenes.sort((a, b) => {
      // Sort by cloud cover (ascending), then by date (descending)
      const cloudDiff = a.properties.cloud_cover - b.properties.cloud_cover;
      if (Math.abs(cloudDiff) > 0.05) return cloudDiff;
      return new Date(b.properties.acquired) - new Date(a.properties.acquired);
    })[0];

    const sceneProps = bestScene.properties;
    const captureDate = sceneProps.acquired.split('T')[0];
    const cloudCover = sceneProps.cloud_cover;
    const clearPercent = (1 - cloudCover) * 100;

    // 4. Estimate visible water area
    // Using reservoir boundary area and clear sky percentage
    const reservoirAreaM2 = reservoir.area_ha * 10000; // ha -> m2
    const estimatedWaterArea = reservoirAreaM2 * (1 - cloudCover);

    console.log(`  Best scene: ${bestScene.id}`);
    console.log(`  Captured: ${captureDate}, Cloud: ${(cloudCover * 100).toFixed(1)}%`);
    console.log(`  Clear sky: ${clearPercent.toFixed(1)}%`);
    console.log(`  Estimated visible water area: ${estimatedWaterArea.toFixed(0)} m²`);

    // 5. Save to database and check for alerts
    const analysisResult = await this.saveAnalysis(
      reservoirId,
      captureDate,
      estimatedWaterArea,
      {
        scene_id: bestScene.id,
        cloud_cover: cloudCover,
        clear_percent: clearPercent,
        acquired: sceneProps.acquired,
        pixel_resolution: sceneProps.pixel_resolution || 10,
        scenes_found: scenes.length
      }
    );

    return {
      reservoirId,
      reservoirName: reservoir.name,
      date: captureDate,
      sceneId: bestScene.id,
      cloudCover: `${(cloudCover * 100).toFixed(1)}%`,
      estimatedWaterAreaM2: estimatedWaterArea,
      estimatedWaterAreaHa: (estimatedWaterArea / 10000).toFixed(2),
      changePercentage: analysisResult.changePercentage,
      alertLevel: analysisResult.alertLevel,
      scenesFound: scenes.length,
      status: 'SUCCESS'
    };
  }

  /**
   * Save analysis result and calculate change alerts
   */
  async saveAnalysis(reservoirId, date, area, rawResponse) {
    // Get previous record for change calculation
    const prevRecord = await pool.query(
      'SELECT water_surface_area FROM satellite_analysis WHERE reservoir_id = $1 ORDER BY capture_date DESC LIMIT 1',
      [reservoirId]
    );

    let changePercentage = 0;
    let alertLevel = 'LOW';

    if (prevRecord.rows.length > 0 && prevRecord.rows[0].water_surface_area > 0) {
      const prevArea = prevRecord.rows[0].water_surface_area;
      changePercentage = ((area - prevArea) / prevArea) * 100;

      if (Math.abs(changePercentage) > 10) alertLevel = 'HIGH';
      else if (Math.abs(changePercentage) > 5) alertLevel = 'MEDIUM';
    }

    await pool.query(
      `INSERT INTO satellite_analysis (reservoir_id, capture_date, water_surface_area, change_percentage, alert_level, raw_response)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (reservoir_id, capture_date) DO UPDATE SET
         water_surface_area = EXCLUDED.water_surface_area,
         change_percentage = EXCLUDED.change_percentage,
         alert_level = EXCLUDED.alert_level,
         raw_response = EXCLUDED.raw_response`,
      [reservoirId, date, area, changePercentage, alertLevel, rawResponse]
    );

    // If alert is HIGH, create a notification for admin
    if (alertLevel === 'HIGH') {
      await pool.query(
        `INSERT INTO notifications (user_id, title, message)
         SELECT id, 'Cảnh báo vệ tinh', $1
         FROM users WHERE role = 'admin' AND is_active = TRUE AND deleted_at IS NULL`,
        [`Diện tích mặt nước hồ thay đổi ${changePercentage.toFixed(1)}% (ngày ${date})`]
      );
    }

    return { changePercentage, alertLevel };
  }

  /**
   * Analyze ALL active reservoirs — for daily cron job
   */
  async analyzeAllReservoirs() {
    const today = new Date().toISOString().split('T')[0];
    const reservoirs = await pool.query(
      "SELECT id FROM reservoirs WHERE status = 'active' AND boundary IS NOT NULL"
    );

    console.log(`Found ${reservoirs.rows.length} active reservoirs to analyze.`);
    const results = [];

    for (const row of reservoirs.rows) {
      try {
        const result = await this.analyzeReservoir(row.id, today);
        results.push(result);
      } catch (error) {
        console.error(`Failed to analyze reservoir ${row.id}:`, error.message);
        results.push({ reservoirId: row.id, status: 'ERROR', error: error.message });
      }
    }

    return results;
  }
}

module.exports = new SatelliteService();
