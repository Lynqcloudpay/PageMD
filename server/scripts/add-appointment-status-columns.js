/**
 * Add Patient Status Columns to Appointments Table
 * 
 * This script adds all required columns for patient status tracking:
 * - patient_status
 * - room_sub_status
 * - status_history
 * - arrival_time
 * - current_room
 * - checkout_time
 * - cancellation_reason
 * 
 * Usage: node scripts/add-appointment-status-columns.js
 */

const { Pool } = require('pg');
require('dotenv').config();

// Use DATABASE_URL if available (production/Docker), otherwise use individual env vars
const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_URL.includes('localhost') || process.env.DATABASE_URL.includes('127.0.0.1')
        ? false
        : {
            rejectUnauthorized: false // Allow self-signed certificates
          },
    })
  : new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      database: process.env.DB_NAME || 'paper_emr',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
    });

async function addAppointmentStatusColumns() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    console.log('Adding patient status tracking columns to appointments table...');

    // Add patient_status column
    await client.query(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name='appointments' AND column_name='patient_status'
        ) THEN
          ALTER TABLE appointments 
          ADD COLUMN patient_status VARCHAR(50) DEFAULT 'scheduled';
        END IF;
      END $$;
    `);
    console.log('✅ Added patient_status column');

    // Add constraint for patient_status values
    await client.query(`
      DO $$ 
      BEGIN
        -- Drop existing constraint if it exists
        ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_patient_status_check;
        -- Add new constraint with all valid statuses
        ALTER TABLE appointments 
        ADD CONSTRAINT appointments_patient_status_check 
        CHECK (patient_status IN ('scheduled', 'arrived', 'checked_in', 'in_room', 'checked_out', 'no_show', 'cancelled'));
      EXCEPTION
        WHEN duplicate_object THEN
          -- Constraint already exists, that's fine
          NULL;
      END $$;
    `);
    console.log('✅ Added patient_status constraint');

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

    // Add status_history column (JSONB array)
    await client.query(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name='appointments' AND column_name='status_history'
        ) THEN
          ALTER TABLE appointments 
          ADD COLUMN status_history JSONB DEFAULT '[]'::jsonb;
        END IF;
      END $$;
    `);
    console.log('✅ Added status_history column');

    // Add arrival_time column
    await client.query(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name='appointments' AND column_name='arrival_time'
        ) THEN
          ALTER TABLE appointments 
          ADD COLUMN arrival_time TIMESTAMP;
        END IF;
      END $$;
    `);
    console.log('✅ Added arrival_time column');

    // Add current_room column
    await client.query(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name='appointments' AND column_name='current_room'
        ) THEN
          ALTER TABLE appointments 
          ADD COLUMN current_room VARCHAR(50);
        END IF;
      END $$;
    `);
    console.log('✅ Added current_room column');

    // Add checkout_time column
    await client.query(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name='appointments' AND column_name='checkout_time'
        ) THEN
          ALTER TABLE appointments 
          ADD COLUMN checkout_time TIMESTAMP;
        END IF;
      END $$;
    `);
    console.log('✅ Added checkout_time column');

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

    // Create index on patient_status for faster queries
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_appointments_patient_status 
      ON appointments(patient_status);
    `);
    console.log('✅ Created index on patient_status');

    await client.query('COMMIT');
    console.log('\n✅ Successfully added all patient status tracking columns!');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error adding appointment status columns:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

addAppointmentStatusColumns()
  .then(() => {
    console.log('\n✅ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Failed:', error);
    process.exit(1);
  });




