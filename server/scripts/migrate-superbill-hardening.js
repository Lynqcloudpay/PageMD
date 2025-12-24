
const pool = require('../db');

async function migrate() {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        console.log('🛡️ Starting Superbill Hardening Migration...');

        // 1. Add Source to Diagnoses for Audit Trail
        console.log('Adding source to superbill_diagnoses...');
        await client.query(`
            ALTER TABLE superbill_diagnoses 
            ADD COLUMN IF NOT EXISTS source VARCHAR(50) DEFAULT 'MANUAL';
        `);

        // 2. Add Claim Frequency Code for Revisions
        console.log('Adding claim_frequency_code to superbills...');
        await client.query(`
            ALTER TABLE superbills 
            ADD COLUMN IF NOT EXISTS claim_frequency_code VARCHAR(1) DEFAULT '1'; -- 1=Original, 7=Replacement, 8=Void
        `);

        // 3. Add Revision Tracking
        console.log('Adding revision tracking columns...');
        await client.query(`
            ALTER TABLE superbills 
            ADD COLUMN IF NOT EXISTS previous_version_id UUID REFERENCES superbills(id),
            ADD COLUMN IF NOT EXISTS revision_reason TEXT;
        `);

        await client.query('COMMIT');
        console.log('✅ Superbill hardening migration completed successfully');
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Migration failed:', error);
        process.exit(1);
    } finally {
        client.release();
    }
}

migrate();
