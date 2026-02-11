/**
 * Migration: Add Trial Tracking Columns
 * 
 * Adds columns to track trial periods for clinics without active subscriptions.
 * 
 * Columns:
 * - trial_expiry_at: Timestamp when trial access expires.
 * - onboarded_at: Timestamp when the clinic was first provisioned.
 */

const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const poolConfig = process.env.DATABASE_URL
    ? {
        connectionString: process.env.DATABASE_URL.replace('@db:', '@localhost:').replace('sslmode=require', 'sslmode=disable'),
        ssl: (process.env.NODE_ENV === 'production' || process.env.DATABASE_URL.includes('sslmode=require')) && !process.env.DATABASE_URL.includes('localhost')
            ? { rejectUnauthorized: false }
            : false,
    }
    : {
        host: process.env.DB_HOST === 'db' ? 'localhost' : (process.env.DB_HOST || 'localhost'),
        port: process.env.DB_PORT || 5432,
        database: process.env.DB_NAME || 'paper_emr',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'postgres',
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    };

const pool = new Pool(poolConfig);

async function migrate() {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        console.log('🚀 Starting Trial Tracking Migration...');

        // 1. Add onboarded_at
        await client.query(`
            DO $$ 
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='clinics' AND column_name='onboarded_at') THEN
                    ALTER TABLE clinics ADD COLUMN onboarded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
                END IF;
            END $$;
        `);
        console.log('✅ Column onboarded_at added');

        // 2. Add trial_expiry_at
        await client.query(`
            DO $$ 
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='clinics' AND column_name='trial_expiry_at') THEN
                    ALTER TABLE clinics ADD COLUMN trial_expiry_at TIMESTAMP;
                END IF;
            END $$;
        `);
        console.log('✅ Column trial_expiry_at added');

        // 3. Retroactive update for existing clinics
        // Any clinic without a trial_expiry_at and no active/trialing subscription gets 7 days from now.
        console.log('🕒 Applying retroactive grace trial for existing clinics...');
        const updateRes = await client.query(`
            UPDATE clinics 
               SET trial_expiry_at = NOW() + INTERVAL '7 days'
             WHERE trial_expiry_at IS NULL 
               AND (stripe_subscription_status IS NULL OR stripe_subscription_status NOT IN ('active', 'trialing'))
               AND slug != 'demo'
        `);
        console.log(`✅ Retroactive grace applied to ${updateRes.rowCount} clinics.`);

        await client.query('COMMIT');
        console.log('\n🎉 Trial tracking migration completed successfully!');

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
    .catch((err) => {
        console.error(err);
        process.exit(1);
    });
