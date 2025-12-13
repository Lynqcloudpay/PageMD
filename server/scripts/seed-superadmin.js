/**
 * Seed SuperAdmin User Script
 * 
 * Creates a SuperAdmin user with full system privileges.
 * This user has access to all system-level operations.
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

// SuperAdmin credentials
const SUPERADMIN_EMAIL = process.env.SUPERADMIN_EMAIL || 'superadmin@clinic.com';
const SUPERADMIN_PASSWORD = process.env.SUPERADMIN_PASSWORD || 'SuperAdmin2025!';
const SUPERADMIN_FIRST_NAME = process.env.SUPERADMIN_FIRST_NAME || 'Super';
const SUPERADMIN_LAST_NAME = process.env.SUPERADMIN_LAST_NAME || 'Admin';

async function seedSuperAdmin() {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');
        console.log('🚀 Setting up SuperAdmin account...\n');

        // 1. Get SuperAdmin role ID
        const roleResult = await client.query("SELECT id FROM roles WHERE name = 'SuperAdmin'");
        if (roleResult.rows.length === 0) {
            throw new Error('SuperAdmin role not found. Please run migrate-hipaa-security.js first.');
        }
        const superAdminRoleId = roleResult.rows[0].id;
        console.log(`✅ Found SuperAdmin role ID: ${superAdminRoleId}`);

        // 2. Check if old 'role' column exists
        const roleColumnExists = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'users' 
        AND column_name = 'role'
      )
    `);
        const hasOldRoleColumn = roleColumnExists.rows[0].exists;

        // 3. Check if SuperAdmin account already exists
        const existingSuperAdmin = await client.query('SELECT id FROM users WHERE email = $1', [SUPERADMIN_EMAIL]);
        let superAdminUserId;

        if (existingSuperAdmin.rows.length > 0) {
            // Update existing SuperAdmin account
            console.log('👤 Updating existing SuperAdmin account...');
            superAdminUserId = existingSuperAdmin.rows[0].id;
            const passwordHash = await bcrypt.hash(SUPERADMIN_PASSWORD, 12);

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
        `, [passwordHash, SUPERADMIN_FIRST_NAME, SUPERADMIN_LAST_NAME, superAdminRoleId, 'active', 'Administrator', 'SuperAdmin', 'admin', superAdminUserId]);
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
        `, [passwordHash, SUPERADMIN_FIRST_NAME, SUPERADMIN_LAST_NAME, superAdminRoleId, 'active', 'Administrator', 'SuperAdmin', superAdminUserId]);
            }
            console.log(`✅ SuperAdmin account updated!\n`);
        } else {
            // Create new SuperAdmin account
            console.log('👤 Creating SuperAdmin account...');
            const passwordHash = await bcrypt.hash(SUPERADMIN_PASSWORD, 12);

            const insertResult = await client.query(`
        INSERT INTO users (
          email, password_hash, first_name, last_name, role_id, status,
          date_created, professional_type, credentials${hasOldRoleColumn ? ', role' : ''}
        )
        VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, $7, $8${hasOldRoleColumn ? ', $9' : ''})
        RETURNING id, email, first_name, last_name, status
      `, hasOldRoleColumn ? [
                SUPERADMIN_EMAIL,
                passwordHash,
                SUPERADMIN_FIRST_NAME,
                SUPERADMIN_LAST_NAME,
                superAdminRoleId,
                'active',
                'Administrator',
                'SuperAdmin',
                'admin' // Old role column value (treated as admin for backward compat)
            ] : [
                SUPERADMIN_EMAIL,
                passwordHash,
                SUPERADMIN_FIRST_NAME,
                SUPERADMIN_LAST_NAME,
                superAdminRoleId,
                'active',
                'Administrator',
                'SuperAdmin'
            ]);

            superAdminUserId = insertResult.rows[0].id;
            console.log(`✅ SuperAdmin account created!\n`);
        }

        await client.query('COMMIT');

        // Display credentials
        console.log('═══════════════════════════════════════════════════════════');
        console.log('📋 SUPERADMIN CREDENTIALS');
        console.log('═══════════════════════════════════════════════════════════');
        console.log(`Email:    ${SUPERADMIN_EMAIL}`);
        console.log(`Password: ${SUPERADMIN_PASSWORD}`);
        console.log(`Name:     ${SUPERADMIN_FIRST_NAME} ${SUPERADMIN_LAST_NAME}`);
        console.log(`Role:     SuperAdmin (Full System Access + System Operations)`);
        console.log('═══════════════════════════════════════════════════════════\n');

        console.log('⚠️  IMPORTANT SECURITY NOTES:');
        console.log('   1. Change the password immediately after first login');
        console.log('   2. Store credentials securely (password manager)');
        console.log('   3. Never share SuperAdmin credentials');
        console.log('   4. SuperAdmin can perform system-level operations (key rotation, backup/restore)\n');

        console.log('✅ SuperAdmin setup complete!\n');

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Error setting up SuperAdmin:', error);
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

if (require.main === module) {
    seedSuperAdmin()
        .then(() => {
            process.exit(0);
        })
        .catch((error) => {
            console.error('Setup failed:', error);
            process.exit(1);
        });
}

module.exports = { seedSuperAdmin };
