/**
 * Migration: Create Cancellation Follow-ups Table
 * 
 * Tracks follow-up attempts for cancelled and no-show appointments
 */

const { Pool } = require('pg');

// In Docker, environment variables are already set via docker-compose
// Only load .env file if DATABASE_URL is not already set (local development)
if (!process.env.DATABASE_URL) {
  require('dotenv').config({ override: false });
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

async function migrate() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    console.log('Creating cancellation_followups table...');

    // Create the follow-ups table
    await client.query(`
      CREATE TABLE IF NOT EXISTS cancellation_followups (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        appointment_id UUID NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
        patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'addressed', 'dismissed')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        addressed_at TIMESTAMP,
        addressed_by UUID REFERENCES users(id),
        dismissed_at TIMESTAMP,
        dismissed_by UUID REFERENCES users(id),
        dismiss_reason TEXT
      )
    `);
    console.log('✅ Created cancellation_followups table');

    // Create the follow-up notes table for tracking all interactions
    await client.query(`
      CREATE TABLE IF NOT EXISTS cancellation_followup_notes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        followup_id UUID NOT NULL REFERENCES cancellation_followups(id) ON DELETE CASCADE,
        note TEXT NOT NULL,
        note_type VARCHAR(30) DEFAULT 'general' CHECK (note_type IN ('general', 'call_attempt', 'rescheduled', 'dismissed', 'message_sent')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_by UUID NOT NULL REFERENCES users(id),
        created_by_name VARCHAR(255)
      )
    `);
    console.log('✅ Created cancellation_followup_notes table');

    // Create indexes for faster queries
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_followups_appointment_id ON cancellation_followups(appointment_id);
      CREATE INDEX IF NOT EXISTS idx_followups_patient_id ON cancellation_followups(patient_id);
      CREATE INDEX IF NOT EXISTS idx_followups_status ON cancellation_followups(status);
      CREATE INDEX IF NOT EXISTS idx_followup_notes_followup_id ON cancellation_followup_notes(followup_id);
    `);
    console.log('✅ Created indexes');

    await client.query('COMMIT');
    console.log('\n✅ Migration completed successfully');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error during migration:', error);
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
      console.error('Migration failed:', error);
      process.exit(1);
    });
}

module.exports = { migrate };





















