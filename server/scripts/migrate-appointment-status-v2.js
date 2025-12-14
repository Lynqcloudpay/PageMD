/**
 * Migration: Add Missing Appointment Status Fields
 * 
 * Adds:
 * - room_sub_status: Sub-status when in room (with_nurse, ready_for_provider)
 * - cancellation_reason: Reason for cancellation
 * - Updates patient_status constraint to include 'no_show' and 'cancelled'
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

    console.log('Adding missing appointment status fields...');

    // Add room_sub_status column
    await client.query(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name='appointments' AND column_name='room_sub_status'
        ) THEN
          ALTER TABLE appointments 
          ADD COLUMN room_sub_status VARCHAR(50);
        END IF;
      END $$;
    `);
    console.log('✅ Added room_sub_status column');

    // Add cancellation_reason column
    await client.query(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name='appointments' AND column_name='cancellation_reason'
        ) THEN
          ALTER TABLE appointments 
          ADD COLUMN cancellation_reason TEXT;
        END IF;
      END $$;
    `);
    console.log('✅ Added cancellation_reason column');

    // Update patient_status constraint to include 'no_show' and 'cancelled'
    // First, drop the existing constraint if it exists
    await client.query(`
      DO $$ 
      BEGIN
        -- Try to drop the old constraint
        ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_patient_status_check;
      EXCEPTION
        WHEN undefined_object THEN
          -- Constraint doesn't exist, that's fine
          NULL;
      END $$;
    `);

    // Add the new constraint with all valid statuses
    await client.query(`
      DO $$ 
      BEGIN
        -- Add the new constraint
        ALTER TABLE appointments 
        ADD CONSTRAINT appointments_patient_status_check 
        CHECK (patient_status IN ('scheduled', 'arrived', 'checked_in', 'in_room', 'checked_out', 'no_show', 'cancelled'));
      EXCEPTION
        WHEN duplicate_object THEN
          -- Constraint already exists, that's fine
          NULL;
      END $$;
    `);
    console.log('✅ Updated patient_status constraint to include no_show and cancelled');

    await client.query('COMMIT');
    console.log('\n✅ Successfully added missing appointment status fields');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error migrating appointment status fields:', error);
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
      console.log('Migration completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}

module.exports = { migrate };





