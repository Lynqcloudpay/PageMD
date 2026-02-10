require('dotenv').config({ path: '../deploy/.env.prod' });
const path = require('path');
const envPath = process.env.NODE_ENV === 'production' ? '../deploy/.env.prod' : '../.env';
require('dotenv').config({ path: path.resolve(__dirname, envPath) });

const pool = require('../db');
const gracePeriodService = require('../services/GracePeriodService');

async function testPhases() {
    try {
        console.log('Testing Dunning Phases 2 (Read-Only) and 3 (Lockout)...');

        // 1. Get a test clinic
        const res = await pool.controlPool.query('SELECT * FROM clinics LIMIT 1');
        const clinic = res.rows[0];

        if (!clinic) {
            console.error('No clinic found');
            return;
        }

        console.log(`Using clinic: ${clinic.display_name} (${clinic.id})`);

        // 2. Simulate Phase 2 (Read-Only)
        console.log('\n--- Escalating to Phase 2 (Read-Only) ---');
        await gracePeriodService.escalateToPhase(clinic, 2, 1);
        console.log('✅ Phase 2 escalation complete.');

        // 3. Simulate Phase 3 (Lockout)
        console.log('\n--- Escalating to Phase 3 (Lockout) ---');
        await gracePeriodService.escalateToPhase(clinic, 3, 2);
        console.log('✅ Phase 3 escalation complete.');

        // 4. Verify DB Status
        console.log('\n--- Verifying Database Enforcement ---');
        const dbRes = await pool.controlPool.query(
            'SELECT status, is_read_only, billing_locked, billing_grace_phase FROM clinics WHERE id = $1',
            [clinic.id]
        );
        const updatedClinic = dbRes.rows[0];
        console.log('Current DB State:', JSON.stringify(updatedClinic, null, 2));

        if (updatedClinic.billing_grace_phase === 3 && updatedClinic.status === 'suspended') {
            console.log('✅ Phase 3 Enforcement: Account Suspended.');
        } else if (updatedClinic.billing_grace_phase === 2 && updatedClinic.is_read_only) {
            console.log('✅ Phase 2 Enforcement: Account Read-Only.');
        }

        // 5. Verify Logs
        console.log('\n--- Verifying Logs ---');
        const logRes = await pool.controlPool.query(
            `SELECT event_type, created_at, details 
             FROM clinic_dunning_logs 
             WHERE clinic_id = $1 
             ORDER BY created_at DESC LIMIT 2`,
            [clinic.id]
        );

        if (logRes.rows.length > 0) {
            logRes.rows.forEach((log, i) => {
                console.log(`Log ${i + 1}: ${log.event_type} - ${JSON.stringify(log.details).substring(0, 100)}...`);
            });
        } else {
            console.log('❌ No logs found.');
        }

    } catch (err) {
        console.error('Test failed:', err);
    } finally {
        await pool.end();
    }
}

testPhases();
