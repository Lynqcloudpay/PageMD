/**
 * Fix User Role While Preserving Admin Privileges
 * 
 * This script fixes a user's role back to their original role (e.g., Physician)
 * while preserving their admin privileges (is_admin flag).
 * 
 * Usage: node scripts/fix-user-role-preserve-admin.js <email> <targetRoleName>
 * Example: node scripts/fix-user-role-preserve-admin.js meljrodriguez14@live.com Physician
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

async function fixUserRolePreserveAdmin(email, targetRoleName) {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    // Ensure is_admin column exists first
    console.log('Ensuring is_admin column exists...');
    await client.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false
    `);

    console.log(`Looking up user with email: ${email}...`);
    
    // Find the user
    const userResult = await client.query(
      `SELECT u.id, u.email, u.first_name, u.last_name, u.role_id, COALESCE(u.is_admin, false) as is_admin, r.name as role_name
       FROM users u
       LEFT JOIN roles r ON u.role_id = r.id
       WHERE u.email = $1`,
      [email]
    );

    if (userResult.rows.length === 0) {
      console.error(`❌ User with email ${email} not found!`);
      process.exit(1);
    }

    const user = userResult.rows[0];
    console.log(`\nFound user:`);
    console.log(`  ID: ${user.id}`);
    console.log(`  Name: ${user.first_name} ${user.last_name}`);
    console.log(`  Email: ${user.email}`);
    console.log(`  Current Role: ${user.role_name || 'None'} (role_id: ${user.role_id})`);
    console.log(`  Current is_admin: ${user.is_admin || false}`);

    // Find the target role
    const roleResult = await client.query(
      `SELECT id, name FROM roles WHERE name = $1 LIMIT 1`,
      [targetRoleName]
    );

    if (roleResult.rows.length === 0) {
      console.error(`❌ Role "${targetRoleName}" not found!`);
      console.log(`\nAvailable roles:`);
      const allRoles = await client.query(`SELECT name FROM roles ORDER BY name`);
      allRoles.rows.forEach(r => console.log(`  - ${r.name}`));
      process.exit(1);
    }

    const targetRole = roleResult.rows[0];

    if (user.role_id === targetRole.id && user.is_admin === true) {
      console.log(`\n✅ User already has role "${targetRoleName}" and admin privileges`);
      console.log(`\nNo changes needed!`);
      await client.query('COMMIT');
      return;
    }

    // Update the user: set role to target role, preserve is_admin flag
    console.log(`\nUpdating user:`);
    console.log(`  Role: ${user.role_name} → ${targetRoleName}`);
    console.log(`  Admin privileges: ${user.is_admin ? 'Preserving (already set)' : 'Will be set to true'}`);
    
    await client.query(
      `UPDATE users 
       SET role_id = $1, is_admin = COALESCE($2, is_admin, false), updated_at = CURRENT_TIMESTAMP
       WHERE id = $3`,
      [targetRole.id, user.is_admin || true, user.id]
    );

    // Verify the update
    const verifyResult = await client.query(
      `SELECT u.id, u.email, u.first_name, u.last_name, u.role_id, u.is_admin, r.name as role_name
       FROM users u
       LEFT JOIN roles r ON u.role_id = r.id
       WHERE u.id = $1`,
      [user.id]
    );

    const updatedUser = verifyResult.rows[0];

    await client.query('COMMIT');

    console.log(`\n✅ Successfully updated user!`);
    console.log(`\nUpdated user state:`);
    console.log(`  ID: ${updatedUser.id}`);
    console.log(`  Name: ${updatedUser.first_name} ${updatedUser.last_name}`);
    console.log(`  Email: ${updatedUser.email}`);
    console.log(`  Role: ${updatedUser.role_name} (role_id: ${updatedUser.role_id}) - RESTORED`);
    console.log(`  is_admin: ${updatedUser.is_admin} - PRESERVED`);
    console.log(`\nThe user now has:`);
    console.log(`  ✅ ${updatedUser.role_name} role privileges (primary role)`);
    console.log(`  ✅ Admin privileges (secondary - can manage users, roles, settings, etc.)`);
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error updating user:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Get email and role from command line arguments
const email = process.argv[2];
const targetRoleName = process.argv[3];

if (!email || !targetRoleName) {
  console.error('Usage: node scripts/fix-user-role-preserve-admin.js <email> <targetRoleName>');
  console.error('Example: node scripts/fix-user-role-preserve-admin.js meljrodriguez14@live.com Physician');
  process.exit(1);
}

fixUserRolePreserveAdmin(email, targetRoleName)
  .then(() => {
    console.log('\n✅ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Failed:', error);
    process.exit(1);
  });




