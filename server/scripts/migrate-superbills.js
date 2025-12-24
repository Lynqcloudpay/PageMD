const pool = require('../db');

async function migrate() {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Settings Tables
        console.log('Creating settings tables...');

        await client.query(`
      CREATE TABLE IF NOT EXISTS organizations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        tax_id VARCHAR(50),
        npi VARCHAR(10),
        address_line1 VARCHAR(255),
        address_line2 VARCHAR(255),
        city VARCHAR(100),
        state VARCHAR(50),
        zip VARCHAR(20),
        phone VARCHAR(20),
        email VARCHAR(255),
        billing_contact_name VARCHAR(255),
        billing_contact_phone VARCHAR(20),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

        await client.query(`
      CREATE TABLE IF NOT EXISTS locations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID REFERENCES organizations(id),
        name VARCHAR(255) NOT NULL,
        npi VARCHAR(10),
        pos_code VARCHAR(10) DEFAULT '11', -- Default to Office
        address_line1 VARCHAR(255),
        address_line2 VARCHAR(255),
        city VARCHAR(100),
        state VARCHAR(50),
        zip VARCHAR(20),
        phone VARCHAR(20),
        active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

        await client.query(`
      CREATE TABLE IF NOT EXISTS payer_policies (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        payer_name VARCHAR(255) NOT NULL,
        payer_id VARCHAR(50), -- EDI Payer ID
        plan_type VARCHAR(50), -- Medicare, Medicaid, Commercial, etc.
        address_line1 VARCHAR(255),
        city VARCHAR(100),
        state VARCHAR(50),
        zip VARCHAR(20),
        active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

        // Add NPI and Taxonomy to users if they don't exist
        await client.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS npi VARCHAR(10),
      ADD COLUMN IF NOT EXISTS taxonomy_code VARCHAR(20),
      ADD COLUMN IF NOT EXISTS billing_name_override VARCHAR(255)
    `);

        // 2. Superbill Tables
        console.log('Creating superbill tables...');

        await client.query(`
      CREATE TYPE superbill_status AS ENUM ('DRAFT', 'READY', 'FINALIZED', 'VOID');
    `).catch(() => console.log('Enum superbill_status already exists or error creating it'));

        await client.query(`
      CREATE TABLE IF NOT EXISTS superbills (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        visit_id UUID NOT NULL REFERENCES visits(id) ON DELETE CASCADE,
        note_id UUID, -- nullable, can link to a specific note if the system has multiple notes per visit
        status superbill_status DEFAULT 'DRAFT',
        service_date_from DATE NOT NULL,
        service_date_to DATE NOT NULL,
        place_of_service VARCHAR(10) NOT NULL DEFAULT '11',
        claim_frequency_code VARCHAR(10) DEFAULT '1', -- 1=Original, 7=Replacement, 8=Void
        referring_provider_id UUID REFERENCES users(id),
        rendering_provider_id UUID NOT NULL REFERENCES users(id),
        billing_provider_id UUID NOT NULL REFERENCES users(id),
        facility_location_id UUID REFERENCES locations(id),
        insurance_policy_id UUID REFERENCES payer_policies(id),
        authorization_number VARCHAR(50),
        accident_related_employment BOOLEAN DEFAULT false,
        accident_related_auto BOOLEAN DEFAULT false,
        accident_related_other BOOLEAN DEFAULT false,
        accident_state VARCHAR(2),
        accident_date DATE,
        total_charges DECIMAL(12, 2) DEFAULT 0.00,
        total_units INTEGER DEFAULT 0,
        created_by UUID NOT NULL REFERENCES users(id),
        updated_by UUID REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

        await client.query(`
      CREATE TABLE IF NOT EXISTS superbill_diagnoses (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        superbill_id UUID NOT NULL REFERENCES superbills(id) ON DELETE CASCADE,
        icd10_code VARCHAR(20) NOT NULL,
        description TEXT,
        sequence INTEGER NOT NULL, -- 1..12
        present_on_admission BOOLEAN,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(superbill_id, icd10_code),
        UNIQUE(superbill_id, sequence)
      )
    `);

        await client.query(`
      CREATE TABLE IF NOT EXISTS superbill_lines (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        superbill_id UUID NOT NULL REFERENCES superbills(id) ON DELETE CASCADE,
        cpt_code VARCHAR(10) NOT NULL,
        description TEXT,
        modifier1 VARCHAR(5),
        modifier2 VARCHAR(5),
        modifier3 VARCHAR(5),
        modifier4 VARCHAR(5),
        units INTEGER NOT NULL DEFAULT 1,
        charge DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
        diagnosis_pointers VARCHAR(50), -- String like "1,2,4" or array
        ndc_code VARCHAR(20),
        drug_unit VARCHAR(10),
        drug_quantity DECIMAL(10, 3),
        service_date DATE,
        place_of_service_override VARCHAR(10),
        rendering_provider_id_override UUID REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

        await client.query(`
      CREATE TABLE IF NOT EXISTS superbill_payments_summary (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        superbill_id UUID NOT NULL REFERENCES superbills(id) ON DELETE CASCADE,
        patient_paid DECIMAL(12, 2) DEFAULT 0.00,
        insurance_paid DECIMAL(12, 2) DEFAULT 0.00,
        adjustment DECIMAL(12, 2) DEFAULT 0.00,
        balance_due DECIMAL(12, 2) DEFAULT 0.00,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(superbill_id)
      )
    `);

        // Indexes
        console.log('Creating indexes...');
        await client.query('CREATE INDEX IF NOT EXISTS idx_superbills_patient ON superbills(patient_id)');
        await client.query('CREATE INDEX IF NOT EXISTS idx_superbills_visit ON superbills(visit_id)');
        await client.query('CREATE INDEX IF NOT EXISTS idx_superbills_status ON superbills(status)');
        await client.query('CREATE INDEX IF NOT EXISTS idx_superbills_created_at ON superbills(created_at)');
        await client.query('CREATE INDEX IF NOT EXISTS idx_superbill_diagnoses_superbill ON superbill_diagnoses(superbill_id)');
        await client.query('CREATE INDEX IF NOT EXISTS idx_superbill_lines_superbill ON superbill_lines(superbill_id)');

        await client.query('COMMIT');
        console.log('✅ Superbill migration completed successfully');
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Superbill migration failed:', error);
        process.exit(1);
    } finally {
        client.release();
    }
}

migrate();
