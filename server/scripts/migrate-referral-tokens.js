
const pool = require('../db');

async function migrate() {
    const client = await pool.controlPool.connect();
    try {
        console.log('Starting migration: Add referral tokens');

        // Check if columns exist
        const res = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'clinic_referrals' 
      AND column_name IN ('token', 'token_expires_at', 'invite_sent_at')
    `);

        const existingColumns = res.rows.map(r => r.column_name);

        if (!existingColumns.includes('token')) {
            console.log('Adding token column...');
            await client.query('ALTER TABLE public.clinic_referrals ADD COLUMN token text');
        }

        if (!existingColumns.includes('token_expires_at')) {
            console.log('Adding token_expires_at column...');
            await client.query('ALTER TABLE public.clinic_referrals ADD COLUMN token_expires_at timestamp with time zone');
        }

        if (!existingColumns.includes('invite_sent_at')) {
            console.log('Adding invite_sent_at column...');
            await client.query('ALTER TABLE public.clinic_referrals ADD COLUMN invite_sent_at timestamp with time zone');
        }

        console.log('Migration complete!');
    } catch (err) {
        console.error('Migration failed:', err);
    } finally {
        client.release();
        process.exit();
    }
}

migrate();
