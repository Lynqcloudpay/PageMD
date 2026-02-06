/**
 * Simple Production Admin Creation Script
 * 
 * Creates a production admin account without deleting existing users
 */

const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'paper_emr',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

// Production admin credentials - customize these
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@clinic.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Admin@2025!Secure';
const ADMIN_FIRST_NAME = process.env.ADMIN_FIRST_NAME || 'System';
const ADMIN_LAST_NAME = process.env.ADMIN_LAST_NAME || 'Administrator';

async function createProductionAdmin() {
  try {
    console.log('🚀 Creating production admin account...\n');

    // Check if admin already exists
    const existing = await pool.query('SELECT id, email FROM users WHERE email = $1', [ADMIN_EMAIL]);

    if (existing.rows.length > 0) {
      console.log(`ℹ️  Admin account already exists: ${ADMIN_EMAIL}`);
      console.log('   Updating password...\n');

      const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);

      // Update password (handle both old role column and new role_id)
      const hasRoleColumn = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.columns 
          WHERE table_name = 'users' AND column_name = 'role'
        )
      `);

      if (hasRoleColumn.rows[0].exists) {
        await pool.query(`
          UPDATE users 
          SET password_hash = $1, role = 'admin', active = true
          WHERE email = $2
        `, [passwordHash, ADMIN_EMAIL]);
      } else {
        await pool.query(`
          UPDATE users 
          SET password_hash = $1, active = true
          WHERE email = $2
        `, [passwordHash, ADMIN_EMAIL]);
      }

      console.log('✅ Admin account updated!\n');
    } else {
      console.log('👤 Creating new admin account...\n');

      const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);

      // Check if role_id column exists (new schema) or role column (old schema)
      const hasRoleId = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.columns 
          WHERE table_name = 'users' AND column_name = 'role_id'
        )
      `);

      const hasRoleColumn = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.columns 
          WHERE table_name = 'users' AND column_name = 'role'
        )
      `);

      if (hasRoleId.rows[0].exists) {
        // New schema with role_id - get Admin role ID
        const roleResult = await pool.query("SELECT id FROM roles WHERE name = 'Admin' OR name = 'admin' LIMIT 1");
        if (roleResult.rows.length > 0) {
          await pool.query(`
            INSERT INTO users (email, password_hash, first_name, last_name, role_id, active)
            VALUES ($1, $2, $3, $4, $5, true)
          `, [ADMIN_EMAIL, passwordHash, ADMIN_FIRST_NAME, ADMIN_LAST_NAME, roleResult.rows[0].id]);
        } else {
          // Fallback: use role column if role_id doesn't work
          await pool.query(`
            INSERT INTO users (email, password_hash, first_name, last_name, role, active)
            VALUES ($1, $2, $3, $4, 'admin', true)
          `, [ADMIN_EMAIL, passwordHash, ADMIN_FIRST_NAME, ADMIN_LAST_NAME]);
        }
      } else if (hasRoleColumn.rows[0].exists) {
        // Old schema with role column
        await pool.query(`
          INSERT INTO users (email, password_hash, first_name, last_name, role, active)
          VALUES ($1, $2, $3, $4, 'admin', true)
        `, [ADMIN_EMAIL, passwordHash, ADMIN_FIRST_NAME, ADMIN_LAST_NAME]);
      } else {
        throw new Error('Neither role_id nor role column found in users table');
      }

      console.log('✅ Production admin account created!\n');
    }

    // Display credentials
    console.log('═══════════════════════════════════════════════════════════');
    console.log('PRODUCTION ADMIN CREDENTIALS');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`Email:    ${ADMIN_EMAIL}`);
    console.log(`Password: ${ADMIN_PASSWORD}`);
    console.log(`Name:     ${ADMIN_FIRST_NAME} ${ADMIN_LAST_NAME}`);
    console.log(`Role:     Admin (Full System Access)`);
    console.log('═══════════════════════════════════════════════════════════\n');

    console.log('Production admin setup complete!');
    console.log('\nNext steps:');
    console.log('   1. Login with the credentials above');
    console.log('   2. Change password after first login');
    console.log('   3. Create additional users via User Management\n');

  } catch (error) {
    console.error('Error creating production admin:', error.message);
    throw error;
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  createProductionAdmin()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error('Setup failed:', error);
      process.exit(1);
    });
}

module.exports = { createProductionAdmin };





