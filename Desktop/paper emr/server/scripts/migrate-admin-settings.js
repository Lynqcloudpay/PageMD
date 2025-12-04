/**
 * Migration: Admin Settings and Practice Configuration
 * 
 * Creates tables for practice settings, system configuration, and admin preferences
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
    console.log('🚀 Creating admin settings tables...\n');

    // Practice Settings Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS practice_settings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        practice_name VARCHAR(255) NOT NULL DEFAULT 'My Practice',
        practice_type VARCHAR(100),
        tax_id VARCHAR(50),
        npi VARCHAR(10),
        address_line1 VARCHAR(255),
        address_line2 VARCHAR(255),
        city VARCHAR(100),
        state VARCHAR(50),
        zip VARCHAR(20),
        phone VARCHAR(20),
        fax VARCHAR(20),
        email VARCHAR(255),
        website VARCHAR(255),
        logo_url TEXT,
        timezone VARCHAR(50) DEFAULT 'America/New_York',
        date_format VARCHAR(20) DEFAULT 'MM/DD/YYYY',
        time_format VARCHAR(20) DEFAULT '12h',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_by UUID REFERENCES users(id)
      )
    `);
    console.log('✅ Created practice_settings table');

    // System Configuration Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS system_config (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        key VARCHAR(255) UNIQUE NOT NULL,
        value TEXT,
        category VARCHAR(100),
        data_type VARCHAR(50) DEFAULT 'string',
        description TEXT,
        is_encrypted BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_by UUID REFERENCES users(id)
      )
    `);
    console.log('✅ Created system_config table');

    // Email/SMTP Settings Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS email_settings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        smtp_host VARCHAR(255),
        smtp_port INTEGER DEFAULT 587,
        smtp_secure BOOLEAN DEFAULT true,
        smtp_username VARCHAR(255),
        smtp_password TEXT,
        from_name VARCHAR(255),
        from_email VARCHAR(255),
        reply_to_email VARCHAR(255),
        enabled BOOLEAN DEFAULT false,
        test_email VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_by UUID REFERENCES users(id)
      )
    `);
    console.log('✅ Created email_settings table');

    // Security Settings Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS security_settings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        password_min_length INTEGER DEFAULT 8,
        password_require_uppercase BOOLEAN DEFAULT true,
        password_require_lowercase BOOLEAN DEFAULT true,
        password_require_number BOOLEAN DEFAULT true,
        password_require_special BOOLEAN DEFAULT true,
        session_timeout_minutes INTEGER DEFAULT 30,
        max_login_attempts INTEGER DEFAULT 5,
        lockout_duration_minutes INTEGER DEFAULT 15,
        require_2fa BOOLEAN DEFAULT false,
        require_2fa_for_admin BOOLEAN DEFAULT false,
        inactivity_timeout_minutes INTEGER DEFAULT 15,
        audit_log_retention_days INTEGER DEFAULT 365,
        ip_whitelist TEXT[],
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_by UUID REFERENCES users(id)
      )
    `);
    console.log('✅ Created security_settings table');

    // Billing Configuration Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS billing_config (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        default_fee_schedule_id UUID,
        auto_submit_claims BOOLEAN DEFAULT false,
        claim_submission_method VARCHAR(50) DEFAULT 'manual',
        clearinghouse_name VARCHAR(255),
        clearinghouse_username VARCHAR(255),
        clearinghouse_password TEXT,
        payer_id VARCHAR(50),
        submitter_id VARCHAR(50),
        default_place_of_service VARCHAR(50),
        default_referring_provider_id UUID REFERENCES users(id),
        electronic_claims_enabled BOOLEAN DEFAULT false,
        paper_claims_enabled BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_by UUID REFERENCES users(id)
      )
    `);
    console.log('✅ Created billing_config table');

    // Clinical Settings Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS clinical_settings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        default_note_template TEXT,
        require_dx_on_visit BOOLEAN DEFAULT true,
        require_vitals_on_visit BOOLEAN DEFAULT false,
        default_vitals_template JSONB,
        lab_result_retention_days INTEGER DEFAULT 2555,
        imaging_result_retention_days INTEGER DEFAULT 2555,
        document_retention_days INTEGER DEFAULT 2555,
        enable_clinical_alerts BOOLEAN DEFAULT true,
        enable_drug_interaction_check BOOLEAN DEFAULT true,
        enable_allergy_alerts BOOLEAN DEFAULT true,
        default_visit_duration_minutes INTEGER DEFAULT 15,
        enable_appointment_reminders BOOLEAN DEFAULT false,
        reminder_days_before INTEGER DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_by UUID REFERENCES users(id)
      )
    `);
    console.log('✅ Created clinical_settings table');

    // Feature Flags Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS feature_flags (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        feature_key VARCHAR(255) UNIQUE NOT NULL,
        enabled BOOLEAN DEFAULT false,
        description TEXT,
        category VARCHAR(100),
        requires_config BOOLEAN DEFAULT false,
        config_data JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_by UUID REFERENCES users(id)
      )
    `);
    console.log('✅ Created feature_flags table');

    // Insert default practice settings (single row)
    const practiceExists = await client.query('SELECT id FROM practice_settings LIMIT 1');
    if (practiceExists.rows.length === 0) {
      await client.query(`
        INSERT INTO practice_settings (practice_name, timezone, date_format, time_format)
        VALUES ('My Practice', 'America/New_York', 'MM/DD/YYYY', '12h')
      `);
      console.log('✅ Created default practice settings');
    }

    // Insert default security settings (single row)
    const securityExists = await client.query('SELECT id FROM security_settings LIMIT 1');
    if (securityExists.rows.length === 0) {
      await client.query(`
        INSERT INTO security_settings (
          password_min_length,
          password_require_uppercase,
          password_require_lowercase,
          password_require_number,
          password_require_special,
          session_timeout_minutes,
          max_login_attempts,
          lockout_duration_minutes,
          audit_log_retention_days
        ) VALUES (8, true, true, true, true, 30, 5, 15, 365)
      `);
      console.log('✅ Created default security settings');
    }

    // Insert default clinical settings (single row)
    const clinicalExists = await client.query('SELECT id FROM clinical_settings LIMIT 1');
    if (clinicalExists.rows.length === 0) {
      await client.query(`
        INSERT INTO clinical_settings (
          require_dx_on_visit,
          require_vitals_on_visit,
          enable_clinical_alerts,
          enable_drug_interaction_check,
          enable_allergy_alerts,
          default_visit_duration_minutes
        ) VALUES (true, false, true, true, true, 15)
      `);
      console.log('✅ Created default clinical settings');
    }

    // Insert default feature flags
    const defaultFeatures = [
      { key: 'e_prescribing', enabled: true, description: 'Electronic Prescribing', category: 'clinical' },
      { key: 'telehealth', enabled: true, description: 'Telehealth Integration', category: 'clinical' },
      { key: 'billing', enabled: true, description: 'Billing & Claims Management', category: 'billing' },
      { key: 'lab_orders', enabled: true, description: 'Laboratory Orders', category: 'clinical' },
      { key: 'imaging_orders', enabled: true, description: 'Imaging Orders', category: 'clinical' },
      { key: 'patient_portal', enabled: false, description: 'Patient Portal', category: 'patient' },
      { key: 'analytics', enabled: true, description: 'Analytics & Reporting', category: 'reporting' },
      { key: 'messaging', enabled: true, description: 'Internal Messaging', category: 'communication' },
    ];

    for (const feature of defaultFeatures) {
      await client.query(`
        INSERT INTO feature_flags (feature_key, enabled, description, category)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (feature_key) DO NOTHING
      `, [feature.key, feature.enabled, feature.description, feature.category]);
    }
    console.log('✅ Created default feature flags');

    await client.query('COMMIT');
    console.log('\n✅ Migration completed successfully!\n');

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
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration error:', error);
      process.exit(1);
    });
}

module.exports = { migrate };






