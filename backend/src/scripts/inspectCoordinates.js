const pool = require('../db/pool');

async function main() {
  try {
    const id = '18d10020-9ec7-4735-b251-dc5329b63ecc';
    
    const res = await pool.query(
      `SELECT ST_AsGeoJSON(boundary)::json AS boundary_geojson
       FROM shoreline_boundaries 
       WHERE reservoir_id = $1 LIMIT 1`, 
      [id]
    );
    
    const geom = res.rows[0].boundary_geojson;
    console.log('Type of geom:', typeof geom);
    console.log('Geom properties:', Object.keys(geom));
    console.log('Geom Type:', geom.type);
    console.log('Coordinates is array:', Array.isArray(geom.coordinates));
    console.log('Coordinates length:', geom.coordinates.length);
    console.log('First coord outer ring:', geom.coordinates[0][0]);
    console.log('First coord outer ring types:', geom.coordinates[0][0].map(x => typeof x));
    
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

main();
