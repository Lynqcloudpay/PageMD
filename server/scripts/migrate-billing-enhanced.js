const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'paper_emr',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

async function migrateBillingEnhanced() {
  const client = await pool.connect();
  
  try {
    console.log('🔄 Creating comprehensive billing system schema...');
    
    await client.query('BEGIN');

    // Enhanced Claims table - Commercial grade structure
    await client.query(`
      -- Drop existing claims table if needed and recreate with enhanced structure
      CREATE TABLE IF NOT EXISTS claims (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        claim_number VARCHAR(100) UNIQUE,
        visit_id UUID REFERENCES visits(id) ON DELETE SET NULL,
        patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        
        -- Provider Information
        rendering_provider_id UUID REFERENCES users(id),
        billing_provider_id UUID REFERENCES users(id),
        facility_id UUID,
        
        -- Insurance Information
        insurance_type VARCHAR(50) CHECK (insurance_type IN ('primary', 'secondary', 'tertiary')),
        insurance_provider VARCHAR(255),
        insurance_payer_id VARCHAR(50),
        insurance_group_number VARCHAR(100),
        insurance_member_id VARCHAR(100),
        insurance_plan_name VARCHAR(255),
        insurance_relationship_code VARCHAR(10), -- '01'=Self, '02'=Spouse, etc.
        
        -- Service Information
        service_date_start DATE NOT NULL,
        service_date_end DATE,
        place_of_service_code VARCHAR(2), -- 11=Office, 21=Inpatient, etc.
        claim_type VARCHAR(20) DEFAULT 'professional' CHECK (claim_type IN ('professional', 'institutional', 'dme')),
        
        -- Diagnosis Codes (up to 12 per claim)
        diagnosis_codes JSONB NOT NULL DEFAULT '[]'::jsonb,
        principal_diagnosis_code VARCHAR(20),
        
        -- Procedure Codes
        procedure_codes JSONB NOT NULL DEFAULT '[]'::jsonb,
        
        -- Financial Information
        total_charges DECIMAL(10, 2) NOT NULL DEFAULT 0,
        amount_paid DECIMAL(10, 2) DEFAULT 0,
        patient_responsibility DECIMAL(10, 2) DEFAULT 0,
        insurance_allowed DECIMAL(10, 2),
        write_off_amount DECIMAL(10, 2) DEFAULT 0,
        adjustments DECIMAL(10, 2) DEFAULT 0,
        
        -- Claim Status
        status VARCHAR(50) DEFAULT 'draft' CHECK (status IN (
          'draft', 'ready_to_submit', 'queued', 'submitted', 
          'accepted', 'rejected', 'pending', 'paid', 'partial_paid', 
          'denied', 'appealed', 'closed', 'cancelled', 'voided'
        )),
        
        -- Submission Information
        submission_method VARCHAR(50) CHECK (submission_method IN ('electronic', 'paper', 'direct_entry')),
        submitted_at TIMESTAMP,
        submitted_by UUID REFERENCES users(id),
        payer_claim_control_number VARCHAR(50),
        
        -- Response Information
        payer_response_received_at TIMESTAMP,
        payer_response_code VARCHAR(20),
        payer_response_message TEXT,
        
        -- Payment Information
        payment_received_at TIMESTAMP,
        payment_method VARCHAR(50),
        payment_check_number VARCHAR(100),
        payment_check_date DATE,
        
        -- Denial Information
        denial_code VARCHAR(10),
        denial_reason TEXT,
        denial_category VARCHAR(50),
        
        -- Audit Trail
        created_by UUID NOT NULL REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_by UUID REFERENCES users(id),
        
        -- Additional Metadata
        notes TEXT,
        attachments JSONB DEFAULT '[]'::jsonb,
        custom_fields JSONB DEFAULT '{}'::jsonb
      )
    `);

    // Claim Line Items - Detailed procedure-level billing
    await client.query(`
      CREATE TABLE IF NOT EXISTS claim_line_items (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        claim_id UUID NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
        
        -- Service Information
        line_number INTEGER NOT NULL,
        service_date DATE NOT NULL,
        place_of_service_code VARCHAR(2),
        
        -- Procedure Code
        procedure_code VARCHAR(20) NOT NULL,
        procedure_modifier VARCHAR(10),
        procedure_description TEXT,
        
        -- Diagnosis Pointers (which diagnosis codes link to this procedure)
        diagnosis_pointers INTEGER[] DEFAULT '{}',
        
        -- Financial Information
        units DECIMAL(10, 2) DEFAULT 1,
        unit_charge DECIMAL(10, 2) NOT NULL,
        line_total DECIMAL(10, 2) NOT NULL,
        allowed_amount DECIMAL(10, 2),
        paid_amount DECIMAL(10, 2) DEFAULT 0,
        adjustment_amount DECIMAL(10, 2) DEFAULT 0,
        patient_responsibility DECIMAL(10, 2) DEFAULT 0,
        
        -- Status
        status VARCHAR(50) DEFAULT 'pending',
        denial_code VARCHAR(10),
        denial_reason TEXT,
        
        -- Audit
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Secondary/Tertiary Claims - For coordination of benefits
    await client.query(`
      CREATE TABLE IF NOT EXISTS secondary_claims (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        primary_claim_id UUID NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
        
        -- Secondary Insurance Info
        insurance_provider VARCHAR(255),
        insurance_payer_id VARCHAR(50),
        insurance_group_number VARCHAR(100),
        insurance_member_id VARCHAR(100),
        
        -- Amounts from primary
        primary_paid_amount DECIMAL(10, 2),
        primary_denial_amount DECIMAL(10, 2),
        
        -- Secondary claim amounts
        secondary_charges DECIMAL(10, 2),
        secondary_paid_amount DECIMAL(10, 2) DEFAULT 0,
        secondary_patient_responsibility DECIMAL(10, 2) DEFAULT 0,
        
        -- Status
        status VARCHAR(50) DEFAULT 'pending',
        submitted_at TIMESTAMP,
        payment_received_at TIMESTAMP,
        
        -- Audit
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Claim Attachments - For documentation, EOBs, etc.
    await client.query(`
      CREATE TABLE IF NOT EXISTS claim_attachments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        claim_id UUID NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
        
        attachment_type VARCHAR(50) NOT NULL CHECK (attachment_type IN (
          'eob', 'remittance_advice', 'medical_record', 'authorization', 
          'supporting_documentation', 'appeal_letter', 'other'
        )),
        filename VARCHAR(255) NOT NULL,
        file_path TEXT NOT NULL,
        file_size INTEGER,
        mime_type VARCHAR(100),
        
        description TEXT,
        uploaded_by UUID REFERENCES users(id),
        uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Insurance Eligibility Verifications
    await client.query(`
      CREATE TABLE IF NOT EXISTS insurance_eligibility (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        claim_id UUID REFERENCES claims(id) ON DELETE SET NULL,
        
        -- Insurance Info
        insurance_provider VARCHAR(255),
        insurance_payer_id VARCHAR(50),
        insurance_member_id VARCHAR(100),
        insurance_group_number VARCHAR(100),
        
        -- Eligibility Results
        eligibility_status VARCHAR(50) CHECK (eligibility_status IN ('active', 'inactive', 'terminated', 'pending', 'unknown')),
        effective_date DATE,
        termination_date DATE,
        
        -- Coverage Details
        coverage_type VARCHAR(50),
        plan_type VARCHAR(100),
        copay_amount DECIMAL(10, 2),
        deductible_amount DECIMAL(10, 2),
        deductible_met DECIMAL(10, 2) DEFAULT 0,
        out_of_pocket_max DECIMAL(10, 2),
        out_of_pocket_met DECIMAL(10, 2) DEFAULT 0,
        
        -- Benefits
        benefits JSONB DEFAULT '{}'::jsonb,
        limitations TEXT,
        
        -- Verification Details
        verified_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        verified_by UUID REFERENCES users(id),
        verification_method VARCHAR(50),
        verification_response TEXT,
        
        -- Audit
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP
      )
    `);

    // Prior Authorizations
    await client.query(`
      CREATE TABLE IF NOT EXISTS prior_authorizations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        claim_id UUID REFERENCES claims(id) ON DELETE SET NULL,
        
        -- Authorization Info
        authorization_number VARCHAR(100),
        insurance_provider VARCHAR(255),
        insurance_payer_id VARCHAR(50),
        
        -- Service Information
        procedure_codes VARCHAR(20)[],
        diagnosis_codes VARCHAR(20)[],
        requested_units DECIMAL(10, 2),
        
        -- Dates
        requested_date DATE NOT NULL,
        service_start_date DATE,
        service_end_date DATE,
        expiration_date DATE,
        
        -- Status
        status VARCHAR(50) DEFAULT 'pending' CHECK (status IN (
          'pending', 'approved', 'approved_partial', 'denied', 
          'expired', 'cancelled'
        )),
        
        -- Approval Details
        approved_units DECIMAL(10, 2),
        approved_amount DECIMAL(10, 2),
        denial_reason TEXT,
        
        -- Request Details
        requested_by UUID REFERENCES users(id),
        requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        response_received_at TIMESTAMP,
        response_notes TEXT,
        
        -- Audit
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Payment Postings
    await client.query(`
      CREATE TABLE IF NOT EXISTS payment_postings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        claim_id UUID REFERENCES claims(id) ON DELETE SET NULL,
        
        -- Payment Information
        payment_date DATE NOT NULL,
        payment_amount DECIMAL(10, 2) NOT NULL,
        payment_method VARCHAR(50),
        payment_type VARCHAR(50) CHECK (payment_type IN (
          'insurance_payment', 'patient_payment', 'adjustment', 
          'refund', 'transfer', 'other'
        )),
        
        -- Check/Reference Information
        check_number VARCHAR(100),
        check_date DATE,
        reference_number VARCHAR(100),
        trace_number VARCHAR(100),
        
        -- Allocation
        allocated_amount DECIMAL(10, 2),
        unallocated_amount DECIMAL(10, 2),
        allocation_notes TEXT,
        
        -- EOB Information
        eob_id UUID,
        remittance_advice_id UUID,
        
        -- Audit
        posted_by UUID REFERENCES users(id),
        posted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Payment Allocations - Link payments to specific line items
    await client.query(`
      CREATE TABLE IF NOT EXISTS payment_allocations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        payment_posting_id UUID NOT NULL REFERENCES payment_postings(id) ON DELETE CASCADE,
        claim_line_item_id UUID REFERENCES claim_line_items(id) ON DELETE SET NULL,
        
        allocated_amount DECIMAL(10, 2) NOT NULL,
        adjustment_amount DECIMAL(10, 2) DEFAULT 0,
        patient_responsibility DECIMAL(10, 2) DEFAULT 0,
        
        allocation_type VARCHAR(50),
        notes TEXT,
        
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Denials and Appeals
    await client.query(`
      CREATE TABLE IF NOT EXISTS claim_denials (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        claim_id UUID NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
        claim_line_item_id UUID REFERENCES claim_line_items(id) ON DELETE SET NULL,
        
        -- Denial Information
        denial_code VARCHAR(10) NOT NULL,
        denial_reason TEXT NOT NULL,
        denial_category VARCHAR(50),
        denial_date DATE,
        
        -- Appeal Information
        appeal_status VARCHAR(50) DEFAULT 'not_appealed' CHECK (appeal_status IN (
          'not_appealed', 'appeal_submitted', 'appeal_under_review', 
          'appeal_approved', 'appeal_denied', 'appeal_withdrawn'
        )),
        appeal_submitted_date DATE,
        appeal_response_date DATE,
        appeal_response TEXT,
        
        -- Resolution
        resolved BOOLEAN DEFAULT false,
        resolved_date DATE,
        resolution_notes TEXT,
        
        -- Audit
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Claim Workflow History - Track all status changes
    await client.query(`
      CREATE TABLE IF NOT EXISTS claim_workflow_history (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        claim_id UUID NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
        
        from_status VARCHAR(50),
        to_status VARCHAR(50) NOT NULL,
        action VARCHAR(100),
        
        notes TEXT,
        performed_by UUID REFERENCES users(id),
        performed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        
        -- Additional context
        metadata JSONB DEFAULT '{}'::jsonb
      )
    `);

    // Migrate existing claims data if needed - DO THIS BEFORE INDEXES
    await client.query(`
      DO $$
      BEGIN
        -- Add new columns to existing claims table if they don't exist
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='claims') THEN
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='claims' AND column_name='claim_number') THEN
            ALTER TABLE claims ADD COLUMN claim_number VARCHAR(100);
          END IF;
          
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='claims' AND column_name='service_date_start') THEN
            ALTER TABLE claims ADD COLUMN service_date_start DATE;
            UPDATE claims SET service_date_start = (SELECT visit_date FROM visits WHERE visits.id = claims.visit_id);
          END IF;
          
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='claims' AND column_name='total_charges') THEN
            ALTER TABLE claims ADD COLUMN total_charges DECIMAL(10, 2);
            UPDATE claims SET total_charges = COALESCE(total_amount, 0);
          END IF;
          
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='claims' AND column_name='insurance_payer_id') THEN
            ALTER TABLE claims ADD COLUMN insurance_payer_id VARCHAR(50);
          END IF;
          
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='claims' AND column_name='place_of_service_code') THEN
            ALTER TABLE claims ADD COLUMN place_of_service_code VARCHAR(2);
          END IF;
        END IF;
      END $$;
    `);

    // Create indexes for performance
    await client.query('CREATE INDEX IF NOT EXISTS idx_claims_patient ON claims(patient_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_claims_visit ON claims(visit_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_claims_status ON claims(status)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_claims_claim_number ON claims(claim_number) WHERE claim_number IS NOT NULL');
    await client.query('CREATE INDEX IF NOT EXISTS idx_claims_submitted_at ON claims(submitted_at) WHERE submitted_at IS NOT NULL');
    await client.query('CREATE INDEX IF NOT EXISTS idx_claims_service_date ON claims(service_date_start) WHERE service_date_start IS NOT NULL');
    await client.query('CREATE INDEX IF NOT EXISTS idx_claim_line_items_claim ON claim_line_items(claim_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_insurance_eligibility_patient ON insurance_eligibility(patient_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_prior_auth_patient ON prior_authorizations(patient_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_prior_auth_status ON prior_authorizations(status)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_payment_postings_claim ON payment_postings(claim_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_claim_denials_claim ON claim_denials(claim_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_claim_workflow_claim ON claim_workflow_history(claim_id)');


    await client.query('COMMIT');
    console.log('✅ Comprehensive billing system schema created successfully');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

migrateBillingEnhanced().catch(console.error);

