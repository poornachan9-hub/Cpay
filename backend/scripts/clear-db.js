const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function clearDatabase() {
  console.log('🧹 Clearing database tables...');
  try {
    // Truncate kyc_records first due to foreign key constraint
    await pool.query('TRUNCATE TABLE kyc_records CASCADE');
    await pool.query('TRUNCATE TABLE users CASCADE');
    console.log('✅ Database cleared successfully!');
  } catch (err) {
    console.error('❌ Failed to clear database:', err.message);
  } finally {
    await pool.end();
  }
}

clearDatabase();
