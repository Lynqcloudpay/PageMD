/**
 * HIPAA Security Migration Script
 * 
 * Implements comprehensive HIPAA security features:
 * - Enhanced RBAC with HIPAA-compliant roles and permissions
 * - Enhanced audit logging schema
 * - MFA support tables
 * - Session management tables
 * - Field encryption metadata
 * - Record history tables
 */

// Log immediately to verify script is running
console.log('=== MIGRATE-HIPAA-SECURITY SCRIPT STARTING ===');
console.log('Node version:', process.version);
console.log('Current working directory:', process.cwd());

const { Pool } = require('pg');

// Check DATABASE_URL BEFORE loading dotenv
console.log('DATABASE_URL before dotenv:', process.env.DATABASE_URL ? 'EXISTS' : 'NOT SET');

// In Docker, environment variables are already set via docker-compose
// Only load .env file if DATABASE_URL is not already set (local development)
// Use override: false to ensure Docker env vars take precedence
if (!process.env.DATABASE_URL) {
  console.log('Loading .env file (DATABASE_URL not set)...');
  require('dotenv').config({ override: false });
} else {
  console.log('Skipping .env load (DATABASE_URL already set)');
}

// Check DATABASE_URL AFTER loading dotenv
console.log('DATABASE_URL after dotenv:', process.env.DATABASE_URL ? 'EXISTS' : 'NOT SET');
if (process.env.DATABASE_URL) {
  const masked = process.env.DATABASE_URL.replace(/:[^:@]+@/, ':****@');
  console.log('DATABASE_URL value:', masked);
}

// Debug: Show what we have (run immediately, before any async operations)
console.log('=== Environment check ===');
console.log('  DATABASE_URL:', process.env.DATABASE_URL ? 'SET (hidden)' : 'NOT SET');
if (process.env.DATABASE_URL) {
  const masked = process.env.DATABASE_URL.replace(/:[^:@]+@/, ':****@');
  console.log('  DATABASE_URL value:', masked);
}
console.log('  DB_HOST:', process.env.DB_HOST || 'NOT SET');
console.log('  DB_NAME:', process.env.DB_NAME || 'NOT SET');
console.log('  DB_USER:', process.env.DB_USER || 'NOT SET');
console.log('========================');

// Construct DATABASE_URL from individual variables if not set
let databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  const dbHost = process.env.DB_HOST || 'db';
  const dbPort = process.env.DB_PORT || 5432;
  const dbName = process.env.DB_NAME || 'emr_db';
  const dbUser = process.env.DB_USER || 'emr_user';
  const dbPassword = process.env.DB_PASSWORD || '';
  
  if (dbPassword) {
    databaseUrl = `postgresql://${dbUser}:${dbPassword}@${dbHost}:${dbPort}/${dbName}`;
    console.log('Constructed DATABASE_URL from individual variables');
  }
}

// Use DATABASE_URL if available (preferred for Docker), otherwise use individual connection params
const pool = databaseUrl
  ? new Pool({
      connectionString: databaseUrl,
      ssl: databaseUrl.includes('localhost') || databaseUrl.includes('127.0.0.1')
        ? false
        : { rejectUnauthorized: false },
    })
  : new Pool({
      host: process.env.DB_HOST || 'db', // Default to 'db' service name in Docker
      port: process.env.DB_PORT || 5432,
      database: process.env.DB_NAME || 'emr_db',
      user: process.env.DB_USER || 'emr_user',
      password: process.env.DB_PASSWORD || '',
    });

// Debug: Log connection info (without password)
if (databaseUrl) {
  const dbUrl = databaseUrl.replace(/:[^:@]+@/, ':****@');
  console.log('Using DATABASE_URL:', dbUrl);
} else {
  console.log('Using individual connection params:', {
    host: process.env.DB_HOST || 'db',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'emr_db',
    user: process.env.DB_USER || 'emr_user',
  });
}

