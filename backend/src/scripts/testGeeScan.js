const satelliteService = require('../services/satelliteService');
const pool = require('../db/pool');

async function main() {
  const reservoirId = '18d10020-9ec7-4735-b251-dc5329b63ecc';
  
  try {
    console.log('=== TEST 1: Running simulated dry-season GEE scan (Feb 15) ===');
    const resultDry = await satelliteService.analyzeReservoir(reservoirId, '2026-02-15', 'gee');
    console.log('Dry Scan Result:', JSON.stringify(resultDry, null, 2));

    console.log('\n=== TEST 2: Running simulated wet-season GEE scan (Aug 15) ===');
    const resultWet = await satelliteService.analyzeReservoir(reservoirId, '2026-08-15', 'gee');
    console.log('Wet Scan Result:', JSON.stringify(resultWet, null, 2));

    console.log('\n=== Database Analysis Entries ===');
    const analyses = await pool.query(
      `SELECT capture_date, water_surface_area, change_percentage, season, compare_mode, baseline_area_m2
       FROM satellite_analysis
       WHERE reservoir_id = $1
       ORDER BY capture_date DESC`,
      [reservoirId]
    );
    analyses.rows.forEach(r => {
      console.log(`Date: ${r.capture_date.toISOString().split('T')[0]} | Season: ${r.season} | Area: ${r.water_surface_area.toFixed(1)} m2 | Change: ${r.change_percentage.toFixed(2)}% | Mode: ${r.compare_mode} | Baseline: ${r.baseline_area_m2 ? r.baseline_area_m2.toFixed(1) : 'N/A'}`);
    });

    process.exit(0);
  } catch (err) {
    console.error('Error during test:', err.stack || err.message || err);
    process.exit(1);
  }
}

main();
