const { Pool } = require('pg');
require('dotenv').config();

// Support both DATABASE_URL and individual connection parameters
let pool;
if (process.env.DATABASE_URL) {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });
} else {
  pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'paper_emr',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
  });
}

async function migrate() {
  const client = await pool.connect();
  
  try {
    console.log('🔄 Migrating visits table to status-based system...');
    
    await client.query('BEGIN');

    // Create ENUM types
    await client.query(`
      DO $$ BEGIN
        CREATE TYPE visit_status AS ENUM ('draft', 'signed', 'amended', 'void');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await client.query(`
      DO $$ BEGIN
        CREATE TYPE visit_note_type AS ENUM ('office_visit', 'telephone', 'portal', 'refill', 'lab_only', 'nurse_visit');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // Add new columns
    await client.query(`
      ALTER TABLE visits
      ADD COLUMN IF NOT EXISTS status visit_status DEFAULT 'draft',
      ADD COLUMN IF NOT EXISTS note_type visit_note_type DEFAULT 'office_visit',
      ADD COLUMN IF NOT EXISTS encounter_date DATE
    `);

    // Migrate existing data: set status based on note_signed_at
    await client.query(`
      UPDATE visits
      SET status = CASE
        WHEN note_signed_at IS NOT NULL THEN 'signed'::visit_status
        WHEN note_draft IS NOT NULL AND note_draft != '' THEN 'draft'::visit_status
        ELSE 'draft'::visit_status
      END
      WHERE status IS NULL
    `);

    // Set encounter_date from visit_date (extract date part)
    await client.query(`
      UPDATE visits
      SET encounter_date = DATE(visit_date)
      WHERE encounter_date IS NULL
    `);

    // Set note_type from visit_type if it exists
    await client.query(`
      UPDATE visits
      SET note_type = CASE
        WHEN visit_type ILIKE '%telephone%' OR visit_type ILIKE '%phone%' THEN 'telephone'::visit_note_type
        WHEN visit_type ILIKE '%portal%' THEN 'portal'::visit_note_type
        WHEN visit_type ILIKE '%refill%' THEN 'refill'::visit_note_type
        WHEN visit_type ILIKE '%lab%' THEN 'lab_only'::visit_note_type
        WHEN visit_type ILIKE '%nurse%' THEN 'nurse_visit'::visit_note_type
        ELSE 'office_visit'::visit_note_type
      END
      WHERE note_type IS NULL
    `);

    // Make status and note_type NOT NULL after migration
    await client.query(`
      ALTER TABLE visits
      ALTER COLUMN status SET NOT NULL,
      ALTER COLUMN note_type SET NOT NULL,
      ALTER COLUMN encounter_date SET NOT NULL
    `);

    // Clean up duplicate drafts before creating unique index
    console.log('Cleaning up duplicate draft visits...');
    await client.query(`
      DELETE FROM visits
      WHERE id IN (
        SELECT id FROM (
          SELECT id,
            ROW_NUMBER() OVER (
              PARTITION BY patient_id, provider_id, encounter_date, note_type 
              ORDER BY updated_at DESC
            ) as rn
          FROM visits
          WHERE status = 'draft'
        ) t
        WHERE t.rn > 1
      )
    `);
    console.log('✅ Duplicate drafts cleaned up');

    // Create indexes for performance
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_visits_patient_encounter_status 
      ON visits(patient_id, encounter_date, status)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_visits_patient_provider_encounter_status 
      ON visits(patient_id, provider_id, encounter_date, status)
    `);

    // Create unique partial index to prevent duplicate today drafts
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_visits_unique_today_draft
      ON visits(patient_id, provider_id, encounter_date, note_type)
      WHERE status = 'draft'
    `);

    // Create index on encounter_date for date queries
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_visits_encounter_date 
      ON visits(encounter_date DESC)
    `);

    await client.query('COMMIT');
    console.log('✅ Successfully migrated visits table to status-based system');
    console.log('✅ Created indexes for performance');
    console.log('✅ Added unique constraint to prevent duplicate today drafts');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

if (require.main === module) {
  migrate()
    .then(() => {
      console.log('Migration completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}

module.exports = { migrate };

