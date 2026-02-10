/**
 * Migration: Create clinic_dunning_logs table
 */

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL?.includes('localhost') || process.env.DATABASE_URL?.includes('127.0.0.1')
        ? false
        : { rejectUnauthorized: false },
});

async function migrate() {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        console.log('🚀 Creating clinic_dunning_logs table...');

        await client.query(`
            CREATE TABLE IF NOT EXISTS clinic_dunning_logs (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
                event_type VARCHAR(100) NOT NULL,
                previous_phase INT,
                current_phase INT,
                details JSONB,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE INDEX IF NOT EXISTS idx_dunning_logs_clinic ON clinic_dunning_logs(clinic_id);
            CREATE INDEX IF NOT EXISTS idx_dunning_logs_created ON clinic_dunning_logs(created_at DESC);
        `);

        await client.query('COMMIT');
        console.log('🎉 clinic_dunning_logs table created successfully!');

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Migration failed:', error);
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

migrate()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
