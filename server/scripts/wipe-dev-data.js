const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'paper_emr',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

/**
 * Wipe all development data while preserving schema and system configuration
 * 
 * This script will:
 * - Delete all patient data (patients, visits, orders, documents, etc.)
 * - Delete all user data EXCEPT the admin user (or recreate it)
 * - Clear audit logs (optional)
 * - Preserve system configuration (roles, privileges, settings)
 * 
 * WARNING: This is a destructive operation. Use only in development!
 */
async function wipeDevData() {
  const client = await pool.connect();
  
  try {
    console.log('🧹 Starting development data wipe...\n');
    console.log('⚠️  WARNING: This will delete ALL patient data, visits, orders, and non-admin users!\n');
    
    // Step 1: Delete all clinical/patient-related data (child tables first)
    console.log('📋 Step 1: Deleting clinical data...');
    
    const clinicalTables = [
      // Visit-related
      'visit_history',
      'note_history',
      'claim_attachments',
      'claim_denials',
      'claim_line_items',
      'claim_workflow_history',
      'secondary_claims',
      'claims',
      'procedures',
      'prescriptions',
      'prescription_interactions',
      'referrals',
      'orders',
      'prior_authorizations',
      'form_encounters',
      'visits',
      
      // Patient-related
      'patient_portal_access',
      'patient_history',
      'documents',
      'allergies',
      'medications',
      'problems',
      'family_history',
      'social_history',
      'immunizations',
      'appointments',
      'patients',
      
      // Billing-related
      'payment_allocations',
      'payment_postings',
      
      // Messages
      'messages',
      
      // Clinical settings (patient-specific)
      'clinical_alerts',
      'clinical_quality_measures',
    ];
    
    for (const table of clinicalTables) {
      try {
        const result = await client.query(`DELETE FROM ${table}`);
        console.log(`   ✓ Cleared ${table} (${result.rowCount} rows)`);
      } catch (error) {
        if (error.code === '42P01') {
          console.log(`   ⚠  Table ${table} does not exist (skipping)`);
        } else {
          console.error(`   ✗ Error clearing ${table}:`, error.message);
          // Continue with other tables even if one fails
        }
      }
    }
    
    // Step 2: Delete all non-admin users and their related data
    console.log('\n👥 Step 2: Deleting non-admin users...');
    
    // Get admin user ID(s) to preserve (check by role, not is_admin column)
    const adminResult = await client.query(`
      SELECT u.id, u.email FROM users u
      LEFT JOIN roles r ON u.role_id = r.id
      WHERE (r.name = 'Admin' OR r.name = 'admin') OR u.email = $1
    `, [process.env.ADMIN_EMAIL || 'admin@clinic.com']);
    
    const adminIds = adminResult.rows.map(row => row.id);
    const adminEmails = adminResult.rows.map(row => row.email);
    
    if (adminIds.length > 0) {
      console.log(`   ℹ️  Preserving admin user(s): ${adminEmails.join(', ')}`);
    }
    
    // Delete user-related data for non-admin users
    // Handle each table based on its structure
    try {
      // user_mfa, user_preferences, sessions, password_reset_tokens use user_id
      const userIdTables = ['user_mfa', 'user_preferences', 'sessions', 'password_reset_tokens'];
      for (const table of userIdTables) {
        try {
          if (adminIds.length > 0) {
            const result = await client.query(`
              DELETE FROM ${table} 
              WHERE user_id NOT IN (${adminIds.map((_, i) => `$${i + 1}`).join(', ')})
            `, adminIds);
            console.log(`   ✓ Cleared ${table} for non-admin users (${result.rowCount} rows)`);
          } else {
            const result = await client.query(`DELETE FROM ${table}`);
            console.log(`   ✓ Cleared ${table} (${result.rowCount} rows)`);
          }
        } catch (error) {
          if (error.code === '42P01') {
            console.log(`   ⚠  Table ${table} does not exist (skipping)`);
          } else {
            console.error(`   ✗ Error clearing ${table}:`, error.message);
            // Continue with other tables
          }
        }
      }
      
      // login_attempts uses email, not user_id - delete all or by email
      try {
        if (adminEmails.length > 0) {
          const result = await client.query(`
            DELETE FROM login_attempts 
            WHERE email NOT IN (${adminEmails.map((_, i) => `$${i + 1}`).join(', ')})
          `, adminEmails);
          console.log(`   ✓ Cleared login_attempts for non-admin users (${result.rowCount} rows)`);
        } else {
          const result = await client.query('DELETE FROM login_attempts');
          console.log(`   ✓ Cleared login_attempts (${result.rowCount} rows)`);
        }
      } catch (error) {
        if (error.code === '42P01') {
          console.log(`   ⚠  Table login_attempts does not exist (skipping)`);
        } else {
          console.error(`   ✗ Error clearing login_attempts:`, error.message);
        }
      }
    } catch (error) {
      console.error(`   ✗ Error in user-related data cleanup:`, error.message);
    }
    
    // Delete non-admin users
    if (adminIds.length > 0) {
      const result = await client.query(`
        DELETE FROM users 
        WHERE id NOT IN (${adminIds.map((_, i) => `$${i + 1}`).join(', ')})
      `, adminIds);
      console.log(`   ✓ Deleted ${result.rowCount} non-admin user(s)`);
    } else {
      const result = await client.query('DELETE FROM users');
      console.log(`   ✓ Deleted ${result.rowCount} user(s)`);
    }
    
    // Step 3: Clear audit logs (optional - comment out if you want to keep them)
    console.log('\n📝 Step 3: Clearing audit logs...');
    try {
      const result = await client.query('DELETE FROM audit_logs');
      console.log(`   ✓ Cleared audit_logs (${result.rowCount} rows)`);
    } catch (error) {
      console.error(`   ✗ Error clearing audit_logs:`, error.message);
    }
    
    // Step 4: Reset sequences (optional but recommended)
    console.log('\n🔄 Step 4: Resetting sequences...');
    try {
      // Get all sequences
      const sequencesResult = await client.query(`
        SELECT sequence_name 
        FROM information_schema.sequences 
        WHERE sequence_schema = 'public'
      `);
      
      for (const seq of sequencesResult.rows) {
        try {
          await client.query(`ALTER SEQUENCE ${seq.sequence_name} RESTART WITH 1`);
          console.log(`   ✓ Reset ${seq.sequence_name}`);
        } catch (error) {
          console.log(`   ⚠  Could not reset ${seq.sequence_name}: ${error.message}`);
        }
      }
    } catch (error) {
      console.error(`   ✗ Error resetting sequences:`, error.message);
    }
    
    // Step 5: Ensure admin user exists
    console.log('\n👤 Step 5: Ensuring admin user exists...');
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@clinic.com';
    const adminPassword = process.env.ADMIN_PASSWORD || 'Admin@2025!Secure';
    const adminFirstName = process.env.ADMIN_FIRST_NAME || 'System';
    const adminLastName = process.env.ADMIN_LAST_NAME || 'Administrator';
    
    // Get Admin role ID
    const roleResult = await client.query("SELECT id FROM roles WHERE name = 'Admin'");
    if (roleResult.rows.length === 0) {
      throw new Error('Admin role not found. Please run migrations first.');
    }
    const adminRoleId = roleResult.rows[0].id;
    
    // Check if admin exists
    const existingAdmin = await client.query('SELECT id FROM users WHERE email = $1', [adminEmail]);
    
    if (existingAdmin.rows.length > 0) {
      // Update existing admin
      const bcrypt = require('bcryptjs');
      const passwordHash = await bcrypt.hash(adminPassword, 12);
      await client.query(
        `UPDATE users 
         SET password_hash = $1, 
             first_name = $2, 
             last_name = $3, 
             role_id = $4, 
             status = 'active', 
             updated_at = CURRENT_TIMESTAMP
         WHERE email = $5`,
        [passwordHash, adminFirstName, adminLastName, adminRoleId, adminEmail]
      );
      console.log(`   ✓ Updated admin user: ${adminEmail}`);
    } else {
      // Create new admin
      const bcrypt = require('bcryptjs');
      const passwordHash = await bcrypt.hash(adminPassword, 12);
      await client.query(
        `INSERT INTO users (email, password_hash, first_name, last_name, role_id, status, date_created)
         VALUES ($1, $2, $3, $4, $5, 'active', CURRENT_TIMESTAMP)`,
        [adminEmail, passwordHash, adminFirstName, adminLastName, adminRoleId]
      );
      console.log(`   ✓ Created admin user: ${adminEmail}`);
    }
    
    console.log('\n✅ Development data wipe completed successfully!\n');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📋 ADMIN CREDENTIALS');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`Email:    ${adminEmail}`);
    console.log(`Password: ${adminPassword}`);
    console.log('═══════════════════════════════════════════════════════════\n');
    console.log('📝 Next steps:');
    console.log('   1. Login with the admin credentials above');
    console.log('   2. Create new users via User Management');
    console.log('   3. Start adding patients and clinical data\n');
    
  } catch (error) {
    console.error('\n❌ Error during data wipe:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run if called directly
if (require.main === module) {
  wipeDevData()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

module.exports = { wipeDevData };

