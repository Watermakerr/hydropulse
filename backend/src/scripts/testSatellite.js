const pool = require('../db/pool');
const satelliteService = require('../services/satelliteService');

async function test() {
  console.log('=== Testing Planet Satellite Analysis ===');
  console.log(`API Key: ${process.env.PLANET_API_KEY ? '***' + process.env.PLANET_API_KEY.slice(-6) : 'NOT SET'}`);
  console.log('');

  try {
    // 1. Get an active reservoir with geometry
    const res = await pool.query(
      `SELECT id, name, area_ha FROM reservoirs WHERE boundary IS NOT NULL LIMIT 1`
    );

    if (res.rows.length === 0) {
      console.log('No reservoirs with boundary found. Please create one first.');
      await pool.end();
      process.exit(0);
    }

    const reservoir = res.rows[0];
    console.log(`Reservoir: ${reservoir.name} (${reservoir.id})`);
    console.log(`Area: ${reservoir.area_ha} ha`);
    console.log('');

    // 2. Run analysis
    const today = new Date().toISOString().split('T')[0];
    console.log(`Target date: ${today}`);
    console.log('Searching for Sentinel-2 scenes...');
    console.log('');

    const result = await satelliteService.analyzeReservoir(reservoir.id, today);

    console.log('');
    console.log('=== Result ===');
    console.log(JSON.stringify(result, null, 2));

    // 3. Check database
    const dbCheck = await pool.query(
      'SELECT * FROM satellite_analysis WHERE reservoir_id = $1 ORDER BY capture_date DESC LIMIT 3',
      [reservoir.id]
    );
    console.log('');
    console.log(`Database records: ${dbCheck.rows.length}`);
    dbCheck.rows.forEach(row => {
      console.log(`  ${row.capture_date} | Area: ${row.water_surface_area?.toFixed(0)} m² | Change: ${row.change_percentage?.toFixed(1)}% | Alert: ${row.alert_level}`);
    });

    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('');
    console.error('Test failed:');
    if (error.response) {
      console.error(`  HTTP ${error.response.status}:`, JSON.stringify(error.response.data, null, 2));
    } else {
      console.error(' ', error.message);
    }
    await pool.end();
    process.exit(1);
  }
}

test();
