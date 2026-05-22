const pool = require('../db/pool');

async function main() {
  try {
    const ids = [
      '4763a424-b919-4e94-8e49-023222b02ed6',
      'af75fc77-51d7-420c-a206-747962f6bd02',
      '18d10020-9ec7-4735-b251-dc5329b63ecc'
    ];
    
    console.log('=== TABLE REFERENCE INSPECTION ===');
    for (const id of ids) {
      console.log(`\nChecking ID: ${id}`);
      
      const markers = await pool.query('SELECT count(*) FROM boundary_markers WHERE reservoir_id = $1', [id]);
      const tasks = await pool.query('SELECT count(*) FROM tasks WHERE reservoir_id = $1', [id]);
      const shorelines = await pool.query('SELECT count(*) FROM shoreline_boundaries WHERE reservoir_id = $1', [id]);
      const plans = await pool.query('SELECT count(*) FROM survey_plans WHERE reservoir_id = $1', [id]);
      
      console.log(`- boundary_markers: ${markers.rows[0].count}`);
      console.log(`- tasks: ${tasks.rows[0].count}`);
      console.log(`- shoreline_boundaries: ${shorelines.rows[0].count}`);
      console.log(`- survey_plans: ${plans.rows[0].count}`);
    }
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

main();
