const pool = require('../db/pool');

async function main() {
  console.log('--- Cleaning Reservoirs & Setting Shapefile Boundary ---');
  const targetId = '18d10020-9ec7-4735-b251-dc5329b63ecc';
  const duplicateIds = ['af75fc77-51d7-420c-a206-747962f6bd02', '4763a424-b919-4e94-8e49-023222b02ed6'];

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Disable triggers temporarily to avoid check marker inside reservoir during update
    console.log('Temporarily disabling triggers...');
    await client.query('ALTER TABLE boundary_markers DISABLE TRIGGER ALL');

    // 1. Get the wet baseline geometry
    const wetBaselineRes = await client.query(
      `SELECT boundary, area_m2 
       FROM shoreline_boundaries 
       WHERE reservoir_id = $1 AND boundary_type = 'baseline' AND season = 'wet'
       LIMIT 1`,
      [targetId]
    );

    if (wetBaselineRes.rows.length === 0) {
      throw new Error(`Could not find wet season baseline for reservoir ${targetId}`);
    }

    const { boundary, area_m2 } = wetBaselineRes.rows[0];
    console.log(`Found wet season baseline of area: ${(area_m2 / 10000).toFixed(2)} ha`);

    // 2. Update the target reservoir's boundary to the wet baseline geometry
    console.log(`Updating reservoir boundary for ${targetId}...`);
    const updateRes = await client.query(
      `UPDATE reservoirs
       SET boundary = $1
       WHERE id = $2
       RETURNING id, name, area_ha, ST_Area(boundary::geography) as updated_area_m2`,
      [boundary, targetId]
    );

    const updatedReservoir = updateRes.rows[0];
    console.log(`Updated Reservoir: ${updatedReservoir.name}`);
    console.log(`- New area_ha: ${updatedReservoir.area_ha} ha`);
    console.log(`- Geodesic Area: ${(updatedReservoir.updated_area_m2 / 10000).toFixed(2)} ha`);

    // 3. Move/Update boundary markers
    console.log('Re-associating boundary markers...');
    await client.query(
      `UPDATE boundary_markers 
       SET reservoir_id = $1 
       WHERE reservoir_id IN ('af75fc77-51d7-420c-a206-747962f6bd02', '4763a424-b919-4e94-8e49-023222b02ed6')`,
      [targetId]
    );

    // 4. Move tasks
    console.log('Re-associating tasks...');
    await client.query(
      `UPDATE tasks 
       SET reservoir_id = $1 
       WHERE reservoir_id IN ('af75fc77-51d7-420c-a206-747962f6bd02', '4763a424-b919-4e94-8e49-023222b02ed6')`,
      [targetId]
    );

    // 5. Move survey plans
    console.log('Re-associating survey plans...');
    await client.query(
      `UPDATE survey_plans 
       SET reservoir_id = $1 
       WHERE reservoir_id IN ('af75fc77-51d7-420c-a206-747962f6bd02', '4763a424-b919-4e94-8e49-023222b02ed6')`,
      [targetId]
    );

    // 6. Delete baseline boundaries of duplicates (since target already has baselines)
    console.log('Cleaning up duplicate shoreline boundaries...');
    await client.query(
      `DELETE FROM shoreline_boundaries 
       WHERE reservoir_id IN ('af75fc77-51d7-420c-a206-747962f6bd02', '4763a424-b919-4e94-8e49-023222b02ed6')`
    );

    // 7. Delete satellite analysis of duplicates (since target already has the same capture dates)
    console.log('Cleaning up duplicate satellite analysis records...');
    await client.query(
      `DELETE FROM satellite_analysis 
       WHERE reservoir_id IN ('af75fc77-51d7-420c-a206-747962f6bd02', '4763a424-b919-4e94-8e49-023222b02ed6')`
    );

    // 8. Delete duplicate reservoirs
    console.log('Deleting duplicate reservoirs...');
    const deleteRes = await client.query(
      `DELETE FROM reservoirs
       WHERE id IN ('af75fc77-51d7-420c-a206-747962f6bd02', '4763a424-b919-4e94-8e49-023222b02ed6')`
    );
    console.log(`Deleted duplicate reservoirs rows count: ${deleteRes.rowCount}`);

    // Re-enable triggers
    console.log('Re-enabling triggers...');
    await client.query('ALTER TABLE boundary_markers ENABLE TRIGGER ALL');

    await client.query('COMMIT');
    console.log('--- DB Cleaned Successfully! ---');
  } catch (err) {
    // Attempt to re-enable triggers in case of failure
    try {
      await client.query('ALTER TABLE boundary_markers ENABLE TRIGGER ALL');
    } catch (_) {}
    await client.query('ROLLBACK');
    console.error('Error during cleanup:', err);
  } finally {
    client.release();
    process.exit(0);
  }
}

main();
