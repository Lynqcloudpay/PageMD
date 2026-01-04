const { Pool } = require('pg');
require('dotenv').config();

const poolConfig = process.env.DATABASE_URL
  ? { connectionString: process.env.DATABASE_URL }
  : {
    host: process.env.DB_HOST || (process.env.NODE_ENV === 'production' ? 'db' : 'localhost'),
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || (process.env.NODE_ENV === 'production' ? 'emr_db' : 'paper_emr'),
    user: process.env.DB_USER || (process.env.NODE_ENV === 'production' ? 'emr_user' : 'postgres'),
    password: process.env.DB_PASSWORD || 'postgres',
  };

if (process.env.NODE_ENV === 'production' || process.env.DATABASE_URL) {
  poolConfig.ssl = { rejectUnauthorized: false };
}

const pool = new Pool(poolConfig);

async function migrate() {
  const client = await pool.connect();

  try {
    console.log('--- Patient Search Smart Filter Migration (Multi-Tenant) ---');

    // 1. Enable pg_trgm extension globally
    console.log('Enabling pg_trgm extension...');
    await client.query('CREATE EXTENSION IF NOT EXISTS pg_trgm SCHEMA public');

    // 2. Get all schemas
    const clinicsRes = await client.query('SELECT display_name, schema_name FROM public.clinics WHERE schema_name IS NOT NULL');
    const schemas = ['public', ...clinicsRes.rows.map(r => r.schema_name)];

    for (const schema of schemas) {
      console.log(`\nMigrating schema: ${schema}`);
      await client.query(`SET search_path TO ${schema}, public`);

      // Check if patients table exists in this schema
      const tableCheck = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = $1 AND table_name = 'patients'
        )`, [schema]);

      if (!tableCheck.rows[0].exists) {
        console.log(`Skipping ${schema} - patients table not found.`);
        continue;
      }

      await client.query('BEGIN');

      // Add phone_normalized column 
      await client.query(`
        DO $$ 
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema=current_schema() AND table_name='patients' AND column_name='phone_normalized') THEN
            ALTER TABLE patients ADD COLUMN phone_normalized TEXT;
          END IF;
        END $$;
      `);

      // Create Indexes
      await client.query('CREATE INDEX IF NOT EXISTS idx_patients_clinic_mrn ON patients(clinic_id, mrn)');
      await client.query('CREATE INDEX IF NOT EXISTS idx_patients_clinic_dob ON patients(clinic_id, dob)');
      await client.query('CREATE INDEX IF NOT EXISTS idx_patients_clinic_phone_norm ON patients(clinic_id, phone_normalized)');
      await client.query('CREATE INDEX IF NOT EXISTS idx_patients_clinic_last_name ON patients(clinic_id, last_name)');
      await client.query('CREATE INDEX IF NOT EXISTS idx_patients_clinic_first_name ON patients(clinic_id, first_name)');

      // Trigram index for fuzzy name search
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_patients_name_trgm ON patients 
        USING gin ((first_name || ' ' || last_name) gin_trgm_ops)
      `);

      await client.query('COMMIT');
      console.log(`✅ Schema ${schema} migrated.`);
    }

    console.log('\n✅ All schemas migrated successfully');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    try { await client.query('SET search_path TO public'); } catch (e) { }
    client.release();
    await pool.end();
  }
}

migrate();
