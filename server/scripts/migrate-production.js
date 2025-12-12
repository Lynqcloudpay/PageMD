const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'paper_emr',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

async function migrateProduction() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    console.log('🚀 Starting production database migration...');

    // ============================================
    // 1. IMMUNIZATIONS TABLE (OpenEMR style)
    // ============================================
    await client.query(`
      CREATE TABLE IF NOT EXISTS immunizations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        cvx_code VARCHAR(10),
        immunization_name VARCHAR(255) NOT NULL,
        administration_date DATE NOT NULL,
        lot_number VARCHAR(100),
        manufacturer VARCHAR(255),
        route VARCHAR(50),
        site VARCHAR(50),
        administered_by UUID REFERENCES users(id),
        information_source VARCHAR(50),
        refusal_reason TEXT,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Created immunizations table');

    // ============================================
    // 2. PROCEDURES TABLE (OpenEMR style)
    // ============================================
    await client.query(`
      CREATE TABLE IF NOT EXISTS procedures (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        visit_id UUID REFERENCES visits(id),
        procedure_code VARCHAR(50),
        procedure_name VARCHAR(255) NOT NULL,
        procedure_date DATE NOT NULL,
        performed_by UUID REFERENCES users(id),
        cpt_code VARCHAR(20),
        diagnosis_code VARCHAR(20),
        notes TEXT,
        status VARCHAR(50) DEFAULT 'completed',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Created procedures table');

    // ============================================
    // 3. ENHANCED PRESCRIPTIONS TABLE
    // ============================================
    await client.query(`
      CREATE TABLE IF NOT EXISTS prescriptions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        visit_id UUID REFERENCES visits(id),
        medication_name VARCHAR(255) NOT NULL,
        ndc_code VARCHAR(20),
        rx_number VARCHAR(100),
        dosage VARCHAR(100),
        frequency VARCHAR(100),
        quantity DECIMAL(10,2),
        days_supply INTEGER,
        refills INTEGER DEFAULT 0,
        route VARCHAR(50),
        sig TEXT,
        prescriber_id UUID NOT NULL REFERENCES users(id),
        pharmacy_name VARCHAR(255),
        pharmacy_npi VARCHAR(20),
        status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'discontinued', 'completed', 'cancelled')),
        start_date DATE,
        end_date DATE,
        last_filled_date DATE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Created prescriptions table');

    // ============================================
    // 4. DRUG INTERACTIONS TABLE
    // ============================================
    await client.query(`
      CREATE TABLE IF NOT EXISTS drug_interactions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        medication1 VARCHAR(255) NOT NULL,
        medication2 VARCHAR(255) NOT NULL,
        severity VARCHAR(20) CHECK (severity IN ('mild', 'moderate', 'severe', 'contraindicated')),
        description TEXT,
        clinical_significance TEXT,
        source VARCHAR(100),
        active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Created drug_interactions table');

    // ============================================
    // 5. INSURANCE ELIGIBILITY TABLE
    // ============================================
    await client.query(`
      CREATE TABLE IF NOT EXISTS insurance_eligibility (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        insurance_provider VARCHAR(255) NOT NULL,
        policy_number VARCHAR(100),
        group_number VARCHAR(100),
        eligibility_status VARCHAR(50),
        coverage_start_date DATE,
        coverage_end_date DATE,
        copay_amount DECIMAL(10,2),
        deductible DECIMAL(10,2),
        last_verified_at TIMESTAMP,
        verified_by UUID REFERENCES users(id),
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Created insurance_eligibility table');

    // ============================================
    // 6. PATIENT PORTAL ACCESS TABLE
    // ============================================
    await client.query(`
      CREATE TABLE IF NOT EXISTS patient_portal_access (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        username VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        email VARCHAR(255),
        phone VARCHAR(20),
        active BOOLEAN DEFAULT true,
        last_login TIMESTAMP,
        failed_login_attempts INTEGER DEFAULT 0,
        locked_until TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Created patient_portal_access table');

    // ============================================
    // 7. CLINICAL QUALITY MEASURES TABLE
    // ============================================
    await client.query(`
      CREATE TABLE IF NOT EXISTS clinical_quality_measures (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        measure_id VARCHAR(50) NOT NULL,
        measure_name VARCHAR(255) NOT NULL,
        numerator_value DECIMAL(10,2),
        denominator_value DECIMAL(10,2),
        performance_rate DECIMAL(5,2),
        status VARCHAR(50),
        reporting_period_start DATE,
        reporting_period_end DATE,
        calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Created clinical_quality_measures table');

    // ============================================
    // 8. FACILITIES TABLE (Multi-location support)
    // ============================================
    await client.query(`
      CREATE TABLE IF NOT EXISTS facilities (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        facility_npi VARCHAR(20),
        address_line1 VARCHAR(255),
        address_line2 VARCHAR(255),
        city VARCHAR(100),
        state VARCHAR(50),
        zip VARCHAR(20),
        phone VARCHAR(20),
        fax VARCHAR(20),
        email VARCHAR(255),
        active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Created facilities table');

    // ============================================
    // 9. USER PREFERENCES TABLE
    // ============================================
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_preferences (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        preference_key VARCHAR(100) NOT NULL,
        preference_value TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, preference_key)
      )
    `);
    console.log('✅ Created user_preferences table');

    // ============================================
    // 10. FORM ENCOUNTERS TABLE (Structured forms)
    // ============================================
    await client.query(`
      CREATE TABLE IF NOT EXISTS form_encounters (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        visit_id UUID REFERENCES visits(id),
        form_name VARCHAR(100) NOT NULL,
        form_data JSONB NOT NULL,
        created_by UUID NOT NULL REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Created form_encounters table');

    // ============================================
    // 11. ENHANCED USERS TABLE (Add MFA fields)
    // ============================================
    await client.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS mfa_enabled BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS mfa_secret VARCHAR(255),
      ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS locked_until TIMESTAMP,
      ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS last_login_ip VARCHAR(45),
      ADD COLUMN IF NOT EXISTS facility_id UUID REFERENCES facilities(id),
      ADD COLUMN IF NOT EXISTS npi VARCHAR(20),
      ADD COLUMN IF NOT EXISTS dea_number VARCHAR(20),
      ADD COLUMN IF NOT EXISTS license_number VARCHAR(50)
    `);
    console.log('✅ Enhanced users table with MFA and security fields');

    // ============================================
    // 12. ENHANCED PATIENTS TABLE (Add portal fields)
    // ============================================
    await client.query(`
      ALTER TABLE patients
      ADD COLUMN IF NOT EXISTS portal_access_enabled BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS emergency_contact_name VARCHAR(255),
      ADD COLUMN IF NOT EXISTS emergency_contact_phone VARCHAR(20),
      ADD COLUMN IF NOT EXISTS emergency_contact_relationship VARCHAR(50),
      ADD COLUMN IF NOT EXISTS preferred_language VARCHAR(50),
      ADD COLUMN IF NOT EXISTS race VARCHAR(50),
      ADD COLUMN IF NOT EXISTS ethnicity VARCHAR(50),
      ADD COLUMN IF NOT EXISTS deceased BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS deceased_date DATE
    `);
    console.log('✅ Enhanced patients table with portal and demographic fields');

    // ============================================
    // 13. ENHANCED VISITS TABLE (Add facility, encounter type)
    // ============================================
    await client.query(`
      ALTER TABLE visits
      ADD COLUMN IF NOT EXISTS facility_id UUID REFERENCES facilities(id),
      ADD COLUMN IF NOT EXISTS encounter_type VARCHAR(50),
      ADD COLUMN IF NOT EXISTS billing_note TEXT,
      ADD COLUMN IF NOT EXISTS copay_collected DECIMAL(10,2),
      ADD COLUMN IF NOT EXISTS copay_due DECIMAL(10,2)
    `);
    console.log('✅ Enhanced visits table with facility and billing fields');

    // ============================================
    // 14. ENHANCED CLAIMS TABLE (Add more billing fields)
    // ============================================
    await client.query(`
      ALTER TABLE claims
      ADD COLUMN IF NOT EXISTS claim_type VARCHAR(50),
      ADD COLUMN IF NOT EXISTS place_of_service VARCHAR(10),
      ADD COLUMN IF NOT EXISTS rendering_provider_npi VARCHAR(20),
      ADD COLUMN IF NOT EXISTS billing_provider_npi VARCHAR(20),
      ADD COLUMN IF NOT EXISTS facility_npi VARCHAR(20),
      ADD COLUMN IF NOT EXISTS patient_account_number VARCHAR(100),
      ADD COLUMN IF NOT EXISTS claim_control_number VARCHAR(50),
      ADD COLUMN IF NOT EXISTS payer_claim_number VARCHAR(100),
      ADD COLUMN IF NOT EXISTS adjustment_reason_code VARCHAR(10),
      ADD COLUMN IF NOT EXISTS adjustment_amount DECIMAL(10,2),
      ADD COLUMN IF NOT EXISTS patient_responsibility DECIMAL(10,2),
      ADD COLUMN IF NOT EXISTS paid_amount DECIMAL(10,2),
      ADD COLUMN IF NOT EXISTS denial_reason TEXT,
      ADD COLUMN IF NOT EXISTS claim_file_path TEXT
    `);
    console.log('✅ Enhanced claims table with comprehensive billing fields');

    // ============================================
    // 15. CREATE INDEXES FOR PERFORMANCE
    // ============================================
    await client.query('CREATE INDEX IF NOT EXISTS idx_immunizations_patient ON immunizations(patient_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_immunizations_date ON immunizations(administration_date DESC)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_procedures_patient ON procedures(patient_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_procedures_visit ON procedures(visit_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_prescriptions_patient ON prescriptions(patient_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_prescriptions_status ON prescriptions(status)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_drug_interactions_meds ON drug_interactions(medication1, medication2)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_insurance_eligibility_patient ON insurance_eligibility(patient_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_portal_access_patient ON patient_portal_access(patient_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_portal_access_username ON patient_portal_access(username)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_quality_measures_patient ON clinical_quality_measures(patient_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_user_preferences_user ON user_preferences(user_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_form_encounters_patient ON form_encounters(patient_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_form_encounters_visit ON form_encounters(visit_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_users_facility ON users(facility_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_visits_facility ON visits(facility_id)');
    console.log('✅ Created performance indexes');

    await client.query('COMMIT');
    console.log('\n✅ Production database migration completed successfully!');
    console.log('\n📋 Summary of additions:');
    console.log('   - Immunizations tracking');
    console.log('   - Procedures tracking');
    console.log('   - Enhanced prescriptions with NDC codes');
    console.log('   - Drug interaction checking');
    console.log('   - Insurance eligibility verification');
    console.log('   - Patient portal access');
    console.log('   - Clinical quality measures');
    console.log('   - Multi-location support (facilities)');
    console.log('   - User preferences');
    console.log('   - Form encounters');
    console.log('   - Enhanced security (MFA, login tracking)');
    console.log('   - Enhanced billing/claims');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Production migration failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

migrateProduction().catch(console.error);






























