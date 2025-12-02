/**
 * Database Migration: E-Prescribing & Enhanced Code Tables
 * 
 * Creates tables for:
 * - Prescriptions (e-prescribing workflow)
 * - Pharmacies (pharmacy directory)
 * - Medication Database (RxNorm cache)
 * - Enhanced ICD-10 codes (full dataset)
 * - Enhanced CPT codes (full dataset)
 * 
 * Run with: node server/scripts/migrate-eprescribing.js
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
    console.log('Starting e-prescribing migration...');

    // ============================================
    // PHARMACIES TABLE
    // ============================================
    console.log('Creating pharmacies table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS pharmacies (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        ncpdp_id VARCHAR(10) UNIQUE, -- National Council for Prescription Drug Programs ID
        npi VARCHAR(10), -- National Provider Identifier
        name VARCHAR(255) NOT NULL,
        phone VARCHAR(20),
        fax VARCHAR(20),
        email VARCHAR(255),
        address_line1 VARCHAR(255),
        address_line2 VARCHAR(255),
        city VARCHAR(100),
        state VARCHAR(50),
        zip VARCHAR(20),
        latitude DECIMAL(10, 8),
        longitude DECIMAL(11, 8),
        pharmacy_type VARCHAR(50), -- 'retail', 'mail_order', 'specialty', etc.
        active BOOLEAN DEFAULT true,
        integration_enabled BOOLEAN DEFAULT false, -- Surescripts/Drug Enforcement Network
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create index for location-based searches
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_pharmacies_location 
      ON pharmacies(latitude, longitude)
      WHERE latitude IS NOT NULL AND longitude IS NOT NULL
    `);

    // Create index for NCPDP lookups
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_pharmacies_ncpdp 
      ON pharmacies(ncpdp_id)
      WHERE ncpdp_id IS NOT NULL
    `);

    // ============================================
    // MEDICATION DATABASE TABLE (RxNorm Cache)
    // ============================================
    console.log('Creating medication_database table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS medication_database (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        rxcui VARCHAR(20) UNIQUE, -- RxNorm Concept Unique Identifier
        name VARCHAR(500) NOT NULL,
        synonym VARCHAR(500), -- Common name
        tty VARCHAR(50), -- Term Type (SCD, SBD, IN, etc.)
        strength VARCHAR(100), -- e.g., "10 MG", "5 MG/ML"
        form VARCHAR(100), -- e.g., "TABLET", "CAPSULE", "SOLUTION"
        route VARCHAR(100), -- e.g., "ORAL", "TOPICAL", "INJECTION"
        ndc VARCHAR(20), -- National Drug Code
        fda_drug_code VARCHAR(20),
        controlled_substance BOOLEAN DEFAULT false,
        schedule VARCHAR(10), -- C-II, C-III, C-IV, C-V if controlled
        drug_class VARCHAR(255), -- Therapeutic class
        drug_category VARCHAR(255),
        fda_approved BOOLEAN DEFAULT true,
        last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        
        -- Search optimization
        search_vector tsvector GENERATED ALWAYS AS (
          to_tsvector('english', 
            COALESCE(name, '') || ' ' || 
            COALESCE(synonym, '') || ' ' || 
            COALESCE(strength, '') || ' ' || 
            COALESCE(form, '')
          )
        ) STORED
      )
    `);

    // Full-text search index
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_medication_search 
      ON medication_database USING GIN(search_vector)
    `);

    // Index for RxCUI lookups
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_medication_rxcui 
      ON medication_database(rxcui)
      WHERE rxcui IS NOT NULL
    `);

    // ============================================
    // PRESCRIPTIONS TABLE
    // ============================================
    console.log('Creating prescriptions table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS prescriptions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        visit_id UUID REFERENCES visits(id) ON DELETE SET NULL,
        prescriber_id UUID NOT NULL REFERENCES users(id),
        prescriber_npi VARCHAR(10),
        prescriber_dea VARCHAR(20),
        
        -- Medication details
        medication_rxcui VARCHAR(20),
        medication_name VARCHAR(500) NOT NULL,
        medication_ndc VARCHAR(20),
        strength VARCHAR(100),
        quantity INTEGER NOT NULL,
        quantity_unit VARCHAR(20) DEFAULT 'EA', -- Each, ML, etc.
        days_supply INTEGER,
        
        -- Sig (Signatura - instructions)
        sig TEXT NOT NULL, -- Full sig text
        sig_structured JSONB, -- Structured sig: {dose, route, frequency, duration}
        
        -- Refills
        refills INTEGER DEFAULT 0,
        refills_remaining INTEGER DEFAULT 0,
        substitution_allowed BOOLEAN DEFAULT true, -- DAW (Dispense As Written)
        
        -- Pharmacy
        pharmacy_id UUID REFERENCES pharmacies(id) ON DELETE SET NULL,
        pharmacy_ncpdp_id VARCHAR(10),
        pharmacy_name VARCHAR(255),
        pharmacy_address TEXT,
        pharmacy_phone VARCHAR(20),
        
        -- Status and workflow
        status VARCHAR(50) DEFAULT 'draft' CHECK (status IN (
          'draft', 'pending', 'sent', 'accepted', 'in_process',
          'ready', 'picked_up', 'expired', 'cancelled', 'denied'
        )),
        
        -- Transmission details
        transmission_method VARCHAR(50), -- 'surescripts', 'fax', 'electronic', 'manual'
        transmission_id VARCHAR(100), -- External system ID
        transmission_status VARCHAR(50),
        transmission_error TEXT,
        sent_at TIMESTAMP,
        received_at TIMESTAMP,
        filled_at TIMESTAMP,
        
        -- Prior authorization
        prior_auth_required BOOLEAN DEFAULT false,
        prior_auth_number VARCHAR(100),
        prior_auth_status VARCHAR(50),
        
        -- Notes and metadata
        clinical_notes TEXT,
        patient_instructions TEXT,
        prescriber_notes TEXT,
        
        -- Controlled substance tracking
        is_controlled BOOLEAN DEFAULT false,
        schedule VARCHAR(10), -- For controlled substances
        
        -- Dates
        written_date DATE NOT NULL DEFAULT CURRENT_DATE,
        start_date DATE,
        end_date DATE,
        expires_date DATE,
        
        -- Audit
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_by UUID NOT NULL REFERENCES users(id)
      )
    `);

    // Indexes for prescriptions
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_prescriptions_patient 
      ON prescriptions(patient_id, created_at DESC)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_prescriptions_status 
      ON prescriptions(status, created_at DESC)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_prescriptions_prescriber 
      ON prescriptions(prescriber_id, created_at DESC)
    `);

    // Create index for medication_rxcui if column exists
    try {
      const columnExists = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.columns 
          WHERE table_name = 'prescriptions' 
          AND column_name = 'medication_rxcui'
        )
      `);
      
      if (columnExists.rows[0].exists) {
        await client.query(`
          CREATE INDEX IF NOT EXISTS idx_prescriptions_rxcui 
          ON prescriptions(medication_rxcui)
          WHERE medication_rxcui IS NOT NULL
        `);
      }
    } catch (idxError) {
      console.warn('Could not create medication_rxcui index:', idxError.message);
    }

    // ============================================
    // ENHANCED ICD-10 CODES TABLE
    // ============================================
    console.log('Creating icd10_codes table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS icd10_codes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        code VARCHAR(20) UNIQUE NOT NULL, -- e.g., "E11.9"
        description TEXT NOT NULL,
        code_type VARCHAR(10) DEFAULT 'ICD10', -- ICD10, ICD10CM, etc.
        
        -- Hierarchical structure
        parent_code VARCHAR(20), -- For category/subcategory relationships
        chapter VARCHAR(10),
        block VARCHAR(20),
        category VARCHAR(20),
        
        -- Additional metadata
        billable BOOLEAN DEFAULT true,
        valid_for_submission BOOLEAN DEFAULT true,
        effective_date DATE,
        end_date DATE,
        
        -- Search optimization
        search_vector tsvector GENERATED ALWAYS AS (
          to_tsvector('english', 
            COALESCE(code, '') || ' ' || 
            COALESCE(description, '')
          )
        ) STORED,
        
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Full-text search index
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_icd10_search 
      ON icd10_codes USING GIN(search_vector)
    `);

    // Index for code lookups
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_icd10_code 
      ON icd10_codes(code)
    `);

    // Index for hierarchical queries
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_icd10_parent 
      ON icd10_codes(parent_code)
      WHERE parent_code IS NOT NULL
    `);

    // ============================================
    // ENHANCED CPT CODES TABLE
    // ============================================
    console.log('Creating cpt_codes table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS cpt_codes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        code VARCHAR(20) UNIQUE NOT NULL, -- e.g., "99213"
        description TEXT NOT NULL,
        code_type VARCHAR(10) DEFAULT 'CPT', -- CPT, HCPCS, etc.
        
        -- Category information
        category VARCHAR(100), -- Evaluation and Management, etc.
        subsection VARCHAR(200),
        sub_subsection VARCHAR(200),
        
        -- Pricing and billing
        medicare_fee DECIMAL(10, 2),
        global_period VARCHAR(50), -- 000, 010, 090, XXX
        modifier_51_exempt BOOLEAN DEFAULT false,
        add_on_code BOOLEAN DEFAULT false,
        
        -- Validity
        effective_date DATE,
        end_date DATE,
        active BOOLEAN DEFAULT true,
        
        -- Search optimization
        search_vector tsvector GENERATED ALWAYS AS (
          to_tsvector('english', 
            COALESCE(code, '') || ' ' || 
            COALESCE(description, '')
          )
        ) STORED,
        
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Full-text search index
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_cpt_search 
      ON cpt_codes USING GIN(search_vector)
    `);

    // Index for code lookups
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_cpt_code 
      ON cpt_codes(code)
    `);

    // ============================================
    // PRESCRIPTION INTERACTIONS TABLE
    // ============================================
    console.log('Creating prescription_interactions table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS prescription_interactions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        prescription_id UUID NOT NULL REFERENCES prescriptions(id) ON DELETE CASCADE,
        interaction_type VARCHAR(50), -- 'drug-drug', 'drug-allergy', 'drug-condition'
        severity VARCHAR(50), -- 'severe', 'moderate', 'mild'
        description TEXT,
        medication_name VARCHAR(500),
        medication_rxcui VARCHAR(20),
        detected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_interactions_prescription 
      ON prescription_interactions(prescription_id)
    `);

    // ============================================
    // DRUG INTERACTIONS REFERENCE TABLE
    // ============================================
    console.log('Creating drug_interactions table...');
    
    // Check if table exists and has the right columns
    const drugInteractionsExists = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'drug_interactions'
      )
    `);
    
    const hasRxCUIColumns = drugInteractionsExists.rows[0].exists ? 
      await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.columns 
          WHERE table_name = 'drug_interactions' 
          AND column_name = 'medication1_rxcui'
        )
      `) : { rows: [{ exists: false }] };

    if (!drugInteractionsExists.rows[0].exists) {
      // Create new table with RxCUI columns
      await client.query(`
        CREATE TABLE drug_interactions (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          medication1_rxcui VARCHAR(20) NOT NULL,
          medication2_rxcui VARCHAR(20) NOT NULL,
          interaction_type VARCHAR(50),
          severity VARCHAR(50),
          description TEXT,
          clinical_effect TEXT,
          management TEXT,
          last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          
          UNIQUE(medication1_rxcui, medication2_rxcui)
        )
      `);

      // Create indexes
      await client.query(`
        CREATE INDEX idx_interactions_med1 
        ON drug_interactions(medication1_rxcui)
      `);

      await client.query(`
        CREATE INDEX idx_interactions_med2 
        ON drug_interactions(medication2_rxcui)
      `);
    } else if (!hasRxCUIColumns.rows[0].exists) {
      // Table exists but with old schema - skip creating it
      console.log('⚠️  drug_interactions table exists with different schema. Skipping creation.');
      console.log('   (Table will continue to work with existing schema)');
    } else {
      // Table exists with correct schema - just create indexes if they don't exist
      try {
        await client.query(`
          CREATE INDEX IF NOT EXISTS idx_interactions_med1 
          ON drug_interactions(medication1_rxcui)
        `);
      } catch (idxError) {
        // Index might already exist
      }

      try {
        await client.query(`
          CREATE INDEX IF NOT EXISTS idx_interactions_med2 
          ON drug_interactions(medication2_rxcui)
        `);
      } catch (idxError) {
        // Index might already exist
      }
    }

    await client.query('COMMIT');
    console.log('✅ E-prescribing migration completed successfully!');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run migration
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

