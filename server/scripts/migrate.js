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

    // Users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        first_name VARCHAR(100) NOT NULL,
        last_name VARCHAR(100) NOT NULL,
        role VARCHAR(50) NOT NULL CHECK (role IN ('clinician', 'nurse', 'front_desk', 'admin')),
        active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Patients table
    await client.query(`
      CREATE TABLE IF NOT EXISTS patients (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        mrn VARCHAR(50) UNIQUE NOT NULL,
        first_name VARCHAR(100) NOT NULL,
        last_name VARCHAR(100) NOT NULL,
        dob DATE NOT NULL,
        sex VARCHAR(10) CHECK (sex IN ('M', 'F', 'Other')),
        phone VARCHAR(20),
        email VARCHAR(255),
        address_line1 VARCHAR(255),
        address_line2 VARCHAR(255),
        city VARCHAR(100),
        state VARCHAR(50),
        zip VARCHAR(20),
        primary_care_provider UUID REFERENCES users(id),
        insurance_provider VARCHAR(255),
        insurance_id VARCHAR(100),
        pharmacy_name VARCHAR(255),
        pharmacy_address TEXT,
        pharmacy_phone VARCHAR(20),
        photo_url TEXT,
        photo_document_id UUID,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Add pharmacy columns if they don't exist (for existing databases)
    await client.query(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='patients' AND column_name='pharmacy_name') THEN
          ALTER TABLE patients ADD COLUMN pharmacy_name VARCHAR(255);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='patients' AND column_name='pharmacy_address') THEN
          ALTER TABLE patients ADD COLUMN pharmacy_address TEXT;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='patients' AND column_name='pharmacy_phone') THEN
          ALTER TABLE patients ADD COLUMN pharmacy_phone VARCHAR(20);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='patients' AND column_name='photo_url') THEN
          ALTER TABLE patients ADD COLUMN photo_url TEXT;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='patients' AND column_name='photo_document_id') THEN
          ALTER TABLE patients ADD COLUMN photo_document_id UUID;
        END IF;
      END $$;
    `);

    // Allergies table
    await client.query(`
      CREATE TABLE IF NOT EXISTS allergies (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        allergen VARCHAR(255) NOT NULL,
        reaction VARCHAR(255),
        severity VARCHAR(50),
        onset_date DATE,
        active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Medications table
    await client.query(`
      CREATE TABLE IF NOT EXISTS medications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        medication_name VARCHAR(255) NOT NULL,
        dosage VARCHAR(100),
        frequency VARCHAR(100),
        route VARCHAR(50),
        start_date DATE,
        end_date DATE,
        active BOOLEAN DEFAULT true,
        prescriber_id UUID REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Problems table
    await client.query(`
      CREATE TABLE IF NOT EXISTS problems (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        problem_name VARCHAR(255) NOT NULL,
        icd10_code VARCHAR(20),
        onset_date DATE,
        status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'resolved', 'inactive')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Family History table
    await client.query(`
      CREATE TABLE IF NOT EXISTS family_history (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        condition VARCHAR(255) NOT NULL,
        relationship VARCHAR(100) NOT NULL,
        age_at_diagnosis INTEGER,
        age_at_death INTEGER,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Social History table
    await client.query(`
      CREATE TABLE IF NOT EXISTS social_history (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        smoking_status VARCHAR(50),
        smoking_pack_years DECIMAL(5,2),
        alcohol_use VARCHAR(50),
        alcohol_quantity VARCHAR(100),
        drug_use VARCHAR(50),
        exercise_frequency VARCHAR(100),
        diet VARCHAR(100),
        occupation VARCHAR(255),
        living_situation VARCHAR(255),
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Visits/Encounters table
    await client.query(`
      CREATE TABLE IF NOT EXISTS visits (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        visit_date TIMESTAMP NOT NULL,
        visit_type VARCHAR(50),
        provider_id UUID NOT NULL REFERENCES users(id),
        vitals JSONB,
        note_draft TEXT,
        note_signed_by UUID REFERENCES users(id),
        note_signed_at TIMESTAMP,
        addendums JSONB,
        locked BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Orders table
    await client.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        visit_id UUID REFERENCES visits(id),
        order_type VARCHAR(50) NOT NULL CHECK (order_type IN ('lab', 'imaging', 'rx', 'referral')),
        status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'completed', 'cancelled')),
        ordered_by UUID NOT NULL REFERENCES users(id),
        order_payload JSONB,
        external_order_id VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Documents table
    await client.query(`
      CREATE TABLE IF NOT EXISTS documents (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        visit_id UUID REFERENCES visits(id),
        uploader_id UUID NOT NULL REFERENCES users(id),
        doc_type VARCHAR(50) CHECK (doc_type IN ('imaging', 'consult', 'lab', 'other', 'profile_photo', 'visit_note', 'note', 'patient_education', 'consent')),
        filename VARCHAR(255) NOT NULL,
        file_path VARCHAR(500) NOT NULL,
        mime_type VARCHAR(100),
        file_size BIGINT,
        tags TEXT[],
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Referrals table
    await client.query(`
      CREATE TABLE IF NOT EXISTS referrals (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        visit_id UUID REFERENCES visits(id),
        created_by UUID NOT NULL REFERENCES users(id),
        recipient_name VARCHAR(255),
        recipient_specialty VARCHAR(100),
        recipient_address TEXT,
        reason TEXT NOT NULL,
        status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'completed', 'cancelled')),
        referral_letter TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Messages/Tasks table
    await client.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
        from_user_id UUID NOT NULL REFERENCES users(id),
        to_user_id UUID REFERENCES users(id),
        subject VARCHAR(255),
        body TEXT NOT NULL,
        message_type VARCHAR(50) DEFAULT 'message' CHECK (message_type IN ('message', 'task')),
        task_status VARCHAR(50) DEFAULT 'open' CHECK (task_status IN ('open', 'in_progress', 'completed')),
        priority VARCHAR(20) DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
        read_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Appointments table
    await client.query(`
      CREATE TABLE IF NOT EXISTS appointments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        provider_id UUID NOT NULL REFERENCES users(id),
        appointment_date DATE NOT NULL,
        appointment_time TIME NOT NULL,
        duration INTEGER DEFAULT 30,
        appointment_type VARCHAR(50) DEFAULT 'Follow-up' CHECK (appointment_type IN ('Follow-up', 'New Patient', 'Sick Visit', 'Physical')),
        status VARCHAR(50) DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'confirmed', 'checked-in', 'in-progress', 'completed', 'cancelled', 'no-show')),
        notes TEXT,
        created_by UUID NOT NULL REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Audit log table - Enhanced for OpenEMR compliance
    await client.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id),
        action VARCHAR(100) NOT NULL,
        target_type VARCHAR(50) NOT NULL,
        target_id UUID,
        ip_address VARCHAR(45),
        user_agent TEXT,
        details JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Sessions table for session management
    await client.query(`
      CREATE TABLE IF NOT EXISTS sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token_hash VARCHAR(255) NOT NULL,
        ip_address VARCHAR(45),
        user_agent TEXT,
        expires_at TIMESTAMP NOT NULL,
        last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Fee schedule table (OpenEMR style)
    await client.query(`
      CREATE TABLE IF NOT EXISTS fee_schedule (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        code_type VARCHAR(20) NOT NULL CHECK (code_type IN ('CPT', 'HCPCS', 'ICD10')),
        code VARCHAR(50) NOT NULL,
        description TEXT,
        fee_amount DECIMAL(10, 2),
        active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(code_type, code)
      )
    `);

    // Claims table (OpenEMR style)
    await client.query(`
      CREATE TABLE IF NOT EXISTS claims (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        visit_id UUID REFERENCES visits(id),
        patient_id UUID NOT NULL REFERENCES patients(id),
        diagnosis_codes JSONB,
        procedure_codes JSONB,
        total_amount DECIMAL(10, 2),
        status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'submitted', 'paid', 'denied', 'cancelled')),
        insurance_provider VARCHAR(255),
        claim_number VARCHAR(100),
        submitted_at TIMESTAMP,
        paid_at TIMESTAMP,
        created_by UUID NOT NULL REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Insurance plans table
    await client.query(`
      CREATE TABLE IF NOT EXISTS insurance_plans (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        payer_id VARCHAR(50),
        plan_type VARCHAR(50),
        active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Clinical alerts table (OpenEMR style)
    await client.query(`
      CREATE TABLE IF NOT EXISTS clinical_alerts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        alert_type VARCHAR(50) NOT NULL,
        severity VARCHAR(20) DEFAULT 'normal' CHECK (severity IN ('low', 'normal', 'high', 'critical')),
        message TEXT NOT NULL,
        rule_name VARCHAR(100),
        active BOOLEAN DEFAULT true,
        acknowledged_by UUID REFERENCES users(id),
        acknowledged_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Lab reference ranges table
    await client.query(`
      CREATE TABLE IF NOT EXISTS lab_reference_ranges (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        test_name VARCHAR(255) NOT NULL,
        test_code VARCHAR(50),
        age_min INTEGER,
        age_max INTEGER,
        sex VARCHAR(10),
        normal_min DECIMAL(10, 2),
        normal_max DECIMAL(10, 2),
        units VARCHAR(50),
        critical_low DECIMAL(10, 2),
        critical_high DECIMAL(10, 2),
        active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Enhance orders table with lab-specific fields
    await client.query(`
      ALTER TABLE orders 
      ADD COLUMN IF NOT EXISTS test_name VARCHAR(255),
      ADD COLUMN IF NOT EXISTS test_code VARCHAR(50),
      ADD COLUMN IF NOT EXISTS result_value TEXT,
      ADD COLUMN IF NOT EXISTS result_units VARCHAR(50),
      ADD COLUMN IF NOT EXISTS reference_range VARCHAR(100),
      ADD COLUMN IF NOT EXISTS abnormal_flags VARCHAR(10),
      ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS external_id VARCHAR(255),
      ADD COLUMN IF NOT EXISTS reviewed BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES users(id),
      ADD COLUMN IF NOT EXISTS comment TEXT,
      ADD COLUMN IF NOT EXISTS comments JSONB DEFAULT '[]'::jsonb
    `);

    // Add reviewed fields to documents table
    await client.query(`
      ALTER TABLE documents
      ADD COLUMN IF NOT EXISTS reviewed BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES users(id),
      ADD COLUMN IF NOT EXISTS comment TEXT,
      ADD COLUMN IF NOT EXISTS comments JSONB DEFAULT '[]'::jsonb
    `);

    // Create indexes
    await client.query('CREATE INDEX IF NOT EXISTS idx_patients_mrn ON patients(mrn)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_patients_name ON patients(last_name, first_name)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_visits_patient ON visits(patient_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_visits_date ON visits(visit_date DESC)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_orders_patient ON orders(patient_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_documents_patient ON documents(patient_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_audit_logs_target ON audit_logs(target_type, target_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_fee_schedule_code ON fee_schedule(code_type, code)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_claims_patient ON claims(patient_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_claims_visit ON claims(visit_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_clinical_alerts_patient ON clinical_alerts(patient_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_clinical_alerts_active ON clinical_alerts(active, severity)');

    await client.query('COMMIT');
    console.log('✅ Database migration completed successfully');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch(console.error);



