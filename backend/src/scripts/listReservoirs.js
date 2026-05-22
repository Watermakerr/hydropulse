const pool = require('../db/pool');

async function main() {
  try {
    const res = await pool.query('SELECT id, name, status, created_at FROM reservoirs');
    console.log('--- Reservoirs ---');
    for (const row of res.rows) {
      const bounds = await pool.query('SELECT count(*) FROM shoreline_boundaries WHERE reservoir_id = $1', [row.id]);
      const plans = await pool.query('SELECT count(*) FROM survey_plans WHERE reservoir_id = $1', [row.id]);
      console.log(`ID: ${row.id} | Name: ${row.name} | Status: ${row.status} | Created: ${row.created_at} | Boundaries: ${bounds.rows[0].count} | Plans: ${plans.rows[0].count}`);
    }
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

main();