async function migrate() {
  console.log('\n=== Attempting database connection ===');
  let client;
  try {
    client = await pool.connect();
    console.log('✅ Database connection successful!');
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    console.error('Connection details:', {
      hasDatabaseUrl: !!databaseUrl,
      databaseUrl: databaseUrl ? databaseUrl.replace(/:[^:@]+@/, ':****@') : 'none',
      dbHost: process.env.DB_HOST || 'db',
      dbPort: process.env.DB_PORT || 5432,
    });
    throw error;
  }
  
  try {
    await client.query('BEGIN');
    console.log('Starting HIPAA Security migration...');

    // ============================================
    // 1. ADD MISSING ROLES (SuperAdmin, ReadOnly)
    // ============================================
    console.log('Adding HIPAA-compliant roles...');
    
    const hipaaRoles = [
      { name: 'SuperAdmin', description: 'System super administrator with all privileges including system-level operations', is_system_role: true },
      { name: 'ReadOnly', description: 'Read-only access to patient data without identifiers', is_system_role: true },
    ];

    for (const role of hipaaRoles) {
      await client.query(`
        INSERT INTO roles (name, description, is_system_role)
        VALUES ($1, $2, $3)
        ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description
      `, [role.name, role.description, role.is_system_role]);
    }

    // ============================================
    // 2. ADD HIPAA-COMPLIANT PRIVILEGES
    // ============================================
    console.log('Adding HIPAA-compliant privileges...');
    
    const hipaaPrivileges = [
      // Patient permissions (granular as per HIPAA spec)
      { name: 'patient:view', description: 'View patient records', category: 'patient' },
      { name: 'patient:edit', description: 'Edit patient information', category: 'patient' },
      { name: 'patient:create', description: 'Create new patient records', category: 'patient' },
      { name: 'patient:delete', description: 'Delete patient records', category: 'patient' },
      { name: 'patient:view_identifiers', description: 'View patient identifiers (MRN, SSN)', category: 'patient' },
      
      // Encounter permissions
      { name: 'encounter:view', description: 'View patient encounters', category: 'encounter' },
      { name: 'encounter:create', description: 'Create new encounters', category: 'encounter' },
      { name: 'encounter:edit', description: 'Edit encounters', category: 'encounter' },
      { name: 'encounter:delete', description: 'Delete encounters', category: 'encounter' },
      
      // Orders permissions
      { name: 'orders:view', description: 'View orders', category: 'orders' },
      { name: 'orders:prescribe', description: 'Prescribe medications', category: 'orders' },
      { name: 'orders:create', description: 'Create orders', category: 'orders' },
      { name: 'orders:administer', description: 'Administer orders', category: 'orders' },
      
      // Notes permissions
      { name: 'notes:view', description: 'View clinical notes', category: 'notes' },
      { name: 'notes:create', description: 'Create clinical notes', category: 'notes' },
      { name: 'notes:edit', description: 'Edit clinical notes', category: 'notes' },
      { name: 'notes:sign', description: 'Sign and finalize notes', category: 'notes' },
      { name: 'notes:delete', description: 'Delete notes', category: 'notes' },
      
      // Billing permissions
      { name: 'billing:read', description: 'Read billing information', category: 'billing' },
      { name: 'billing:write', description: 'Write billing information', category: 'billing' },
      { name: 'billing:manage_claims', description: 'Manage insurance claims', category: 'billing' },
      
      // Admin permissions
      { name: 'admin:manage_roles', description: 'Manage roles and permissions', category: 'admin' },
      { name: 'admin:manage_users', description: 'Manage user accounts', category: 'admin' },
      { name: 'admin:view_audit', description: 'View audit logs', category: 'admin' },
      { name: 'admin:export_audit', description: 'Export audit logs', category: 'admin' },
      { name: 'admin:manage_baa', description: 'Manage Business Associate Agreements', category: 'admin' },
      { name: 'admin:system_settings', description: 'Modify system settings', category: 'admin' },
      
      // System permissions (SuperAdmin only)
      { name: 'system:backup_restore', description: 'Perform backup and restore operations', category: 'system' },
      { name: 'system:key_rotation', description: 'Rotate encryption keys', category: 'system' },
      { name: 'system:revert_records', description: 'Revert records to previous versions', category: 'system' },
    ];

    for (const privilege of hipaaPrivileges) {
      await client.query(`
        INSERT INTO privileges (name, description, category)
        VALUES ($1, $2, $3)
        ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description, category = EXCLUDED.category
      `, [privilege.name, privilege.description, privilege.category]);
    }

    // ============================================
    // 3. ASSIGN PRIVILEGES TO ROLES (HIPAA Matrix)
    // ============================================
    console.log('Assigning privileges to roles per HIPAA access control matrix...');

    // Get role IDs
    const roleResults = await client.query('SELECT id, name FROM roles');
    const roles = {};
    roleResults.rows.forEach(r => { roles[r.name] = r.id; });

    // Get privilege IDs
    const privResults = await client.query('SELECT id, name FROM privileges');
    const privileges = {};
    privResults.rows.forEach(p => { privileges[p.name] = p.id; });

    // SuperAdmin: All privileges
    const allPrivileges = Object.values(privileges);
    for (const privId of allPrivileges) {
      if (roles['SuperAdmin']) {
        await client.query(`
          INSERT INTO role_privileges (role_id, privilege_id)
          VALUES ($1, $2)
          ON CONFLICT (role_id, privilege_id) DO NOTHING
        `, [roles['SuperAdmin'], privId]);
      }
    }

    // Admin: All except system-level
    const adminPrivileges = allPrivileges.filter((_, idx) => {
      const privName = Object.keys(privileges).find(k => privileges[k] === allPrivileges[idx]);
      return privName && !privName.startsWith('system:');
    });
    for (const privId of adminPrivileges) {
      if (roles['Admin']) {
        await client.query(`
          INSERT INTO role_privileges (role_id, privilege_id)
          VALUES ($1, $2)
          ON CONFLICT (role_id, privilege_id) DO NOTHING
        `, [roles['Admin'], privId]);
      }
    }

    // Physician: Clinical access
    const physicianPrivileges = [
      'patient:view', 'patient:edit', 'patient:view_identifiers',
      'encounter:view', 'encounter:create', 'encounter:edit',
      'orders:view', 'orders:prescribe', 'orders:create',
      'notes:view', 'notes:create', 'notes:edit', 'notes:sign',
      'billing:read'
    ];
    for (const privName of physicianPrivileges) {
      if (privileges[privName] && roles['Physician']) {
        await client.query(`
          INSERT INTO role_privileges (role_id, privilege_id)
          VALUES ($1, $2)
          ON CONFLICT (role_id, privilege_id) DO NOTHING
        `, [roles['Physician'], privileges[privName]]);
      }
    }

    // Nurse: Limited clinical access
    const nursePrivileges = [
      'patient:view', 'patient:view_identifiers',
      'encounter:view', 'encounter:create',
      'orders:view', 'orders:administer',
      'notes:view', 'notes:create'
    ];
    for (const privName of nursePrivileges) {
      if (privileges[privName] && roles['Nurse']) {
        await client.query(`
          INSERT INTO role_privileges (role_id, privilege_id)
          VALUES ($1, $2)
          ON CONFLICT (role_id, privilege_id) DO NOTHING
        `, [roles['Nurse'], privileges[privName]]);
      }
    }

    // Medical Assistant: Very limited access
    const maPrivileges = [
      'patient:view',
      'encounter:create',
      'notes:create'
    ];
    for (const privName of maPrivileges) {
      if (privileges[privName] && roles['Medical Assistant']) {
        await client.query(`
          INSERT INTO role_privileges (role_id, privilege_id)
          VALUES ($1, $2)
          ON CONFLICT (role_id, privilege_id) DO NOTHING
        `, [roles['Medical Assistant'], privileges[privName]]);
      }
    }

    // Billing: Billing access only
    const billingPrivileges = [
      'billing:read', 'billing:write', 'billing:manage_claims',
      'patient:view' // Need to view patient for billing context
    ];
    for (const privName of billingPrivileges) {
      if (privileges[privName] && roles['Billing']) {
        await client.query(`
          INSERT INTO role_privileges (role_id, privilege_id)
          VALUES ($1, $2)
          ON CONFLICT (role_id, privilege_id) DO NOTHING
        `, [roles['Billing'], privileges[privName]]);
      }
    }

    // ReadOnly: View only, no identifiers
    const readonlyPrivileges = [
      'patient:view', // Without identifiers
      'encounter:view',
      'orders:view',
      'notes:view'
    ];
    for (const privName of readonlyPrivileges) {
      if (privileges[privName] && roles['ReadOnly']) {
        await client.query(`
          INSERT INTO role_privileges (role_id, privilege_id)
          VALUES ($1, $2)
          ON CONFLICT (role_id, privilege_id) DO NOTHING
        `, [roles['ReadOnly'], privileges[privName]]);
      }
    }

    // ============================================
    // 4. ENHANCE AUDIT LOGS TABLE
    // ============================================
    console.log('Enhancing audit logs table...');
    
    // Add missing columns to audit_logs
    await client.query(`
      ALTER TABLE audit_logs
      ADD COLUMN IF NOT EXISTS actor_user_id UUID REFERENCES users(id),
      ADD COLUMN IF NOT EXISTS actor_ip INET,
      ADD COLUMN IF NOT EXISTS outcome VARCHAR(20) DEFAULT 'success' CHECK (outcome IN ('success', 'failure')),
      ADD COLUMN IF NOT EXISTS request_id VARCHAR(100),
      ADD COLUMN IF NOT EXISTS session_id UUID
    `);

    // Rename user_id to actor_user_id if it exists and actor_user_id doesn't
    await client.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='audit_logs' AND column_name='user_id')
           AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='audit_logs' AND column_name='actor_user_id') THEN
          ALTER TABLE audit_logs RENAME COLUMN user_id TO actor_user_id;
        END IF;
      END $$;
    `);

    // Rename ip_address to actor_ip if needed
    await client.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='audit_logs' AND column_name='ip_address')
           AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='audit_logs' AND column_name='actor_ip') THEN
          ALTER TABLE audit_logs RENAME COLUMN ip_address TO actor_ip;
        END IF;
      END $$;
    `);

    // Make audit_logs append-only (prevent updates/deletes by regular users)
    await client.query(`
      CREATE OR REPLACE FUNCTION prevent_audit_log_modification()
      RETURNS TRIGGER AS $$
      BEGIN
        IF TG_OP = 'UPDATE' OR TG_OP = 'DELETE' THEN
          RAISE EXCEPTION 'Audit logs are append-only and cannot be modified';
        END IF;
        RETURN NULL;
      END;
      $$ LANGUAGE plpgsql;
    `);

    await client.query(`
      DROP TRIGGER IF EXISTS audit_log_protection ON audit_logs;
      CREATE TRIGGER audit_log_protection
      BEFORE UPDATE OR DELETE ON audit_logs
      FOR EACH ROW
      EXECUTE FUNCTION prevent_audit_log_modification();
    `);

    // Add indexes for audit log queries
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_user_id ON audit_logs(actor_user_id);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_target ON audit_logs(target_type, target_id);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_request_id ON audit_logs(request_id);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_session_id ON audit_logs(session_id);
    `);

    // ============================================
    // 5. MFA SUPPORT TABLES
    // ============================================
    console.log('Creating MFA support tables...');
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_mfa (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        method VARCHAR(20) NOT NULL CHECK (method IN ('totp', 'sms', 'email')),
        secret VARCHAR(255), -- TOTP secret (encrypted)
        phone_number VARCHAR(20), -- For SMS MFA
        enabled BOOLEAN DEFAULT false,
        verified BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, method)
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_user_mfa_user_id ON user_mfa(user_id);
    `);

    // ============================================
    // 6. ENHANCE SESSIONS TABLE
    // ============================================
    console.log('Enhancing sessions table...');
    
    await client.query(`
      ALTER TABLE sessions
      ADD COLUMN IF NOT EXISTS session_id UUID DEFAULT gen_random_uuid(),
      ADD COLUMN IF NOT EXISTS refresh_token_hash VARCHAR(255),
      ADD COLUMN IF NOT EXISTS mfa_verified BOOLEAN DEFAULT false
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
      CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
      CREATE INDEX IF NOT EXISTS idx_sessions_session_id ON sessions(session_id);
    `);

    // ============================================
    // 7. FIELD ENCRYPTION METADATA
    // ============================================
    console.log('Creating field encryption metadata tables...');
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS encryption_keys (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        key_id VARCHAR(255) UNIQUE NOT NULL, -- KMS key ID
        key_version VARCHAR(50) NOT NULL,
        dek_encrypted BYTEA NOT NULL, -- Encrypted Data Encryption Key
        algorithm VARCHAR(50) DEFAULT 'AES-256-GCM',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        rotated_at TIMESTAMP,
        active BOOLEAN DEFAULT true
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_encryption_keys_key_id ON encryption_keys(key_id);
      CREATE INDEX IF NOT EXISTS idx_encryption_keys_active ON encryption_keys(active);
    `);

    // Add encryption metadata columns to patients table
    await client.query(`
      ALTER TABLE patients
      ADD COLUMN IF NOT EXISTS ssn_encrypted BYTEA,
      ADD COLUMN IF NOT EXISTS mrn_encrypted BYTEA,
      ADD COLUMN IF NOT EXISTS dob_encrypted BYTEA,
      ADD COLUMN IF NOT EXISTS address_encrypted BYTEA,
      ADD COLUMN IF NOT EXISTS encryption_metadata JSONB
    `);

    // ============================================
    // 8. RECORD HISTORY TABLES
    // ============================================
    console.log('Creating record history tables...');
    
    // Patient history
    await client.query(`
      CREATE TABLE IF NOT EXISTS patient_history (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        changed_by UUID NOT NULL REFERENCES users(id),
        changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        change_type VARCHAR(20) NOT NULL CHECK (change_type IN ('create', 'update', 'delete')),
        previous_data JSONB,
        new_data JSONB,
        diff_json JSONB,
        reason TEXT
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_patient_history_patient_id ON patient_history(patient_id);
      CREATE INDEX IF NOT EXISTS idx_patient_history_changed_at ON patient_history(changed_at);
    `);

    // Encounter/Visit history
    await client.query(`
      CREATE TABLE IF NOT EXISTS visit_history (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        visit_id UUID NOT NULL REFERENCES visits(id) ON DELETE CASCADE,
        changed_by UUID NOT NULL REFERENCES users(id),
        changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        change_type VARCHAR(20) NOT NULL CHECK (change_type IN ('create', 'update', 'delete')),
        previous_data JSONB,
        new_data JSONB,
        diff_json JSONB,
        reason TEXT
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_visit_history_visit_id ON visit_history(visit_id);
      CREATE INDEX IF NOT EXISTS idx_visit_history_changed_at ON visit_history(changed_at);
    `);

    // Notes history
    await client.query(`
      CREATE TABLE IF NOT EXISTS note_history (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        visit_id UUID NOT NULL REFERENCES visits(id) ON DELETE CASCADE,
        changed_by UUID NOT NULL REFERENCES users(id),
        changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        change_type VARCHAR(20) NOT NULL CHECK (change_type IN ('create', 'update', 'delete', 'sign')),
        previous_data JSONB,
        new_data JSONB,
        diff_json JSONB,
        reason TEXT
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_note_history_visit_id ON note_history(visit_id);
      CREATE INDEX IF NOT EXISTS idx_note_history_changed_at ON note_history(changed_at);
    `);

    // ============================================
    // 9. PASSWORD RESET TOKENS
    // ============================================
    console.log('Creating password reset tokens table...');
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS password_reset_tokens (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token_hash VARCHAR(255) NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        used BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        ip_address INET,
        user_agent TEXT
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_id ON password_reset_tokens(user_id);
      CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_expires_at ON password_reset_tokens(expires_at);
    `);

    // ============================================
    // 10. LOGIN ATTEMPT TRACKING
    // ============================================
    console.log('Creating login attempt tracking table...');
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS login_attempts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) NOT NULL,
        ip_address INET NOT NULL,
        success BOOLEAN DEFAULT false,
        failure_reason VARCHAR(100),
        attempted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        user_agent TEXT
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_login_attempts_email ON login_attempts(email, attempted_at);
      CREATE INDEX IF NOT EXISTS idx_login_attempts_ip ON login_attempts(ip_address, attempted_at);
    `);

    await client.query('COMMIT');
    console.log('✅ HIPAA Security migration completed successfully!');
    
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





















