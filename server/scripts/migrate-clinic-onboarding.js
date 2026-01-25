const pool = require('../db');

async function migrate() {
    console.log('🚀 Starting Clinic Onboarding Migration...');

    const client = await pool.controlPool.connect();
    try {
        await client.query('BEGIN');

        // 1. Create clinic_fax_numbers
        console.log('Creating clinic_fax_numbers table...');
        await client.query(`
      CREATE TABLE IF NOT EXISTS clinic_fax_numbers (
        id SERIAL PRIMARY KEY,
        tenant_id VARCHAR(100) NOT NULL,
        phone_number VARCHAR(20) UNIQUE NOT NULL,
        provider VARCHAR(50) DEFAULT 'telnyx',
        label VARCHAR(100),
        active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
        await client.query('CREATE INDEX IF NOT EXISTS idx_fax_phone ON clinic_fax_numbers(phone_number)');
        await client.query('CREATE INDEX IF NOT EXISTS idx_fax_tenant ON clinic_fax_numbers(tenant_id)');

        // 2. Create clinic_lab_interfaces
        console.log('Creating clinic_lab_interfaces table...');
        await client.query(`
      CREATE TABLE IF NOT EXISTS clinic_lab_interfaces (
        id SERIAL PRIMARY KEY,
        tenant_id VARCHAR(100) NOT NULL,
        lab_name VARCHAR(100) NOT NULL,
        facility_id VARCHAR(50),
        account_number VARCHAR(50),
        npi VARCHAR(10),
        contact_name VARCHAR(100),
        contact_phone VARCHAR(20),
        status VARCHAR(20) DEFAULT 'pending',
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
        await client.query('CREATE INDEX IF NOT EXISTS idx_lab_tenant ON clinic_lab_interfaces(tenant_id)');
        await client.query('CREATE INDEX IF NOT EXISTS idx_lab_facility ON clinic_lab_interfaces(facility_id)');

        // 3. Create clinic_setup_checklist
        console.log('Creating clinic_setup_checklist table...');
        await client.query(`
      CREATE TABLE IF NOT EXISTS clinic_setup_checklist (
        id SERIAL PRIMARY KEY,
        tenant_id VARCHAR(100) UNIQUE NOT NULL,
        basic_info_complete BOOLEAN DEFAULT false,
        basic_info_date TIMESTAMP,
        users_created BOOLEAN DEFAULT false,
        users_date TIMESTAMP,
        fax_configured BOOLEAN DEFAULT false,
        fax_date TIMESTAMP,
        fax_notes TEXT,
        quest_configured BOOLEAN DEFAULT false,
        quest_date TIMESTAMP,
        quest_notes TEXT,
        labcorp_configured BOOLEAN DEFAULT false,
        labcorp_date TIMESTAMP,
        labcorp_notes TEXT,
        patient_portal_enabled BOOLEAN DEFAULT false,
        patient_portal_date TIMESTAMP,
        billing_configured BOOLEAN DEFAULT false,
        billing_date TIMESTAMP,
        billing_notes TEXT,
        eprescribe_configured BOOLEAN DEFAULT false,
        eprescribe_date TIMESTAMP,
        onboarding_complete BOOLEAN DEFAULT false,
        onboarding_complete_date TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

        // 4. Populate checklist for existing clinics
        console.log('Populating checklist for existing clinics...');
        await client.query(`
      INSERT INTO clinic_setup_checklist (tenant_id, basic_info_complete, users_created, onboarding_complete)
      SELECT slug, true, true, false FROM clinics
      ON CONFLICT (tenant_id) DO NOTHING
    `);

        await client.query('COMMIT');
        console.log('✅ Clinic Onboarding Migration completed successfully!');
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('❌ Migration failed:', err);
        process.exit(1);
    } finally {
        client.release();
        process.exit(0);
    }
}

migrate();
