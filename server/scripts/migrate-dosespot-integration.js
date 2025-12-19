/**
 * Database Migration: DoseSpot ePrescribing Integration
 * 
 * Creates tables and columns for:
 * - eprescribe_id_map (vendor entity mapping)
 * - Extends prescriptions table with vendor fields
 * - Ensures audit_logs supports ePrescribing actions
 * 
 * Run with: node server/scripts/migrate-dosespot-integration.js
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
    console.log('Starting DoseSpot ePrescribing integration migration...');

    // ============================================
    // EPRESCRIBE_ID_MAP TABLE
    // ============================================
    console.log('Creating eprescribe_id_map table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS eprescribe_id_map (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        entity_type VARCHAR(50) NOT NULL CHECK (entity_type IN ('patient', 'user', 'pharmacy', 'prescription')),
        entity_id UUID NOT NULL,
        vendor VARCHAR(50) NOT NULL DEFAULT 'dosespot',
        vendor_id VARCHAR(255) NOT NULL,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(entity_type, entity_id, vendor),
        UNIQUE(vendor, vendor_id)
      )
    `);

    // Indexes for eprescribe_id_map
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_eprescribe_map_entity 
      ON eprescribe_id_map(entity_type, entity_id)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_eprescribe_map_vendor 
      ON eprescribe_id_map(vendor, vendor_id)
    `);

    console.log('✅ Created eprescribe_id_map table');

    // ============================================
    // EXTEND PRESCRIPTIONS TABLE
    // ============================================
    console.log('Extending prescriptions table with vendor fields...');

    // Check if prescriptions table exists, if not create it
    const prescriptionsExists = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'prescriptions'
      )
    `);

    if (!prescriptionsExists.rows[0].exists) {
      console.log('Creating prescriptions table (basic structure)...');
      
      // Check if pharmacies table exists
      const pharmaciesExists = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'pharmacies'
        )
      `);
      
      const hasPharmacies = pharmaciesExists.rows[0].exists;
      
      // Build table creation with conditional foreign key
      let createTableSQL = `
        CREATE TABLE prescriptions (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
          visit_id UUID REFERENCES visits(id) ON DELETE SET NULL,
          prescriber_id UUID NOT NULL REFERENCES users(id),
          prescriber_user_id UUID REFERENCES users(id),
          prescriber_npi VARCHAR(10),
          prescriber_dea VARCHAR(20),
          medication_rxcui VARCHAR(20),
          medication_name VARCHAR(500) NOT NULL,
          medication_ndc VARCHAR(20),
          strength VARCHAR(100),
          quantity INTEGER NOT NULL,
          quantity_unit VARCHAR(20) DEFAULT 'EA',
          days_supply INTEGER,
          sig TEXT NOT NULL,
          sig_structured JSONB,
          refills INTEGER DEFAULT 0,
          refills_remaining INTEGER DEFAULT 0,
          substitution_allowed BOOLEAN DEFAULT true,
          pharmacy_ncpdp_id VARCHAR(10),
          pharmacy_name VARCHAR(255),
          pharmacy_address TEXT,
          pharmacy_phone VARCHAR(20),
          status VARCHAR(50) DEFAULT 'draft',
          transmission_method VARCHAR(50),
          transmission_id VARCHAR(100),
          transmission_status VARCHAR(50),
          transmission_error TEXT,
          sent_at TIMESTAMP,
          received_at TIMESTAMP,
          filled_at TIMESTAMP,
          prior_auth_required BOOLEAN DEFAULT false,
          prior_auth_number VARCHAR(100),
          prior_auth_status VARCHAR(50),
          clinical_notes TEXT,
          patient_instructions TEXT,
          prescriber_notes TEXT,
          is_controlled BOOLEAN DEFAULT false,
          schedule VARCHAR(10),
          written_date DATE NOT NULL DEFAULT CURRENT_DATE,
          start_date DATE,
          end_date DATE,
          expires_date DATE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          created_by UUID NOT NULL REFERENCES users(id)
      `;
      
      // Add pharmacy_id foreign key only if pharmacies table exists
      if (hasPharmacies) {
        createTableSQL += `,
          pharmacy_id UUID REFERENCES pharmacies(id) ON DELETE SET NULL`;
      } else {
        createTableSQL += `,
          pharmacy_id UUID`;
      }
      
      createTableSQL += `
        )
      `;
      
      await client.query(createTableSQL);
      console.log('✅ Created prescriptions table');
    }

    // Add vendor_message_id if it doesn't exist
    await client.query(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'prescriptions' 
          AND column_name = 'vendor_message_id'
        ) THEN
          ALTER TABLE prescriptions ADD COLUMN vendor_message_id VARCHAR(255);
        END IF;
      END $$;
    `);

    // Add vendor_payload (JSONB) if it doesn't exist
    await client.query(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'prescriptions' 
          AND column_name = 'vendor_payload'
        ) THEN
          ALTER TABLE prescriptions ADD COLUMN vendor_payload JSONB;
        END IF;
      END $$;
    `);

    // Add prescriber_user_id if it doesn't exist (alias for prescriber_id)
    await client.query(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'prescriptions' 
          AND column_name = 'prescriber_user_id'
        ) THEN
          ALTER TABLE prescriptions ADD COLUMN prescriber_user_id UUID REFERENCES users(id);
          -- Copy data from prescriber_id if it exists
          UPDATE prescriptions 
          SET prescriber_user_id = prescriber_id 
          WHERE prescriber_user_id IS NULL AND prescriber_id IS NOT NULL;
        END IF;
      END $$;
    `);

    // Extend status enum to include DoseSpot statuses
    // First, drop the CHECK constraint if it exists
    await client.query(`
      DO $$ 
      BEGIN
        -- Check if constraint exists and drop it
        IF EXISTS (
          SELECT 1 FROM information_schema.table_constraints 
          WHERE table_name = 'prescriptions' 
          AND constraint_name LIKE '%status%check%'
        ) THEN
          ALTER TABLE prescriptions DROP CONSTRAINT IF EXISTS prescriptions_status_check;
        END IF;
      END $$;
    `);

    // Add new CHECK constraint with extended statuses
    await client.query(`
      DO $$ 
      BEGIN
        -- Only add constraint if it doesn't exist
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints 
          WHERE table_name = 'prescriptions' 
          AND constraint_name = 'prescriptions_status_check'
        ) THEN
          ALTER TABLE prescriptions ADD CONSTRAINT prescriptions_status_check 
          CHECK (status IN (
            'DRAFT', 'SENT', 'ERROR', 'CANCELLED', 'DISCONTINUED', 'CHANGED',
            'RENEWAL_REQUESTED', 'draft', 'pending', 'sent', 'accepted', 'in_process',
            'ready', 'picked_up', 'expired', 'cancelled', 'denied'
          ));
        END IF;
      END $$;
    `);

    // Add index for vendor_message_id lookups
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_prescriptions_vendor_message_id 
      ON prescriptions(vendor_message_id)
      WHERE vendor_message_id IS NOT NULL
    `);

    console.log('✅ Extended prescriptions table');

    // ============================================
    // ENSURE AUDIT_LOGS TABLE STRUCTURE
    // ============================================
    console.log('Ensuring audit_logs table structure...');

    // Check if audit_logs exists, if not create it
    const auditLogsExists = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'audit_logs'
      )
    `);

    if (!auditLogsExists.rows[0].exists) {
      await client.query(`
        CREATE TABLE audit_logs (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          actor_user_id UUID REFERENCES users(id),
          patient_id UUID REFERENCES patients(id),
          action VARCHAR(100) NOT NULL,
          resource_type VARCHAR(50) NOT NULL,
          resource_id UUID,
          details JSONB,
          ip VARCHAR(45),
          user_agent TEXT,
          created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        )
      `);

      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_user_id 
        ON audit_logs(actor_user_id)
      `);

      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_audit_logs_patient_id 
        ON audit_logs(patient_id)
      `);

      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_audit_logs_resource 
        ON audit_logs(resource_type, resource_id)
      `);

      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at 
        ON audit_logs(created_at DESC)
      `);

      console.log('✅ Created audit_logs table');
    } else {
      // Ensure required columns exist
      await client.query(`
        DO $$ 
        BEGIN
          -- Add actor_user_id if missing (migrate from user_id if exists)
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'audit_logs' 
            AND column_name = 'actor_user_id'
          ) THEN
            ALTER TABLE audit_logs ADD COLUMN actor_user_id UUID REFERENCES users(id);
            -- Migrate data from user_id if it exists
            IF EXISTS (
              SELECT 1 FROM information_schema.columns 
              WHERE table_name = 'audit_logs' 
              AND column_name = 'user_id'
            ) THEN
              UPDATE audit_logs 
              SET actor_user_id = user_id 
              WHERE actor_user_id IS NULL;
            END IF;
          END IF;

          -- Add patient_id if missing
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'audit_logs' 
            AND column_name = 'patient_id'
          ) THEN
            ALTER TABLE audit_logs ADD COLUMN patient_id UUID REFERENCES patients(id);
          END IF;

          -- Add resource_type if missing
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'audit_logs' 
            AND column_name = 'resource_type'
          ) THEN
            ALTER TABLE audit_logs ADD COLUMN resource_type VARCHAR(50);
          END IF;

          -- Add resource_id if missing
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'audit_logs' 
            AND column_name = 'resource_id'
          ) THEN
            ALTER TABLE audit_logs ADD COLUMN resource_id UUID;
          END IF;

          -- Add details JSONB if missing
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'audit_logs' 
            AND column_name = 'details'
          ) THEN
            ALTER TABLE audit_logs ADD COLUMN details JSONB;
          END IF;

          -- Add ip if missing (migrate from ip_address if exists)
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'audit_logs' 
            AND column_name = 'ip'
          ) THEN
            ALTER TABLE audit_logs ADD COLUMN ip VARCHAR(45);
            -- Migrate data from ip_address if it exists
            IF EXISTS (
              SELECT 1 FROM information_schema.columns 
              WHERE table_name = 'audit_logs' 
              AND column_name = 'ip_address'
            ) THEN
              UPDATE audit_logs 
              SET ip = ip_address 
              WHERE ip IS NULL;
            END IF;
          END IF;

          -- Add user_agent if missing
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'audit_logs' 
            AND column_name = 'user_agent'
          ) THEN
            ALTER TABLE audit_logs ADD COLUMN user_agent TEXT;
          END IF;
        END $$;
      `);

      console.log('✅ Extended audit_logs table');
    }

    await client.query('COMMIT');
    console.log('✅ DoseSpot ePrescribing integration migration completed successfully');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', error);
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
      console.log('Migration completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration error:', error);
      process.exit(1);
    });
}

module.exports = { migrate };

