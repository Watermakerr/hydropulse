const pool = require('../db/pool');

async function main() {
  try {
    const id = '18d10020-9ec7-4735-b251-dc5329b63ecc';
    console.log(`=== Shorelines for Reservoir: ${id} ===`);
    
    const res = await pool.query(
      `SELECT id, boundary_type, season, source, capture_date, is_current, 
              ST_GeometryType(boundary) as geom_type,
              ST_AsGeoJSON(boundary)::json AS boundary_geojson
       FROM shoreline_boundaries 
       WHERE reservoir_id = $1`, 
      [id]
    );
    
    for (const row of res.rows) {
      console.log(`\n- ID: ${row.id}`);
      console.log(`  Type: ${row.boundary_type}, Season: ${row.season}, Source: ${row.source}`);
      console.log(`  Is Current: ${row.is_current}, Geometry Type: ${row.geom_type}`);
      if (row.boundary_geojson) {
        console.log(`  GeoJSON Type: ${row.boundary_geojson.type}`);
        const coords = row.boundary_geojson.coordinates;
        console.log(`  Coordinates dimensions: ${Array.isArray(coords) ? coords.length : 'not array'}`);
        if (Array.isArray(coords) && coords[0]) {
          console.log(`  Outer ring length: ${coords[0].length}`);
        }
      } else {
        console.log(`  GeoJSON is NULL`);
      }
    }
    
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

main();
