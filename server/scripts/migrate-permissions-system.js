/**
 * Migration: Commercial-Grade EMR Permission System
 * 
 * Creates tables for:
 * - permissions (capabilities)
 * - role_permissions (role -> permission mappings)
 * - user_permissions (per-user overrides)
 * - role_scope (scope configuration by role)
 * - audit_log (HIPAA-style audit logging)
 * 
 * Seeds default permissions and role mappings
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

async function migrate() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    console.log('Creating permissions system tables...');

    // Create permissions table
    await client.query(`
      CREATE TABLE IF NOT EXISTS permissions (
        key TEXT PRIMARY KEY,
        description TEXT NOT NULL
      )
    `);
    console.log('✅ Created permissions table');

    // Create role_permissions table
    await client.query(`
      CREATE TABLE IF NOT EXISTS role_permissions (
        role TEXT NOT NULL,
        permission_key TEXT NOT NULL REFERENCES permissions(key) ON DELETE CASCADE,
        PRIMARY KEY (role, permission_key)
      )
    `);
    console.log('✅ Created role_permissions table');

    // Create user_permissions table (per-user overrides)
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_permissions (
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        permission_key TEXT NOT NULL REFERENCES permissions(key) ON DELETE CASCADE,
        allowed BOOLEAN NOT NULL DEFAULT TRUE,
        PRIMARY KEY (user_id, permission_key)
      )
    `);
    console.log('✅ Created user_permissions table');

    // Create role_scope table (scope configuration by role)
    await client.query(`
      CREATE TABLE IF NOT EXISTS role_scope (
        role TEXT PRIMARY KEY,
        schedule_scope TEXT NOT NULL DEFAULT 'CLINIC',
        patient_scope TEXT NOT NULL DEFAULT 'CLINIC',
        CHECK (schedule_scope IN ('CLINIC', 'SELF')),
        CHECK (patient_scope IN ('CLINIC', 'ASSIGNED', 'SELF'))
      )
    `);
    console.log('✅ Created role_scope table');

    // Create audit_log table (HIPAA-style)
    await client.query(`
      CREATE TABLE IF NOT EXISTS audit_log (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
        action TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        entity_id UUID,
        success BOOLEAN NOT NULL,
        ip TEXT,
        user_agent TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    console.log('✅ Created audit_log table');

    // Create indexes
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON role_permissions(role);
      CREATE INDEX IF NOT EXISTS idx_user_permissions_user_id ON user_permissions(user_id);
      CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON audit_log(user_id);
      CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at);
      CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON audit_log(entity_type, entity_id);
    `);
    console.log('✅ Created indexes');

    // Seed permissions
    console.log('Seeding permissions...');
    await client.query(`
      INSERT INTO permissions (key, description) VALUES
      ('patients:view_list', 'View patient list'),
      ('patients:view_chart', 'View patient chart'),
      ('patients:edit_demographics', 'Edit demographics'),
      ('patients:edit_insurance', 'Edit insurance'),
      ('patients:merge', 'Merge duplicate patients'),
      ('patients:delete', 'Delete patients'),
      ('schedule:view', 'View schedule'),
      ('schedule:edit', 'Edit schedule'),
      ('schedule:status_update', 'Update appointment status'),
      ('schedule:assign_provider', 'Assign provider to appointment'),
      ('notes:view', 'View notes'),
      ('notes:create', 'Create notes'),
      ('notes:edit', 'Edit notes'),
      ('notes:sign', 'Sign notes'),
      ('orders:create', 'Create orders'),
      ('meds:prescribe', 'Prescribe medications'),
      ('billing:view', 'View billing'),
      ('billing:edit', 'Edit billing'),
      ('claims:submit', 'Submit claims'),
      ('users:manage', 'Manage users'),
      ('roles:manage', 'Manage roles'),
      ('permissions:manage', 'Manage permissions'),
      ('reports:view', 'View reports'),
      ('audit:view', 'View audit log')
      ON CONFLICT (key) DO NOTHING
    `);
    console.log('✅ Seeded permissions');

    // Seed role_permissions - ADMIN gets all permissions
    console.log('Seeding role permissions...');
    await client.query(`
      INSERT INTO role_permissions (role, permission_key)
      SELECT 'ADMIN', key FROM permissions
      ON CONFLICT (role, permission_key) DO NOTHING
    `);

    // CLINICIAN permissions
    await client.query(`
      INSERT INTO role_permissions (role, permission_key) VALUES
      ('CLINICIAN', 'patients:view_list'),
      ('CLINICIAN', 'patients:view_chart'),
      ('CLINICIAN', 'patients:edit_demographics'),
      ('CLINICIAN', 'schedule:view'),
      ('CLINICIAN', 'schedule:status_update'),
      ('CLINICIAN', 'notes:view'),
      ('CLINICIAN', 'notes:create'),
      ('CLINICIAN', 'notes:edit'),
      ('CLINICIAN', 'notes:sign'),
      ('CLINICIAN', 'billing:view'),
      ('CLINICIAN', 'orders:create'),
      ('CLINICIAN', 'meds:prescribe')
      ON CONFLICT (role, permission_key) DO NOTHING
    `);

    // NURSE_MA permissions
    await client.query(`
      INSERT INTO role_permissions (role, permission_key) VALUES
      ('NURSE_MA', 'patients:view_list'),
      ('NURSE_MA', 'patients:view_chart'),
      ('NURSE_MA', 'patients:edit_demographics'),
      ('NURSE_MA', 'schedule:view'),
      ('NURSE_MA', 'schedule:status_update'),
      ('NURSE_MA', 'notes:view')
      ON CONFLICT (role, permission_key) DO NOTHING
    `);

    // FRONT_DESK permissions
    await client.query(`
      INSERT INTO role_permissions (role, permission_key) VALUES
      ('FRONT_DESK', 'patients:view_list'),
      ('FRONT_DESK', 'patients:edit_demographics'),
      ('FRONT_DESK', 'patients:edit_insurance'),
      ('FRONT_DESK', 'schedule:view'),
      ('FRONT_DESK', 'schedule:edit'),
      ('FRONT_DESK', 'schedule:status_update')
      ON CONFLICT (role, permission_key) DO NOTHING
    `);

    // BILLING permissions
    await client.query(`
      INSERT INTO role_permissions (role, permission_key) VALUES
      ('BILLING', 'patients:view_list'),
      ('BILLING', 'patients:view_chart'),
      ('BILLING', 'patients:edit_insurance'),
      ('BILLING', 'billing:view'),
      ('BILLING', 'billing:edit'),
      ('BILLING', 'claims:submit')
      ON CONFLICT (role, permission_key) DO NOTHING
    `);

    // AUDITOR_READONLY permissions
    await client.query(`
      INSERT INTO role_permissions (role, permission_key) VALUES
      ('AUDITOR_READONLY', 'patients:view_list'),
      ('AUDITOR_READONLY', 'patients:view_chart'),
      ('AUDITOR_READONLY', 'schedule:view'),
      ('AUDITOR_READONLY', 'notes:view'),
      ('AUDITOR_READONLY', 'billing:view'),
      ('AUDITOR_READONLY', 'audit:view')
      ON CONFLICT (role, permission_key) DO NOTHING
    `);
    console.log('✅ Seeded role permissions');

    // Seed default scopes
    console.log('Seeding role scopes...');
    await client.query(`
      INSERT INTO role_scope (role, schedule_scope, patient_scope) VALUES
      ('ADMIN', 'CLINIC', 'CLINIC'),
      ('FRONT_DESK', 'CLINIC', 'CLINIC'),
      ('NURSE_MA', 'CLINIC', 'CLINIC'),
      ('BILLING', 'CLINIC', 'CLINIC'),
      ('AUDITOR_READONLY', 'CLINIC', 'CLINIC'),
      ('CLINICIAN', 'SELF', 'ASSIGNED')
      ON CONFLICT (role) DO NOTHING
    `);
    console.log('✅ Seeded role scopes');

    await client.query('COMMIT');
    console.log('\n✅ Successfully migrated permissions system!');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error migrating permissions system:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run migration if called directly
if (require.main === module) {
  migrate()
    .then(() => {
      console.log('\n✅ Migration completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Migration failed:', error);
      process.exit(1);
    });
}

module.exports = { migrate };

