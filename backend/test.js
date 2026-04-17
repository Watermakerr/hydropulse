
require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool();
async function run() {
  const geojson = { type: 'Polygon', coordinates: [[[106.3, 11.3], [106.4, 11.3], [106.4, 11.4], [106.3, 11.4], [106.3, 11.3]]] };
  const res = await pool.query('INSERT INTO reservoirs (name, description, status, boundary_geojson) VALUES (\, \, \, \) RETURNING id', ['H? D?u Ti?ng (Tây Ninh)', 'Test clear sky in the south', 'active', JSON.stringify(geojson)]);
  console.log('Added: ' + res.rows[0].id);
  process.exit(0);
}
run().catch(console.error);

