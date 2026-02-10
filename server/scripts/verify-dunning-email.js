require('dotenv').config({ path: '../deploy/.env.prod' }); // Try to load prod env if possible, or adaptable
const path = require('path');
// Adjust for local vs prod paths
const envPath = process.env.NODE_ENV === 'production' ? '../deploy/.env.prod' : '../.env';
require('dotenv').config({ path: path.resolve(__dirname, envPath) });

const pool = require('../db');
const gracePeriodService = require('../services/GracePeriodService');

async function test() {
    try {
        console.log('Testing Dunning Email...');

        // 1. Get a test clinic
        const res = await pool.controlPool.query('SELECT * FROM clinics LIMIT 1');
        const clinic = res.rows[0];

        if (!clinic) {
            console.error('No clinic found');
            return;
        }

        console.log(`Using clinic: ${clinic.display_name} (${clinic.id})`);

        // Check if admin user exists for this clinic
        if (!clinic.schema_name) {
            console.error('No schema name');
            return;
        }

        // 2. Simulate Phase 1 Warning
        console.log('Sending Phase 1 Warning...');
        // We force send specific email
        await gracePeriodService.sendDunningEmail(clinic, 1); // Phase 1 is Warning

        console.log('Email sending logic executed.');

        // 3. Verify Log
        const logRes = await pool.controlPool.query(
            'SELECT * FROM clinic_dunning_logs WHERE clinic_id = $1 ORDER BY created_at DESC LIMIT 1',
            [clinic.id]
        );

        if (logRes.rows.length > 0) {
            console.log('✅ Log found:');
            console.log(JSON.stringify(logRes.rows[0], null, 2));
        } else {
            console.log('❌ No log found.');
        }

    } catch (err) {
        console.error('Test failed:', err);
    } finally {
        await pool.end(); // Close connections
    }
}

test();
