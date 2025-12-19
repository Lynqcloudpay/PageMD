/**
 * Fix User Role and Admin Status
 * Usage: node scripts/fix-user-role-admin.js <email>
 */

const { Pool } = require('pg');
require('dotenv').config();

const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_URL.includes('localhost') || process.env.DATABASE_URL.includes('127.0.0.1')
        ? false
        : { rejectUnauthorized: false },
    })
  : new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      database: process.env.DB_NAME || 'paper_emr',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
    });

async function fixUserRoleAdmin(email) {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

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

    // Find Physician role
    const roleResult = await client.query(
      `SELECT id, name FROM roles 
       WHERE LOWER(name) IN ('physician', 'doctor', 'md') 
       OR name = 'Physician'
       ORDER BY name
       LIMIT 1`
    );

    if (roleResult.rows.length === 0) {
      console.error(`❌ Physician role not found!`);
      console.log(`\nAvailable roles:`);
      const allRoles = await client.query(`SELECT name FROM roles ORDER BY name`);
      allRoles.rows.forEach(r => console.log(`  - ${r.name}`));
      process.exit(1);
    }

    const physicianRole = roleResult.rows[0];
    console.log(`\nFound Physician role: ${physicianRole.name} (ID: ${physicianRole.id})`);

    // Update the user
    console.log(`\nUpdating user:`);
    console.log(`  Role: ${user.role_name || 'None'} → ${physicianRole.name}`);
    console.log(`  Admin privileges: ${user.is_admin ? 'Already set' : 'Will be set to true'}`);
    
    await client.query(
      `UPDATE users 
       SET role_id = $1, is_admin = true, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [physicianRole.id, user.id]
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
    console.log(`  Role: ${updatedUser.role_name} (role_id: ${updatedUser.role_id})`);
    console.log(`  is_admin: ${updatedUser.is_admin}`);
    console.log(`\nThe user now has:`);
    console.log(`  ✅ ${updatedUser.role_name} role privileges`);
    console.log(`  ✅ Admin privileges (can manage users, roles, settings, etc.)`);
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error updating user:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Get email from command line arguments
const email = process.argv[2] || 'meljrodriguez14@gmail.com';

fixUserRoleAdmin(email)
  .then(() => {
    console.log('\n✅ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Failed:', error.message);
    process.exit(1);
  });

