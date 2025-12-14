/**
 * Migration: Add Missing Appointment Status Fields
 * 
 * Adds:
 * - room_sub_status: Sub-status when in room (with_nurse, ready_for_provider)
 * - cancellation_reason: Reason for cancellation
 * - Updates patient_status constraint to include 'no_show' and 'cancelled'
 */

console.log('=== MIGRATE-APPOINTMENT-STATUS-V2 SCRIPT STARTING ===');
console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'SET' : 'NOT SET');

const { Pool } = require('pg');

// In Docker, environment variables are already set via docker-compose
// Only load .env file if DATABASE_URL is not already set (local development)
if (!process.env.DATABASE_URL) {
  console.log('Loading .env file (DATABASE_URL not set)...');
  require('dotenv').config({ override: false });
} else {
  console.log('Skipping .env load (DATABASE_URL already set)');
  if (process.env.DATABASE_URL) {
    const masked = process.env.DATABASE_URL.replace(/:[^:@]+@/, ':****@');
    console.log('DATABASE_URL value:', masked);
  }
}

// Use DATABASE_URL if available (preferred for Docker), otherwise use individual connection params
const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_URL.includes('localhost') || process.env.DATABASE_URL.includes('127.0.0.1')
        ? false
        : { rejectUnauthorized: false },
    })
  : new Pool({
      host: process.env.DB_HOST || 'db',
      port: process.env.DB_PORT || 5432,
      database: process.env.DB_NAME || 'paper_emr',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
    });

console.log('Pool created, using:', process.env.DATABASE_URL ? 'DATABASE_URL' : 'individual params');

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





















