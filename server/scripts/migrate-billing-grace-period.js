/**
 * Migration: Add Billing Grace Period Columns
 * 
 * Adds columns to track 45-day grace period phases and manual override state.
 * 
 * Columns:
 * - billing_grace_phase: 0=Active, 1=Warning, 2=Read-Only, 3=Locked, 4=Terminated
 * - billing_grace_start_at: Timestamp when grace period began
 * - billing_manual_override: Kill switch for automated dunning logic
 */

const { Pool } = require('pg');
require('dotenv').config();

const pool = process.env.DATABASE_URL
    ? new Pool({
        connectionString: process.env.DATABASE_URL.replace('db:5432', 'localhost:5432'), // Local dev fix
        ssl: process.env.DATABASE_URL.includes('localhost') || process.env.DATABASE_URL.includes('127.0.0.1')
            ? false
            : { rejectUnauthorized: false },
    })
    : new Pool({
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        database: process.env.DB_NAME || 'emr_db',
        user: process.env.DB_USER || 'emr_user',
        password: process.env.DB_PASSWORD || 'password',
    });

async function migrate() {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        console.log('🚀 Starting Billing Grace Period Migration...');

        // 1. Add billing_grace_phase
        await client.query(`
            DO $$ 
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='clinics' AND column_name='billing_grace_phase') THEN
                    ALTER TABLE clinics ADD COLUMN billing_grace_phase INT DEFAULT 0;
                END IF;
            END $$;
        `);
        console.log('✅ Column billing_grace_phase added');

        // 2. Add billing_grace_start_at
        await client.query(`
            DO $$ 
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='clinics' AND column_name='billing_grace_start_at') THEN
                    ALTER TABLE clinics ADD COLUMN billing_grace_start_at TIMESTAMP;
                END IF;
            END $$;
        `);
        console.log('✅ Column billing_grace_start_at added');

        // 3. Add billing_manual_override
        await client.query(`
            DO $$ 
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='clinics' AND column_name='billing_manual_override') THEN
                    ALTER TABLE clinics ADD COLUMN billing_manual_override BOOLEAN DEFAULT false;
                END IF;
            END $$;
        `);
        console.log('✅ Column billing_manual_override added');

        await client.query('COMMIT');
        console.log('\n🎉 Migration completed successfully!');

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
