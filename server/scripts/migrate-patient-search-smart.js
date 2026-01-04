const { Pool } = require('pg');
require('dotenv').config();

// PostgreSQL configuration using production environment variables
const pool = new Pool({
  host: process.env.DB_HOST || (process.env.NODE_ENV === 'production' ? 'db' : 'localhost'),
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || (process.env.NODE_ENV === 'production' ? 'emr_db' : 'paper_emr'),
  user: process.env.DB_USER || (process.env.NODE_ENV === 'production' ? 'emr_user' : 'postgres'),
  password: process.env.DB_PASSWORD || 'postgres',
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
});

async function migrate() {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    console.log('--- Patient Search Smart Filter Migration ---');

    // 1. Enable pg_trgm extension
    console.log('Enabling pg_trgm extension...');
    await client.query('CREATE EXTENSION IF NOT EXISTS pg_trgm');

    // 2. Add phone_normalized column if it doesn't exist
    console.log('Checking for phone_normalized column...');
    await client.query(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='patients' AND column_name='phone_normalized') THEN
          ALTER TABLE patients ADD COLUMN phone_normalized TEXT;
        END IF;
      END $$;
    `);

    // 3. Populate phone_normalized for existing records
    console.log('Populating phone_normalized for existing patients...');
    await client.query(`
      UPDATE patients 
      SET phone_normalized = REGEXP_REPLACE(
        COALESCE(phone, '') || COALESCE(phone_cell, '') || COALESCE(phone_secondary, ''), 
        '\\D', '', 'g'
      )
      WHERE phone_normalized IS NULL OR phone_normalized = '';
    `);

    // 4. Create Indexes
    console.log('Creating optimized search indexes...');
    await client.query('CREATE INDEX IF NOT EXISTS idx_patients_clinic_mrn ON patients(clinic_id, mrn)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_patients_clinic_dob ON patients(clinic_id, dob)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_patients_clinic_phone_norm ON patients(clinic_id, phone_normalized)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_patients_clinic_last_name ON patients(clinic_id, last_name)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_patients_clinic_first_name ON patients(clinic_id, first_name)');

    // Trigram index for fuzzy name search
    console.log('Creating trigram index for name search...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_patients_name_trgm ON patients 
      USING gin ((first_name || ' ' || last_name) gin_trgm_ops)
    `);

    await client.query('COMMIT');
    console.log('✅ Patient Search migration completed successfully');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch(err => {
  console.error(err);
  process.exit(1);
});
