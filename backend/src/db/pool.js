const { Pool } = require('pg');
const env = require('../config/env');

const connectionConfig = {
  host: process.env.PGHOST || undefined,
  user: process.env.PGUSER || undefined,
  password: process.env.PGPASSWORD || undefined,
  port: process.env.PGPORT ? Number(process.env.PGPORT) : 5432,
  database: process.env.PGDATABASE || undefined,
  ssl: process.env.PGSSLMODE === 'disable' ? false : { rejectUnauthorized: false }
};

if (!connectionConfig.host && !env.databaseUrl) {
  throw new Error('PGHOST or DATABASE_URL is required');
}

const pool = connectionConfig.host
  ? new Pool(connectionConfig)
  : new Pool({
      connectionString: env.databaseUrl,
      ssl: { rejectUnauthorized: false }
    });

module.exports = pool;
