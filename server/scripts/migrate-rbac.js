/**
 * RBAC Migration Script
 * 
 * Creates complete Role-Based Access Control system:
 * - Enhanced users table with healthcare professional fields
 * - Roles table
 * - Privileges table
 * - Role_Privileges mapping table
 * - Audit enhancements
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
    console.log('Starting RBAC migration...');

    // ============================================
    // 1. ROLES TABLE
    // ============================================
    console.log('Creating roles table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS roles (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(100) UNIQUE NOT NULL,
        description TEXT,
        is_system_role BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // ============================================
    // 2. PRIVILEGES TABLE
    // ============================================
    console.log('Creating privileges table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS privileges (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(100) UNIQUE NOT NULL,
        description TEXT,
        category VARCHAR(50), -- 'clinical', 'billing', 'admin', 'patient_access', etc.
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // ============================================
    // 3. ROLE_PRIVILEGES MAPPING TABLE
    // ============================================
    console.log('Creating role_privileges table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS role_privileges (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
        privilege_id UUID NOT NULL REFERENCES privileges(id) ON DELETE CASCADE,
        granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        granted_by UUID REFERENCES users(id),
        UNIQUE(role_id, privilege_id)
      )
    `);

    // ============================================
    // 4. ENHANCE USERS TABLE
    // ============================================
    console.log('Enhancing users table...');
    
    // Add role_id column (foreign key to roles table)
    await client.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS role_id UUID REFERENCES roles(id)
    `);

    // Add status column (replacing 'active')
    await client.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active' 
      CHECK (status IN ('active', 'suspended', 'inactive'))
    `);

    // Add last_login
    await client.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS last_login TIMESTAMP
    `);

    // Add date_created (if not exists, use created_at)
    await client.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS date_created TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    `);

    // Healthcare Professional Fields
    await client.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS professional_type VARCHAR(50)
    `);

    await client.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS npi VARCHAR(10)
    `);

    await client.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS license_number VARCHAR(100)
    `);

    await client.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS license_state VARCHAR(2)
    `);

    await client.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS dea_number VARCHAR(20)
    `);

    await client.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS taxonomy_code VARCHAR(10)
    `);

    await client.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS credentials VARCHAR(50)
    `);

    // Add indexes
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_users_role_id ON users(role_id)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_users_status ON users(status)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_users_npi ON users(npi) WHERE npi IS NOT NULL
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)
    `);

    // ============================================
    // 5. SEED DEFAULT ROLES
    // ============================================
    console.log('Seeding default roles...');
    
    const defaultRoles = [
      { name: 'Admin', description: 'System administrator with full access', is_system_role: true },
      { name: 'Physician', description: 'Licensed physician with full clinical privileges', is_system_role: true },
      { name: 'Nurse', description: 'Registered nurse or licensed practical nurse', is_system_role: true },
      { name: 'Medical Assistant', description: 'Medical assistant with limited clinical access', is_system_role: true },
      { name: 'Front Desk', description: 'Front desk staff for patient registration and scheduling', is_system_role: true },
      { name: 'Billing', description: 'Billing staff with financial and coding access', is_system_role: true },
      { name: 'Technician', description: 'Medical technician (lab, radiology, etc.)', is_system_role: true },
      { name: 'Nurse Practitioner', description: 'Nurse practitioner with prescribing privileges', is_system_role: true },
      { name: 'Physician Assistant', description: 'Physician assistant with clinical privileges', is_system_role: true },
    ];

    for (const role of defaultRoles) {
      await client.query(`
        INSERT INTO roles (name, description, is_system_role)
        VALUES ($1, $2, $3)
        ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description
      `, [role.name, role.description, role.is_system_role]);
    }

    // ============================================
    // 6. SEED DEFAULT PRIVILEGES
    // ============================================
    console.log('Seeding default privileges...');
    
    const defaultPrivileges = [
      // Clinical Privileges
      { name: 'document_visit', description: 'Document patient visits', category: 'clinical' },
      { name: 'sign_notes', description: 'Sign and finalize visit notes', category: 'clinical' },
      { name: 'view_labs', description: 'View laboratory results', category: 'clinical' },
      { name: 'order_labs', description: 'Order laboratory tests', category: 'clinical' },
      { name: 'view_imaging', description: 'View imaging studies', category: 'clinical' },
      { name: 'order_imaging', description: 'Order imaging studies', category: 'clinical' },
      { name: 'enter_vitals', description: 'Enter patient vital signs', category: 'clinical' },
      { name: 'view_patients', description: 'View patient records', category: 'clinical' },
      { name: 'edit_patients', description: 'Edit patient information', category: 'clinical' },
      { name: 'e_prescribe', description: 'Create and send electronic prescriptions', category: 'clinical' },
      { name: 'create_referrals', description: 'Create referral orders', category: 'clinical' },
      { name: 'view_medications', description: 'View patient medications', category: 'clinical' },
      { name: 'manage_problems', description: 'Manage problem list', category: 'clinical' },
      { name: 'manage_allergies', description: 'Manage allergies', category: 'clinical' },
      
      // Code Access
      { name: 'search_icd10', description: 'Search ICD-10 diagnosis codes', category: 'clinical' },
      { name: 'search_cpt', description: 'Search CPT procedure codes', category: 'clinical' },
      
      // Billing Privileges
      { name: 'create_superbill', description: 'Create superbills', category: 'billing' },
      { name: 'manage_claims', description: 'Manage insurance claims', category: 'billing' },
      { name: 'view_billing', description: 'View billing information', category: 'billing' },
      { name: 'financial_reports', description: 'Access financial reports', category: 'billing' },
      
      // Administrative Privileges
      { name: 'manage_users', description: 'Create, edit, and delete users', category: 'admin' },
      { name: 'manage_roles', description: 'Manage roles and privileges', category: 'admin' },
      { name: 'view_audit_logs', description: 'View system audit logs', category: 'admin' },
      { name: 'system_settings', description: 'Modify system settings', category: 'admin' },
      { name: 'promote_to_admin', description: 'Promote users to admin', category: 'admin' },
      
      // Patient Access
      { name: 'register_patients', description: 'Register new patients', category: 'patient_access' },
      { name: 'schedule_appointments', description: 'Schedule patient appointments', category: 'patient_access' },
      { name: 'upload_documents', description: 'Upload patient documents', category: 'patient_access' },
      
      // Messaging/Workflow
      { name: 'send_messages', description: 'Send internal messages', category: 'workflow' },
      { name: 'assign_tasks', description: 'Assign tasks to users', category: 'workflow' },
      { name: 'view_messages', description: 'View messages', category: 'workflow' },
    ];

    for (const privilege of defaultPrivileges) {
      await client.query(`
        INSERT INTO privileges (name, description, category)
        VALUES ($1, $2, $3)
        ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description, category = EXCLUDED.category
      `, [privilege.name, privilege.description, privilege.category]);
    }

    // ============================================
    // 7. ASSIGN DEFAULT PRIVILEGES TO ROLES
    // ============================================
    console.log('Assigning default privileges to roles...');

    // Get role IDs
    const roleResults = await client.query('SELECT id, name FROM roles');
    const roles = {};
    roleResults.rows.forEach(r => { roles[r.name] = r.id; });

    // Get privilege IDs
    const privResults = await client.query('SELECT id, name FROM privileges');
    const privileges = {};
    privResults.rows.forEach(p => { privileges[p.name] = p.id; });

    // Admin: All privileges (handled in code, but we can assign all here)
    const adminPrivileges = Object.values(privileges);
    for (const privId of adminPrivileges) {
      await client.query(`
        INSERT INTO role_privileges (role_id, privilege_id)
        VALUES ($1, $2)
        ON CONFLICT (role_id, privilege_id) DO NOTHING
      `, [roles['Admin'], privId]);
    }

    // Physician: Full clinical access
    const physicianPrivileges = [
      'document_visit', 'sign_notes', 'view_labs', 'order_labs', 'view_imaging', 'order_imaging',
      'enter_vitals', 'view_patients', 'edit_patients', 'e_prescribe', 'create_referrals',
      'view_medications', 'manage_problems', 'manage_allergies', 'search_icd10', 'search_cpt',
      'create_superbill', 'view_billing', 'register_patients', 'schedule_appointments',
      'upload_documents', 'send_messages', 'assign_tasks', 'view_messages'
    ];
    for (const privName of physicianPrivileges) {
      if (privileges[privName]) {
        await client.query(`
          INSERT INTO role_privileges (role_id, privilege_id)
          VALUES ($1, $2)
          ON CONFLICT (role_id, privilege_id) DO NOTHING
        `, [roles['Physician'], privileges[privName]]);
      }
    }

    // Nurse: Clinical support
    const nursePrivileges = [
      'view_labs', 'view_imaging', 'enter_vitals', 'view_patients', 'view_medications',
      'register_patients', 'schedule_appointments', 'upload_documents', 'send_messages', 'view_messages'
    ];
    for (const privName of nursePrivileges) {
      if (privileges[privName]) {
        await client.query(`
          INSERT INTO role_privileges (role_id, privilege_id)
          VALUES ($1, $2)
          ON CONFLICT (role_id, privilege_id) DO NOTHING
        `, [roles['Nurse'], privileges[privName]]);
      }
    }

    // Medical Assistant: Limited clinical
    const maPrivileges = [
      'enter_vitals', 'view_patients', 'register_patients', 'schedule_appointments',
      'upload_documents', 'send_messages', 'view_messages'
    ];
    for (const privName of maPrivileges) {
      if (privileges[privName]) {
        await client.query(`
          INSERT INTO role_privileges (role_id, privilege_id)
          VALUES ($1, $2)
          ON CONFLICT (role_id, privilege_id) DO NOTHING
        `, [roles['Medical Assistant'], privileges[privName]]);
      }
    }

    // Front Desk: Patient access
    const frontDeskPrivileges = [
      'register_patients', 'schedule_appointments', 'upload_documents', 'view_patients',
      'send_messages', 'view_messages'
    ];
    for (const privName of frontDeskPrivileges) {
      if (privileges[privName]) {
        await client.query(`
          INSERT INTO role_privileges (role_id, privilege_id)
          VALUES ($1, $2)
          ON CONFLICT (role_id, privilege_id) DO NOTHING
        `, [roles['Front Desk'], privileges[privName]]);
      }
    }

    // Billing: Financial access
    const billingPrivileges = [
      'create_superbill', 'manage_claims', 'view_billing', 'financial_reports',
      'search_icd10', 'search_cpt', 'view_patients', 'send_messages', 'view_messages'
    ];
    for (const privName of billingPrivileges) {
      if (privileges[privName]) {
        await client.query(`
          INSERT INTO role_privileges (role_id, privilege_id)
          VALUES ($1, $2)
          ON CONFLICT (role_id, privilege_id) DO NOTHING
        `, [roles['Billing'], privileges[privName]]);
      }
    }

    // Nurse Practitioner: Similar to Physician
    const npPrivileges = [
      'document_visit', 'sign_notes', 'view_labs', 'order_labs', 'view_imaging', 'order_imaging',
      'enter_vitals', 'view_patients', 'edit_patients', 'e_prescribe', 'create_referrals',
      'view_medications', 'manage_problems', 'manage_allergies', 'search_icd10', 'search_cpt',
      'create_superbill', 'view_billing', 'register_patients', 'schedule_appointments',
      'upload_documents', 'send_messages', 'assign_tasks', 'view_messages'
    ];
    for (const privName of npPrivileges) {
      if (privileges[privName]) {
        await client.query(`
          INSERT INTO role_privileges (role_id, privilege_id)
          VALUES ($1, $2)
          ON CONFLICT (role_id, privilege_id) DO NOTHING
        `, [roles['Nurse Practitioner'], privileges[privName]]);
      }
    }

    // Physician Assistant: Similar to Physician
    const paPrivileges = [
      'document_visit', 'sign_notes', 'view_labs', 'order_labs', 'view_imaging', 'order_imaging',
      'enter_vitals', 'view_patients', 'edit_patients', 'e_prescribe', 'create_referrals',
      'view_medications', 'manage_problems', 'manage_allergies', 'search_icd10', 'search_cpt',
      'create_superbill', 'view_billing', 'register_patients', 'schedule_appointments',
      'upload_documents', 'send_messages', 'assign_tasks', 'view_messages'
    ];
    for (const privName of paPrivileges) {
      if (privileges[privName]) {
        await client.query(`
          INSERT INTO role_privileges (role_id, privilege_id)
          VALUES ($1, $2)
          ON CONFLICT (role_id, privilege_id) DO NOTHING
        `, [roles['Physician Assistant'], privileges[privName]]);
      }
    }

    // ============================================
    // 8. MIGRATE EXISTING USERS
    // ============================================
    console.log('Migrating existing users...');
    
    // Map old role strings to new role IDs
    const roleMapping = {
      'admin': 'Admin',
      'clinician': 'Physician',
      'nurse': 'Nurse',
      'front_desk': 'Front Desk'
    };

    // Update existing users to use role_id
    const existingUsers = await client.query('SELECT id, role, active FROM users WHERE role_id IS NULL');
    for (const user of existingUsers.rows) {
      const newRoleName = roleMapping[user.role] || 'Nurse';
      const roleId = roles[newRoleName];
      
      if (roleId) {
        await client.query(`
          UPDATE users 
          SET role_id = $1, 
              status = CASE WHEN $2 THEN 'active' ELSE 'suspended' END,
              date_created = COALESCE(date_created, created_at)
          WHERE id = $3
        `, [roleId, user.active, user.id]);
      }
    }

    await client.query('COMMIT');
    console.log('✅ RBAC migration completed successfully!');
    
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
    .then(() => {
      console.log('Migration script completed.');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration script failed:', error);
      process.exit(1);
    });
}

module.exports = { migrate };

