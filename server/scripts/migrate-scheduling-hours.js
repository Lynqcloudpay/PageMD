const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function run() {
  try {
    console.log('🚀 Running scheduling hours migration across all tenants...');

    // 1. Get all tenant schemas
    const schemasResult = await pool.query(`
      SELECT DISTINCT schema_name 
      FROM information_schema.schemata 
      WHERE schema_name LIKE 'tenant_%'
    `);

    const tenantSchemas = schemasResult.rows.map(r => r.schema_name);
    console.log(`Found ${tenantSchemas.length} tenant schemas:`, tenantSchemas);

    // 2. Apply migration to each tenant schema
    for (const schema of tenantSchemas) {
      console.log(`  Migrating ${schema}...`);

      // Check if practice_settings exists in this schema
      const tableCheck = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = $1 AND table_name = 'practice_settings'
        )
      `, [schema]);

      if (tableCheck.rows[0].exists) {
        await pool.query(`
          ALTER TABLE ${schema}.practice_settings 
          ADD COLUMN IF NOT EXISTS scheduling_start_time TIME DEFAULT '07:00'
        `);
        await pool.query(`
          ALTER TABLE ${schema}.practice_settings 
          ADD COLUMN IF NOT EXISTS scheduling_end_time TIME DEFAULT '19:00'
        `);
        console.log(`    ✅ practice_settings updated in ${schema}`);
      }

      // Check if clinical_settings exists
      const clinicalCheck = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = $1 AND table_name = 'clinical_settings'
        )
      `, [schema]);

      if (clinicalCheck.rows[0].exists) {
        await pool.query(`
          ALTER TABLE ${schema}.clinical_settings 
          ADD COLUMN IF NOT EXISTS scheduling_start_time TIME DEFAULT '07:00'
        `);
        await pool.query(`
          ALTER TABLE ${schema}.clinical_settings 
          ADD COLUMN IF NOT EXISTS scheduling_end_time TIME DEFAULT '19:00'
        `);
        console.log(`    ✅ clinical_settings updated in ${schema}`);
      }
    }

    // 3. Update public schema tables
    console.log('  Migrating public schema...');

    const publicClinicsCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'clinics'
      )
    `);

    if (publicClinicsCheck.rows[0].exists) {
      await pool.query(`
        ALTER TABLE public.clinics 
        ADD COLUMN IF NOT EXISTS scheduling_start_time TIME DEFAULT '07:00'
      `);
      await pool.query(`
        ALTER TABLE public.clinics 
        ADD COLUMN IF NOT EXISTS scheduling_end_time TIME DEFAULT '19:00'
      `);
      console.log('    ✅ public.clinics updated');
    }

    const publicClinicSettingsCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'clinic_settings'
      )
    `);

    if (publicClinicSettingsCheck.rows[0].exists) {
      await pool.query(`
        ALTER TABLE public.clinic_settings 
        ADD COLUMN IF NOT EXISTS scheduling_start_time TIME DEFAULT '07:00'
      `);
      await pool.query(`
        ALTER TABLE public.clinic_settings 
        ADD COLUMN IF NOT EXISTS scheduling_end_time TIME DEFAULT '19:00'
      `);
      console.log('    ✅ public.clinic_settings updated');
    }

    console.log('✅ Migration completed successfully!');
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

run();
