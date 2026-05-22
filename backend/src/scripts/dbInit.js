const fs = require('fs');
const path = require('path');

const pool = require('../db/pool');

async function runSqlFile(fileName) {
  const filePath = path.join(__dirname, '../../sql', fileName);
  const sql = fs.readFileSync(filePath, 'utf-8');
  await pool.query(sql);
  console.log(`Applied ${fileName}`);
}

async function main() {
  const sqlDir = path.join(__dirname, '../../sql');
  const files = fs.readdirSync(sqlDir)
    .filter(file => file.endsWith('.sql'))
    .sort();

  for (const file of files) {
    await runSqlFile(file);
  }

  await pool.end();
  console.log('Database initialization completed');
}

main().catch(async (error) => {
  console.error('Database initialization failed:', error.message);
  await pool.end();
  process.exit(1);
});
