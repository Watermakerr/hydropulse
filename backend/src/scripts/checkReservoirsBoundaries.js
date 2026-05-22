const pool = require('../db/pool');

async function main() {
  try {
    const res = await pool.query(`
      SELECT id, name, status, created_at, 
             ST_AsGeoJSON(boundary)::json as boundary_geom
      FROM reservoirs
    `);
    console.log('--- Reservoirs Boundaries ---');
    res.rows.forEach((row, idx) => {
      console.log(`\n#${idx+1}: ID: ${row.id}`);
      console.log(`Name: ${row.name}`);
      console.log(`Created: ${row.created_at}`);
      if (row.boundary_geom) {
        console.log(`Boundary Type: ${row.boundary_geom.type}`);
        if (row.boundary_geom.type === 'Polygon') {
          console.log(`Boundary Coordinates Count: ${row.boundary_geom.coordinates[0].length}`);
        } else if (row.boundary_geom.type === 'MultiPolygon') {
          console.log(`Boundary Polygon Count: ${row.boundary_geom.coordinates.length}`);
        }
      } else {
        console.log('Boundary Geom: NULL');
      }
    });
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

main();
