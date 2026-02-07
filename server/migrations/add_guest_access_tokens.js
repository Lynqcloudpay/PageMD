/**
 * Migration: Add guest_access_tokens table for Telehealth Magic Links
 * 
 * This table stores secure, time-limited tokens that allow patients
 * to access their telehealth appointment without portal login.
 */
const pool = require('../db');

async function up() {
    console.log('Creating guest_access_tokens table...');

    await pool.query(`
        CREATE TABLE IF NOT EXISTS guest_access_tokens (
            id SERIAL PRIMARY KEY,
            appointment_id UUID NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
            patient_id UUID NOT NULL REFERENCES patients(id),
            token_hash VARCHAR(64) NOT NULL UNIQUE,
            expires_at TIMESTAMPTZ NOT NULL,
            dob_attempts INTEGER DEFAULT 0,
            used_at TIMESTAMPTZ,
            invalidated_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
            created_by UUID REFERENCES users(id)
        )
    `);

    await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_guest_tokens_appointment 
        ON guest_access_tokens(appointment_id)
    `);

    await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_guest_tokens_hash 
        ON guest_access_tokens(token_hash)
    `);

    console.log('✅ guest_access_tokens table created successfully');
}

async function down() {
    console.log('Dropping guest_access_tokens table...');
    await pool.query('DROP TABLE IF EXISTS guest_access_tokens CASCADE');
    console.log('✅ guest_access_tokens table dropped');
}

// Run migration if executed directly
if (require.main === module) {
    const action = process.argv[2] || 'up';

    (async () => {
        try {
            if (action === 'down') {
                await down();
            } else {
                await up();
            }
            process.exit(0);
        } catch (error) {
            console.error('Migration failed:', error);
            process.exit(1);
        }
    })();
}

module.exports = { up, down };
