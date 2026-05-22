const fs = require('fs');
const path = require('path');

const pool = require('../db/pool');

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {};
  for (let i = 0; i < args.length; i += 1) {
    const key = args[i];
    const value = args[i + 1];
    if (key && key.startsWith('--')) {
      options[key.slice(2)] = value;
      i += 1;
    }
  }
  return options;
}

function normalizeGeoJsonToPolygon(geojson) {
  if (!geojson) {
    return null;
  }

  function extractLargestPolygonFromMulti(multiPolygonGeom) {
    if (!multiPolygonGeom.coordinates || multiPolygonGeom.coordinates.length === 0) {
      throw new Error('MultiPolygon has no coordinates');
    }
    let largestIdx = 0;
    let maxPoints = 0;
    for (let i = 0; i < multiPolygonGeom.coordinates.length; i++) {
      const poly = multiPolygonGeom.coordinates[i];
      if (poly && poly[0] && poly[0].length > maxPoints) {
        maxPoints = poly[0].length;
        largestIdx = i;
      }
    }
    return {
      type: 'Polygon',
      coordinates: multiPolygonGeom.coordinates[largestIdx]
    };
  }

  if (geojson.type === 'Polygon') {
    return geojson;
  }

  if (geojson.type === 'MultiPolygon') {
    return extractLargestPolygonFromMulti(geojson);
  }

  if (geojson.type === 'Feature') {
    if (geojson.geometry?.type === 'Polygon') {
      return geojson.geometry;
    }
    if (geojson.geometry?.type === 'MultiPolygon') {
      return extractLargestPolygonFromMulti(geojson.geometry);
    }
  }

  if (geojson.type === 'FeatureCollection' && Array.isArray(geojson.features)) {
    const polygonFeature = geojson.features.find((f) => f?.geometry?.type === 'Polygon');
    if (polygonFeature) {
      return polygonFeature.geometry;
    }
    const multiPolygonFeature = geojson.features.find((f) => f?.geometry?.type === 'MultiPolygon');
    if (multiPolygonFeature) {
      return extractLargestPolygonFromMulti(multiPolygonFeature.geometry);
    }
  }

  throw new Error('GeoJSON file must contain a Polygon or MultiPolygon geometry');
}

async function main() {
  const options = parseArgs();
  const reservoirId = options.reservoirId;
  const filePath = options.file;
  const season = options.season || 'normal';
  const boundaryType = options.type || 'baseline';
  const source = options.source || 'import';
  const captureDate = options.captureDate || null;
  const isCurrent = options.isCurrent === 'true' || boundaryType === 'scan';

  if (!reservoirId || !filePath) {
    throw new Error('Usage: node importShorelineGeojson.js --reservoirId <uuid> --file <path> [--season dry|wet|normal]');
  }

  const absolutePath = path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);
  const raw = fs.readFileSync(absolutePath, 'utf-8');
  const parsed = JSON.parse(raw);
  const polygon = normalizeGeoJsonToPolygon(parsed);
  const boundaryString = JSON.stringify(polygon);

  const client = await pool.connect();
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
        (reservoir_id, boundary_type, season, source, capture_date, area_m2, boundary, is_current)
       VALUES
        ($1, $2, $3, $4, $5,
         ST_Area(ST_SetSRID(ST_GeomFromGeoJSON($6),4326)::geography),
         ST_SetSRID(ST_GeomFromGeoJSON($6),4326),
         $7)
       RETURNING id, area_m2`,
      [reservoirId, boundaryType, season, source, captureDate, boundaryString, isCurrent]
    );

    await client.query('COMMIT');
    console.log(`Imported boundary ${result.rows[0].id}, area_m2=${result.rows[0].area_m2}`);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error('Import failed:', error.message);
  process.exit(1);
});
