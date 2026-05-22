const pool = require('../db/pool');

async function main() {
  try {
    const id = '18d10020-9ec7-4735-b251-dc5329b63ecc';
    console.log(`=== Satellite Analysis for Reservoir: ${id} ===`);
    
    const res = await pool.query(
      `SELECT id, capture_date, season, alert_level, change_percentage, boundary_id, 
              compare_mode, raw_response 
       FROM satellite_analysis 
       WHERE reservoir_id = $1
       ORDER BY capture_date DESC`, 
      [id]
    );
    
    for (const row of res.rows) {
      console.log(`\n- ID: ${row.id}`);
      console.log(`  Date: ${row.capture_date}, Season: ${row.season}`);
      console.log(`  Alert Level: ${row.alert_level}, Change %: ${row.change_percentage}`);
      console.log(`  Boundary ID: ${row.boundary_id}, Compare Mode: ${row.compare_mode}`);
      console.log(`  Raw Response: ${JSON.stringify(row.raw_response)}`);
    }
    
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

main();
