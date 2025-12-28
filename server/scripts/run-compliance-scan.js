/**
 * Run Compliance Scan
 * Usage: node scripts/run-compliance-scan.js
 */
const ComplianceScanner = require('../services/complianceScanner');
require('dotenv').config();

async function run() {
    console.log('🛡️  Starting Compliance & Security Scan...');

    try {
        const results = await ComplianceScanner.scan();

        console.log(`\nScan Complete at: ${results.timestamp.toISOString()}`);
        console.log(`Overall Status: ${results.passed ? '✅ PASS' : '❌ FAIL'}\n`);

        results.checks.forEach(check => {
            console.log(`[${check.passed ? 'PASS' : 'FAIL'}] ${check.name}`);
            check.details.forEach(d => console.log(`      - ${d}`));
        });

        if (!results.passed) {
            console.log('\n⚠️  Critical compliance issues detected. Immediate attention required.');
            process.exit(1);
        } else {
            process.exit(0);
        }

    } catch (err) {
        console.error('Scan Failed:', err);
        process.exit(1);
    }
}

run();
