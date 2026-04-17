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
  await runSqlFile('001_init.sql');

  const migration2 = path.join(__dirname, '../../sql/002_add_supporting_indexes.sql');
  if (fs.existsSync(migration2)) {
    await runSqlFile('002_add_supporting_indexes.sql');
  }

  await pool.end();
  console.log('Database initialization completed');
}

main().catch(async (error) => {
  console.error('Database initialization failed:', error.message);
  await pool.end();
  process.exit(1);
});
