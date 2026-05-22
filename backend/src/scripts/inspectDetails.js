const pool = require('../db/pool');

async function main() {
  try {
    console.log('=== MARKERS ===');
    const markers = await pool.query('SELECT id, reservoir_id, code, name, ST_AsText(location) as loc_text FROM boundary_markers');
    markers.rows.forEach(r => {
      console.log(`Marker: ID: ${r.id} | ResID: ${r.reservoir_id} | Code: ${r.code} | Name: ${r.name} | Loc: ${r.loc_text}`);
    });

    console.log('\n=== TASKS ===');
    const tasks = await pool.query('SELECT id, reservoir_id, title, status FROM tasks');
    tasks.rows.forEach(r => {
      console.log(`Task: ID: ${r.id} | ResID: ${r.reservoir_id} | Title: ${r.title} | Status: ${r.status}`);
    });

    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

main();
