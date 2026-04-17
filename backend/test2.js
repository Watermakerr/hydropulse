require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool();

async function run() {
  const geojson = { type: 'Polygon', coordinates: [[[106.3, 11.3], [106.4, 11.3], [106.4, 11.4], [106.3, 11.4], [106.3, 11.3]]] };
  const res = await pool.query('INSERT INTO reservoirs (name, description, status, boundary, created_by) VALUES ($1, $2, $3, ST_SetSRID(ST_GeomFromGeoJSON($4),4326), $5) RETURNING id', ['Hồ Dầu Tiếng (Tây Ninh)', 'Hồ nằm ở miền Nam nên ít mây sương mù hơn', 'active', JSON.stringify(geojson), 'c0406ad9-e21b-4a93-9575-660dde3426b5']);
  console.log('Added: ' + res.rows[0].id);
  
  process.exit(0);
}
run().catch(e => { console.error(e); process.exit(1); });
