const pool = require('../db/pool');

async function main() {
  const id = '18d10020-9ec7-4735-b251-dc5329b63ecc';
  try {
    const result = await pool.query(
      `WITH wet AS (
         SELECT boundary
         FROM shoreline_boundaries
         WHERE reservoir_id = $1 AND boundary_type = 'baseline' AND season = 'wet'
         ORDER BY created_at DESC
         LIMIT 1
       ),
       dry AS (
         SELECT boundary
         FROM shoreline_boundaries
         WHERE reservoir_id = $1 AND boundary_type = 'baseline' AND season = 'dry'
         ORDER BY created_at DESC
         LIMIT 1
       )
       SELECT ST_AsGeoJSON(ST_Difference(wet.boundary, dry.boundary))::json AS boundary_geojson,
              ST_Area(ST_Difference(wet.boundary, dry.boundary)::geography) AS area_m2
       FROM wet, dry`,
      [id]
    );

    if (!result.rowCount || !result.rows[0].boundary_geojson) {
      console.log('Error: Shoreline boundaries not found or difference is empty.');
    } else {
      const row = result.rows[0];
      console.log('Success! Flood Expansion Zone Found:');
      console.log(`Area: ${row.area_m2.toFixed(2)} m2 (${(row.area_m2 / 10000).toFixed(2)} ha)`);
      console.log(`Geometry Type: ${row.boundary_geojson.type}`);
      if (row.boundary_geojson.coordinates) {
        console.log(`Geometry Parts Count: ${row.boundary_geojson.coordinates.length}`);
      }
    }
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

main();
