/**
 * Migration: Add is_admin field to users table
 * 
 * This allows users to have admin privileges regardless of their role.
 * For example, a Physician can have admin privileges while remaining a Physician.
 */

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'paper_emr',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

async function migrate() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    console.log('Adding is_admin field to users table...');
    
    // Add is_admin column
    await client.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false
    `);

    // Create index for faster queries
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_users_is_admin ON users(is_admin) 
      WHERE is_admin = true
    `);

    // Migrate existing Admin role users to have is_admin = true
    console.log('Migrating existing Admin role users to is_admin flag...');
    await client.query(`
      UPDATE users 
      SET is_admin = true 
      WHERE role_id IN (SELECT id FROM roles WHERE name = 'Admin')
        AND (is_admin IS NULL OR is_admin = false)
    `);

    await client.query('COMMIT');
    console.log('✅ Migration completed successfully');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

if (require.main === module) {
  migrate()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = migrate;





