
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

        // Check sales_inquiries table for referral_token
        const salesRes = await client.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'sales_inquiries' 
            AND column_name = 'referral_token'
        `);

        if (salesRes.rows.length === 0) {
            console.log('Adding referral_token column to sales_inquiries...');
            await client.query('ALTER TABLE sales_inquiries ADD COLUMN referral_token text');
        }

        console.log('Migration complete!');
    } catch (err) {
        console.error('Migration failed:', err);
    } finally {
        client.release();
        if (require.main === module) {
            process.exit();
        }
    }
}

if (require.main === module) {
    migrate();
}

module.exports = migrate;
