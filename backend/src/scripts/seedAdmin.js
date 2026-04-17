const bcrypt = require('bcryptjs');
const pool = require('../db/pool');

async function main() {
  const email = process.env.ADMIN_EMAIL || 'admin@hydropulse.vn';
  const password = process.env.ADMIN_PASSWORD || 'Admin@123456';
  const fullName = process.env.ADMIN_FULL_NAME || 'System Admin';

  const passwordHash = await bcrypt.hash(password, 10);

  const result = await pool.query(
    `INSERT INTO users (full_name, email, password_hash, role)
     VALUES ($1, $2, $3, 'admin')
     ON CONFLICT (email)
     DO UPDATE SET full_name = EXCLUDED.full_name
     RETURNING id, full_name, email, role`,
    [fullName, email, passwordHash]
  );

  console.log('Seeded admin:', result.rows[0]);
  await pool.end();
}

main().catch(async (error) => {
  console.error(error);
  await pool.end();
  process.exit(1);
});
