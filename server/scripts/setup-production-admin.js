/**
 * Production Admin Setup Script
 * 
 * Deletes all mock/test accounts and creates a production admin account
 * Run this once to set up your production environment
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

// Production admin credentials
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@clinic.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Admin@2025!Secure';
const ADMIN_FIRST_NAME = process.env.ADMIN_FIRST_NAME || 'System';
const ADMIN_LAST_NAME = process.env.ADMIN_LAST_NAME || 'Administrator';

async function setupProductionAdmin() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    console.log('🚀 Setting up production admin account...\n');

    // 1. Get Admin role ID
    const roleResult = await client.query("SELECT id FROM roles WHERE name = 'Admin'");
    if (roleResult.rows.length === 0) {
      throw new Error('Admin role not found. Please run migrate-rbac.js first.');
    }
    const adminRoleId = roleResult.rows[0].id;

    // 2. Check if admin account already exists
    const existingAdmin = await client.query('SELECT id FROM users WHERE email = $1', [ADMIN_EMAIL]);
    let adminUserId;
    
    if (existingAdmin.rows.length > 0) {
      // Update existing admin account
      console.log('👤 Updating existing admin account...');
      adminUserId = existingAdmin.rows[0].id;
      const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);
      
      // Check if old 'role' column exists
      const roleColumnExists = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.columns 
          WHERE table_schema = 'public' 
          AND table_name = 'users' 
          AND column_name = 'role'
        )
      `);
      
      const hasOldRoleColumn = roleColumnExists.rows[0].exists;
      
      if (hasOldRoleColumn) {
        await client.query(`
          UPDATE users 
          SET password_hash = $1, 
              first_name = $2, 
              last_name = $3, 
              role_id = $4, 
              status = $5,
              professional_type = $6,
              credentials = $7,
              role = $8
          WHERE id = $9
        `, [passwordHash, ADMIN_FIRST_NAME, ADMIN_LAST_NAME, adminRoleId, 'active', 'Administrator', 'Admin', 'admin', adminUserId]);
      } else {
        await client.query(`
          UPDATE users 
          SET password_hash = $1, 
              first_name = $2, 
              last_name = $3, 
              role_id = $4, 
              status = $5,
              professional_type = $6,
              credentials = $7
          WHERE id = $8
        `, [passwordHash, ADMIN_FIRST_NAME, ADMIN_LAST_NAME, adminRoleId, 'active', 'Administrator', 'Admin', adminUserId]);
      }
      console.log(`✅ Admin account updated!\n`);
    } else {
      // Create new admin account
      console.log('👤 Creating production admin account...');
      const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);
      
      // Check if old 'role' column exists
      const roleColumnExists = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.columns 
          WHERE table_schema = 'public' 
          AND table_name = 'users' 
          AND column_name = 'role'
        )
      `);
      
      const hasOldRoleColumn = roleColumnExists.rows[0].exists;
      
      const insertResult = await client.query(`
        INSERT INTO users (
          email, password_hash, first_name, last_name, role_id, status,
          date_created, professional_type, credentials${hasOldRoleColumn ? ', role' : ''}
        )
        VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, $7, $8${hasOldRoleColumn ? ', $9' : ''})
        RETURNING id, email, first_name, last_name, status
      `, hasOldRoleColumn ? [
        ADMIN_EMAIL,
        passwordHash,
        ADMIN_FIRST_NAME,
        ADMIN_LAST_NAME,
        adminRoleId,
        'active',
        'Administrator',
        'Admin',
        'admin' // Old role column value
      ] : [
        ADMIN_EMAIL,
        passwordHash,
        ADMIN_FIRST_NAME,
        ADMIN_LAST_NAME,
        adminRoleId,
        'active',
        'Administrator',
        'Admin'
      ]);

      adminUserId = insertResult.rows[0].id;
      console.log(`✅ Production admin account created!\n`);
    }

    // 3. Reassign foreign key references to admin user
    console.log('🔄 Reassigning foreign key references to admin user...');
    
    // Get all existing user IDs (except the new admin)
    const existingUsers = await client.query('SELECT id FROM users WHERE id != $1', [adminUserId]);
    const existingUserIds = existingUsers.rows.map(u => u.id);
    
    if (existingUserIds.length > 0) {
      // Update foreign key references
      const updateQueries = [
        { table: 'patients', column: 'primary_care_provider' },
        { table: 'visits', column: 'provider_id' },
        { table: 'visits', column: 'note_signed_by' },
        { table: 'orders', column: 'ordered_by' },
        { table: 'documents', column: 'uploader_id' },
        { table: 'prescriptions', column: 'prescriber_id' },
        { table: 'prescriptions', column: 'created_by' },
        { table: 'medications', column: 'prescriber_id' },
        { table: 'referrals', column: 'referring_provider_id' },
        { table: 'referrals', column: 'created_by' },
        { table: 'messages', column: 'sender_id' },
        { table: 'messages', column: 'recipient_id' },
        { table: 'messages', column: 'from_user_id' },
        { table: 'messages', column: 'to_user_id' },
        { table: 'audit_logs', column: 'user_id' },
        { table: 'role_privileges', column: 'granted_by' },
        { table: 'appointments', column: 'provider_id' },
        { table: 'appointments', column: 'created_by' },
        { table: 'claims', column: 'created_by' },
        { table: 'sessions', column: 'user_id' },
        { table: 'user_preferences', column: 'user_id' },
        { table: 'form_encounters', column: 'created_by' },
      ];

      for (const { table, column } of updateQueries) {
        try {
          // Check if table and column exist
          const tableExists = await client.query(`
            SELECT EXISTS (
              SELECT FROM information_schema.tables 
              WHERE table_schema = 'public' AND table_name = $1
            )
          `, [table]);
          
          if (tableExists.rows[0].exists) {
            const columnExists = await client.query(`
              SELECT EXISTS (
                SELECT FROM information_schema.columns 
                WHERE table_schema = 'public' 
                AND table_name = $1 
                AND column_name = $2
              )
            `, [table, column]);
            
            if (columnExists.rows[0].exists) {
              const result = await client.query(`
                UPDATE ${table} 
                SET ${column} = $1 
                WHERE ${column} = ANY($2::uuid[])
              `, [adminUserId, existingUserIds]);
              if (result.rowCount > 0) {
                console.log(`   Updated ${result.rowCount} record(s) in ${table}.${column}`);
              }
            }
          }
        } catch (error) {
          // Table or column might not exist, skip
          console.log(`   Skipped ${table}.${column} (${error.message})`);
        }
      }
    }
    console.log('');

    // 4. Delete all existing users (mock accounts) - now safe since foreign keys are reassigned
    console.log('🗑️  Deleting all mock user accounts...');
    const deleteResult = await client.query('DELETE FROM users WHERE id != $1 RETURNING email', [adminUserId]);
    console.log(`   Deleted ${deleteResult.rows.length} user(s):`);
    deleteResult.rows.forEach(u => console.log(`   - ${u.email}`));
    console.log('');

    await client.query('COMMIT');

    // Display credentials
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📋 PRODUCTION ADMIN CREDENTIALS');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`Email:    ${ADMIN_EMAIL}`);
    console.log(`Password: ${ADMIN_PASSWORD}`);
    console.log(`Name:     ${ADMIN_FIRST_NAME} ${ADMIN_LAST_NAME}`);
    console.log(`Role:     Admin (Full System Access)`);
    console.log('═══════════════════════════════════════════════════════════\n');
    
    console.log('⚠️  IMPORTANT SECURITY NOTES:');
    console.log('   1. Change the password immediately after first login');
    console.log('   2. Store credentials securely (password manager)');
    console.log('   3. Never share admin credentials');
    console.log('   4. Create additional admin accounts if needed via User Management\n');
    
    console.log('✅ Production setup complete!');
    console.log('   You can now login and create additional users via /users page.\n');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error setting up production admin:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

if (require.main === module) {
  setupProductionAdmin()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error('Setup failed:', error);
      process.exit(1);
    });
}

module.exports = { setupProductionAdmin };

