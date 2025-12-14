/**
 * Grant Admin Privileges to a Physician User
 * 
 * This script grants admin privileges to a user without changing their role.
 * The user keeps their current role (e.g., Physician) but gains admin access.
 * 
 * Usage: node server/scripts/grant-admin-to-physician.js <email>
 * Example: node server/scripts/grant-admin-to-physician.js mjrodriguez14@live.com
 */

const { Pool } = require('pg');
require('dotenv').config({ path: '../.env' });

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'paper_emr',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

async function grantAdminToPhysician(email) {
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

    if (user.is_admin === true) {
      console.log(`\n✅ User already has admin privileges!`);
      await client.query('COMMIT');
      return;
    }

    // Grant admin privileges (set is_admin = true) without changing role_id
    console.log(`\nGranting admin privileges (keeping ${user.role_name} role)...`);
    
    await client.query(
      `UPDATE users 
       SET is_admin = true, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [user.id]
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

    console.log(`\n✅ Successfully granted admin privileges!`);
    console.log(`\nUpdated user:`);
    console.log(`  ID: ${updatedUser.id}`);
    console.log(`  Name: ${updatedUser.first_name} ${updatedUser.last_name}`);
    console.log(`  Email: ${updatedUser.email}`);
    console.log(`  Role: ${updatedUser.role_name} (role_id: ${updatedUser.role_id}) - KEPT`);
    console.log(`  is_admin: ${updatedUser.is_admin} - GRANTED`);
    console.log(`\nThe user now has:`);
    console.log(`  ✅ Admin privileges (can manage users, roles, settings, etc.)`);
    console.log(`  ✅ ${updatedUser.role_name} role privileges (clinical access preserved)`);
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error granting admin privileges:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Get email from command line arguments
const email = process.argv[2];

if (!email) {
  console.error('Usage: node server/scripts/grant-admin-to-physician.js <email>');
  console.error('Example: node server/scripts/grant-admin-to-physician.js mjrodriguez14@live.com');
  process.exit(1);
}

// Run the script
grantAdminToPhysician(email)
  .then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });

