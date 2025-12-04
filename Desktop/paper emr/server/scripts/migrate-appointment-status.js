/**
 * Migration: Add Patient Status Tracking to Appointments
 * 
 * Adds fields for tracking patient flow through the clinic:
 * - patient_status: Current status (arrived, checked_in, in_room, checked_out)
 * - status_history: JSONB array of status changes with timestamps
 * - arrival_time: When patient arrived
 * - current_room: Room number/identifier if in a room
 * - checkout_time: When patient checked out
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

    console.log('Adding patient status tracking fields to appointments table...');

    // Add patient_status column
    await client.query(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name='appointments' AND column_name='patient_status'
        ) THEN
          ALTER TABLE appointments 
          ADD COLUMN patient_status VARCHAR(50) DEFAULT 'scheduled' 
          CHECK (patient_status IN ('scheduled', 'arrived', 'checked_in', 'in_room', 'checked_out'));
        END IF;
      END $$;
    `);

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

    // Create index on patient_status for faster queries
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_appointments_patient_status 
      ON appointments(patient_status);
    `);

    await client.query('COMMIT');
    console.log('✅ Successfully added patient status tracking fields to appointments table');
    
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





