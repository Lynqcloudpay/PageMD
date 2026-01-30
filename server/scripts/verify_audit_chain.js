const crypto = require('crypto');
const auditService = require('../services/auditService');
const pool = require('../db');

async function main() {
    try {
        console.log('Starting Audit Chain Verification...');

        // Fetch a valid user
        const userRes = await pool.query('SELECT id, role FROM users LIMIT 1');
        if (userRes.rows.length === 0) {
            console.error('No users found in DB to test with.');
            process.exit(1);
        }
        const testUser = userRes.rows[0];
        console.log(`Using test user: ${testUser.id} (${testUser.role})`);

        // 1. Log a few events
        await auditService.logEvent({
            action: 'TEST_EVENT_1',
            entityType: 'Test',
            entityId: crypto.randomUUID(),
            patientId: null,
            details: { test: 1 },
            reason: 'TESTING'
        }, { userId: testUser.id, role: testUser.role, ip: '127.0.0.1' });

        await auditService.logEvent({
            action: 'TEST_EVENT_2',
            entityType: 'Test',
            entityId: crypto.randomUUID(),
            patientId: null,
            details: { test: 2 },
            reason: 'TESTING'
        }, { userId: testUser.id, role: testUser.role, ip: '127.0.0.1' });

        // 2. Verify integrity
        const verification = await auditService.verifyIntegrity(10);
        console.log('Verification Result:', verification);

        if (verification.verified) {
            console.log('UNKNOWN: Hash chain is valid.');
        } else {
            console.error('FAIL: Hash chain is broken at ID:', verification.brokenChainId);
            process.exit(1);
        }

        process.exit(0);
    } catch (e) {
        console.error('Error:', e);
        process.exit(1);
    }
}

main();
