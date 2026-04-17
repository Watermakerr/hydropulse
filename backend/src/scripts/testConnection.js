const pool = require('../db/pool');

async function testConnection() {
  console.log('Testing database connection...');
  console.log('Host:', process.env.PGHOST);
  console.log('User:', process.env.PGUSER);
  console.log('Database:', process.env.PGDATABASE);
  
  try {
    const client = await pool.connect();
    console.log('Successfully connected to the database!');
    
    const res = await client.query('SELECT NOW(), version()');
    console.log('Current time from DB:', res.rows[0].now);
    console.log('PostgreSQL version:', res.rows[0].version);
    
    client.release();
    process.exit(0);
  } catch (err) {
    console.error('Error connecting to the database:');
    console.error(err.message);
    if (err.detail) console.error('Detail:', err.detail);
    if (err.hint) console.error('Hint:', err.hint);
    process.exit(1);
  }
}

testConnection();
