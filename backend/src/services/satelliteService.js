const axios = require('axios');
const pool = require('../db/pool');
const { runGeeScan } = require('./geeService');
const { parseMonthList, determineSeason } = require('../utils/season');

const DEFAULT_WET_MONTHS = [6, 7, 8, 9, 10];
const DEFAULT_DRY_MONTHS = [11, 12, 1, 2, 3, 4];

function getSeasonSets() {
  return {
    wetMonths: parseMonthList(process.env.GEE_WET_MONTHS, DEFAULT_WET_MONTHS),
    dryMonths: parseMonthList(process.env.GEE_DRY_MONTHS, DEFAULT_DRY_MONTHS)
  };
}

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

  async getBaselineBoundary(reservoirId, season) {
    const result = await pool.query(
      `SELECT id, area_m2
       FROM shoreline_boundaries
       WHERE reservoir_id = $1 AND boundary_type = 'baseline' AND season = $2
       ORDER BY created_at DESC
       LIMIT 1`,
      [reservoirId, season]
    );

    if (result.rows.length) {
      return result.rows[0];
    }

    // Robust Fallback: try wet first, then dry, then any available baseline
    const fallback = await pool.query(
      `SELECT id, area_m2
       FROM shoreline_boundaries
       WHERE reservoir_id = $1 AND boundary_type = 'baseline'
       ORDER BY CASE WHEN season = 'wet' THEN 1 WHEN season = 'dry' THEN 2 ELSE 3 END
       LIMIT 1`,
      [reservoirId]
    );

    return fallback.rows[0] || null;
  }

  async createShorelineBoundary({
    reservoirId,
    boundaryGeoJSON,
    season,
    source,
    captureDate,
    boundaryType = 'scan',
    metadata = null,
    isCurrent = true
  }) {
    const client = await pool.connect();
    const boundaryString = JSON.stringify(boundaryGeoJSON);

    try {
      await client.query('BEGIN');

      if (boundaryType === 'baseline') {
        await client.query(
          `DELETE FROM shoreline_boundaries
           WHERE reservoir_id = $1 AND boundary_type = 'baseline' AND season = $2`,
          [reservoirId, season]
        );
      }

      if (isCurrent) {
        await client.query(
          `UPDATE shoreline_boundaries
           SET is_current = FALSE
           WHERE reservoir_id = $1 AND boundary_type = 'scan' AND is_current = TRUE`,
          [reservoirId]
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
                   ST_AsGeoJSON(boundary)::json AS boundary_geojson`,
        [
          reservoirId,
          boundaryType,
          season,
          source,
          captureDate || null,
          boundaryString,
          isCurrent,
          metadata
        ]
      );

      await client.query('COMMIT');
      return result.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Analyze a reservoir using Planet Data API
   * Searches for recent Sentinel-2 scenes and extracts metadata
   */
  async analyzeReservoir(reservoirId, date, mode = 'auto') {
    const useGee = mode === 'gee' || (mode !== 'planet' && Boolean(process.env.GEE_RUNNER_URL));
    if (useGee) {
      return this.analyzeReservoirWithGee(reservoirId, date);
    }
    return this.analyzeReservoirWithPlanet(reservoirId, date);
  }

  async analyzeReservoirWithGee(reservoirId, date) {
    const reservoir = await this.getReservoirGeoJSON(reservoirId);
    if (!reservoir.geojson_boundary) {
      throw new Error('Reservoir has no boundary geometry');
    }

    const dateTo = date || new Date().toISOString().split('T')[0];
    const { wetMonths, dryMonths } = getSeasonSets();

    const payload = {
      reservoir: {
        id: reservoir.id,
        name: reservoir.name,
        area_ha: reservoir.area_ha
      },
      boundary_geojson: reservoir.geojson_boundary,
      date: dateTo,
      season_config: {
        wet_months: Array.from(wetMonths),
        dry_months: Array.from(dryMonths)
      }
    };

    const geeResult = await runGeeScan(payload);
    if (!geeResult || !geeResult.boundary_geojson) {
      throw new Error('GEE scan did not return boundary_geojson');
    }

    const captureDate = geeResult.capture_date || dateTo;
    const season = geeResult.season || determineSeason(captureDate, wetMonths, dryMonths);

    let scanBoundaryGeoJSON = geeResult.boundary_geojson;
    if (geeResult.metadata?.source === 'simulated_gee') {
      const dbBaseline = await pool.query(
        `SELECT ST_AsGeoJSON(boundary)::json AS boundary_geom, area_m2
         FROM shoreline_boundaries
         WHERE reservoir_id = $1 AND boundary_type = 'baseline' AND season = $2
         ORDER BY created_at DESC
         LIMIT 1`,
        [reservoirId, season]
      );
      if (dbBaseline.rows.length > 0 && dbBaseline.rows[0].boundary_geom) {
        scanBoundaryGeoJSON = dbBaseline.rows[0].boundary_geom;
        const baselineArea = dbBaseline.rows[0].area_m2;
        
        const isAlertTest = geeResult.metadata?.is_alert_test || false;
        let areaFactor = season === 'wet' ? 1.012 : 0.988;
        if (isAlertTest) {
          areaFactor = season === 'wet' ? 1.124 : 0.875;
        }
        geeResult.water_surface_area = baselineArea * areaFactor;
      }
    }

    const boundaryRow = await this.createShorelineBoundary({
      reservoirId,
      boundaryGeoJSON: scanBoundaryGeoJSON,
      season,
      source: 'gee',
      captureDate,
      boundaryType: 'scan',
      metadata: geeResult.metadata || null,
      isCurrent: true
    });

    const baseline = await this.getBaselineBoundary(reservoirId, season);
    const baselineArea = baseline?.area_m2 || null;
    const compareMode = baselineArea ? 'seasonal' : 'previous';
    const waterArea = geeResult.water_surface_area || boundaryRow.area_m2 || 0;

    const analysisResult = await this.saveAnalysis({
      reservoirId,
      date: captureDate,
      area: waterArea,
      rawResponse: geeResult.metadata || { source: 'gee' },
      season,
      boundaryId: boundaryRow.id,
      baselineBoundaryId: baseline?.id || null,
      baselineArea,
      compareMode
    });

    return {
      reservoirId,
      reservoirName: reservoir.name,
      date: captureDate,
      season,
      boundaryId: boundaryRow.id,
      estimatedWaterAreaM2: waterArea,
      estimatedWaterAreaHa: (waterArea / 10000).toFixed(2),
      changePercentage: analysisResult.changePercentage,
      deltaPreviousPercent: analysisResult.deltaPreviousPercent,
      alertLevel: analysisResult.alertLevel,
      status: 'SUCCESS'
    };
  }

  async analyzeReservoirWithPlanet(reservoirId, date) {
    if (!this.apiKey) {
      throw new Error('PLANET_API_KEY is required');
    }

    const reservoir = await this.getReservoirGeoJSON(reservoirId);
    console.log(`  Reservoir: ${reservoir.name}, Area: ${reservoir.area_ha} ha`);

    if (!reservoir.geojson_boundary) {
      throw new Error('Reservoir has no boundary geometry');
    }

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

    const bestScene = scenes.sort((a, b) => {
      const cloudDiff = a.properties.cloud_cover - b.properties.cloud_cover;
      if (Math.abs(cloudDiff) > 0.05) return cloudDiff;

      const dateDiff = new Date(b.properties.acquired).getTime() - new Date(a.properties.acquired).getTime();
      if (dateDiff !== 0) return dateDiff;

      return b.id.localeCompare(a.id);
    })[0];

    const sceneProps = bestScene.properties;
    const captureDate = sceneProps.acquired.split('T')[0];
    const cloudCover = sceneProps.cloud_cover;
    const clearPercent = (1 - cloudCover) * 100;

    const reservoirAreaM2 = reservoir.area_ha * 10000;
    const estimatedWaterArea = reservoirAreaM2 * (1 - cloudCover);

    const { wetMonths, dryMonths } = getSeasonSets();
    const season = determineSeason(captureDate, wetMonths, dryMonths);
    const baseline = await this.getBaselineBoundary(reservoirId, season);
    const baselineArea = baseline?.area_m2 || null;

    const analysisResult = await this.saveAnalysis({
      reservoirId,
      date: captureDate,
      area: estimatedWaterArea,
      rawResponse: {
        scene_id: bestScene.id,
        cloud_cover: cloudCover,
        clear_percent: clearPercent,
        acquired: sceneProps.acquired,
        pixel_resolution: sceneProps.pixel_resolution || 10,
        scenes_found: scenes.length
      },
      season,
      boundaryId: null,
      baselineBoundaryId: baseline?.id || null,
      baselineArea,
      compareMode: baselineArea ? 'seasonal' : 'previous'
    });

    return {
      reservoirId,
      reservoirName: reservoir.name,
      date: captureDate,
      sceneId: bestScene.id,
      season,
      cloudCover: `${(cloudCover * 100).toFixed(1)}%`,
      estimatedWaterAreaM2: estimatedWaterArea,
      estimatedWaterAreaHa: (estimatedWaterArea / 10000).toFixed(2),
      changePercentage: analysisResult.changePercentage,
      deltaPreviousPercent: analysisResult.deltaPreviousPercent,
      alertLevel: analysisResult.alertLevel,
      scenesFound: scenes.length,
      status: 'SUCCESS'
    };
  }

  /**
   * Save analysis result and calculate change alerts
   */
  async saveAnalysis({
    reservoirId,
    date,
    area,
    rawResponse,
    season,
    boundaryId,
    baselineBoundaryId,
    baselineArea,
    compareMode
  }) {
    const prevRecord = await pool.query(
      'SELECT water_surface_area FROM satellite_analysis WHERE reservoir_id = $1 AND capture_date < $2 ORDER BY capture_date DESC LIMIT 1',
      [reservoirId, date]
    );

    let deltaPreviousPercent = 0;
    if (prevRecord.rows.length > 0 && prevRecord.rows[0].water_surface_area > 0) {
      const prevArea = prevRecord.rows[0].water_surface_area;
      deltaPreviousPercent = ((area - prevArea) / prevArea) * 100;
    }

    let changePercentage = 0;
    let finalCompareMode = compareMode || 'seasonal';

    if (baselineArea && baselineArea > 0) {
      changePercentage = ((area - baselineArea) / baselineArea) * 100;
    } else if (prevRecord.rows.length > 0 && prevRecord.rows[0].water_surface_area > 0) {
      changePercentage = deltaPreviousPercent;
      finalCompareMode = 'previous';
    } else {
      finalCompareMode = 'none';
    }

    let alertLevel = 'LOW';
    if (Math.abs(changePercentage) > 10) alertLevel = 'HIGH';
    else if (Math.abs(changePercentage) > 5) alertLevel = 'MEDIUM';

    await pool.query(
      `INSERT INTO satellite_analysis
        (reservoir_id, capture_date, water_surface_area, change_percentage, alert_level, raw_response,
         season, boundary_id, baseline_boundary_id, baseline_area_m2, delta_previous_percent, compare_mode)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       ON CONFLICT (reservoir_id, capture_date) DO UPDATE SET
         water_surface_area = EXCLUDED.water_surface_area,
         change_percentage = EXCLUDED.change_percentage,
         alert_level = EXCLUDED.alert_level,
         raw_response = EXCLUDED.raw_response,
         season = EXCLUDED.season,
         boundary_id = EXCLUDED.boundary_id,
         baseline_boundary_id = EXCLUDED.baseline_boundary_id,
         baseline_area_m2 = EXCLUDED.baseline_area_m2,
         delta_previous_percent = EXCLUDED.delta_previous_percent,
         compare_mode = EXCLUDED.compare_mode`,
      [
        reservoirId,
        date,
        area,
        changePercentage,
        alertLevel,
        rawResponse,
        season,
        boundaryId,
        baselineBoundaryId,
        baselineArea,
        deltaPreviousPercent,
        finalCompareMode
      ]
    );

    if (alertLevel === 'HIGH') {
      await pool.query(
        `INSERT INTO notifications (user_id, title, message)
         SELECT id, 'Cảnh báo vệ tinh', $1
         FROM users WHERE role = 'admin' AND is_active = TRUE AND deleted_at IS NULL`,
        [`Diện tích mặt nước hồ thay đổi ${changePercentage.toFixed(1)}% (ngày ${date})`]
      );

      // Auto-create a needs_inspection marker at reservoir centroid when alert is HIGH
      try {
        const centroidResult = await pool.query(
          `SELECT
             ST_Y(ST_Centroid(boundary)) AS lat,
             ST_X(ST_Centroid(boundary)) AS lng
           FROM reservoirs
           WHERE id = $1 AND boundary IS NOT NULL`,
          [reservoirId]
        );

        if (centroidResult.rows.length > 0) {
          const { lat, lng } = centroidResult.rows[0];
          const alertCode = `ALERT-${date}-${Date.now().toString().slice(-6)}`;
          const direction = changePercentage > 0 ? 'tăng' : 'giảm';
          const absChange = Math.abs(changePercentage).toFixed(1);

          await pool.query(
            `INSERT INTO boundary_markers (reservoir_id, code, name, location, order_index, status)
             VALUES ($1, $2, $3, ST_SetSRID(ST_MakePoint($4, $5), 4326), 999, 'needs_inspection')
             ON CONFLICT DO NOTHING`,
            [
              reservoirId,
              alertCode,
              `⚠ Cảnh báo vệ tinh: diện tích ${direction} ${absChange}% (${date})`,
              lng,
              lat
            ]
          );
          console.log(`[SatelliteService] Auto-created alert marker ${alertCode} for reservoir ${reservoirId}`);
        }
      } catch (markerErr) {
        console.warn('[SatelliteService] Failed to auto-create alert marker:', markerErr.message);
      }
    }

    return { changePercentage, deltaPreviousPercent, alertLevel };
  }

  /**
   * Analyze ALL active reservoirs — for daily cron job
   */
  async analyzeAllReservoirs(mode = 'auto') {
    const today = new Date().toISOString().split('T')[0];
    const reservoirs = await pool.query(
      "SELECT id FROM reservoirs WHERE status = 'active' AND boundary IS NOT NULL"
    );

    console.log(`Found ${reservoirs.rows.length} active reservoirs to analyze.`);
    const results = [];

    for (const row of reservoirs.rows) {
      try {
        const result = await this.analyzeReservoir(row.id, today, mode);
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
