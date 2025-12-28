/**
 * Run Schema Drift Check
 * Usage: node scripts/check-schema-drift.js
 */
const SchemaValidator = require('../services/schemaValidator');
require('dotenv').config();

async function run() {
    console.log('🔍 Starting Multi-Tenant Schema Drift Check...');
    try {
        const results = await SchemaValidator.checkDrift();
        console.log(`\nTimestamp: ${results.timestamp.toISOString()}`);

        if (results.drifts.length === 0) {
            console.log('✅ All tenants match the baseline schema.');
        } else {
            console.log(`⚠️  Drift Detected in ${results.drifts.length} tenants:\n`);
            results.drifts.forEach(d => {
                console.log(`Tenant: ${d.tenant}`);
                d.issues.forEach(i => console.log(`   - ${i}`));
                console.log('');
            });
            process.exit(1);
        }
    } catch (err) {
        console.error('Check Failed:', err);
        process.exit(1);
    }
}

run();
