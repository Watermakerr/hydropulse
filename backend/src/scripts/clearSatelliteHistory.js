const pool = require('../db/pool');

async function main() {
  try {
    console.log('=== CLEARING OLD SATELLITE SCANS ===');
    
    // 1. Delete from satellite_analysis (foreign key dependency first)
    const analysisRes = await pool.query('DELETE FROM satellite_analysis');
    console.log(`- Deleted ${analysisRes.rowCount} records from "satellite_analysis" table.`);
    
    // 2. Delete from shoreline_boundaries where boundary_type = 'scan'
    // Keep 'baseline' boundaries so you can still run comparisons!
    const shorelineRes = await pool.query(
      "DELETE FROM shoreline_boundaries WHERE boundary_type = 'scan'"
    );
    console.log(`- Deleted ${shorelineRes.rowCount} records from "shoreline_boundaries" (where type = 'scan').`);
    
    // 3. Reset any active is_current flag on other boundaries if needed (usually none for scans since we deleted them)
    console.log('=== DB CLEANUP COMPLETE ===');
    process.exit(0);
  } catch (err) {
    console.error('Error during cleanup:', err.message);
    process.exit(1);
  }
}

main();
