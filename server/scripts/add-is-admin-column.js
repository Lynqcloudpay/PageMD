/**
 * Add is_admin column to users table if it doesn't exist
 * 
 * This script ensures the is_admin column exists in the users table
 * to support admin privileges without changing the user's primary role.
 * 
 * Usage: node scripts/add-is-admin-column.js
 */

const { Pool } = require('pg');
require('dotenv').config();

// Use DATABASE_URL if available (production/Docker), otherwise use individual env vars
const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_URL.includes('localhost') || process.env.DATABASE_URL.includes('127.0.0.1')
        ? false
        : {
            rejectUnauthorized: false // Allow self-signed certificates
          },
    })
  : new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      database: process.env.DB_NAME || 'paper_emr',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
    });

async function addIsAdminColumn() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    console.log('Checking if is_admin column exists...');
    
    // Check if column exists
    const checkResult = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'is_admin'
    `);

    if (checkResult.rows.length > 0) {
      console.log('✅ Column is_admin already exists');
      await client.query('COMMIT');
      return;
    }

    console.log('Adding is_admin column to users table...');
    
    // Add is_admin column
    await client.query(`
      ALTER TABLE users 
      ADD COLUMN is_admin BOOLEAN DEFAULT false
    `);

    // Create index for faster queries
    console.log('Creating index on is_admin...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_users_is_admin ON users(is_admin) 
      WHERE is_admin = true
    `);

    // Set is_admin = true for users with Admin role
    console.log('Setting is_admin = true for existing Admin role users...');
    await client.query(`
      UPDATE users 
      SET is_admin = true 
      WHERE role_id IN (SELECT id FROM roles WHERE name = 'Admin' OR name = 'admin')
        AND (is_admin IS NULL OR is_admin = false)
    `);

    await client.query('COMMIT');
    
    console.log('✅ Successfully added is_admin column!');
    console.log('✅ Created index on is_admin');
    console.log('✅ Updated existing Admin role users');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error adding is_admin column:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

addIsAdminColumn()
  .then(() => {
    console.log('\n✅ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Failed:', error);
    process.exit(1);
  });




