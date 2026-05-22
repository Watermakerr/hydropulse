const pool = require('../db/pool');

async function test() {
  try {
    const res = await pool.query('SELECT id, boundary_type, season, ST_AsGeoJSON(boundary)::json as boundary_geojson FROM shoreline_boundaries LIMIT 2');
    console.log('ROWS COUNT:', res.rows.length);
    for (const r of res.rows) {
      console.log('ID:', r.id, 'TYPE:', r.boundary_type, 'SEASON:', r.season);
      console.log('GEOJSON TYPE:', r.boundary_geojson?.type);
      console.log('COORDINATES LENGTH:', r.boundary_geojson?.coordinates?.length);
      if (r.boundary_geojson?.coordinates?.[0]) {
        console.log('FIRST FEW COORDS:', r.boundary_geojson.coordinates[0].slice(0, 3));
      }
    }
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

test();
