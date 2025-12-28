/**
 * Manual Verification Script for Phase 3
 * Usage: node scripts/manual-verify-phase3.js
 */
const { Pool } = require('pg');
const AuditService = require('../services/auditService');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.CONTROL_DATABASE_URL || process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function verify() {
    const client = await pool.connect();
    try {
        console.log('\n🔍 --- PHASE 3 MANUAL VERIFICATION ---\n');

        // 1. Verify Audit Chain
        console.log('1️⃣  Verifying Audit Trail Integrity...');
        const auditResult = await AuditService.verifyChain();
        if (auditResult.valid) {
            console.log(`   ✅ CHAIN VALID. Verified ${auditResult.count} logs.`);
            if (auditResult.count > 0) {
                const first = await client.query('SELECT hash, created_at FROM platform_audit_logs ORDER BY created_at ASC LIMIT 1');
                const last = await client.query('SELECT hash, created_at FROM platform_audit_logs ORDER BY created_at DESC LIMIT 1');
                console.log(`      Start: ${first.rows[0].created_at.toISOString()}`);
                console.log(`      End:   ${last.rows[0].created_at.toISOString()}`);
                console.log(`      Latest Hash: ${last.rows[0].hash.substring(0, 20)}...`);
            }
        } else {
            console.log('   ❌ CHAIN BROKEN!');
            console.log(auditResult.errors);
        }

        // 2. Verify Role Linkage
        console.log('\n2️⃣  Verifying Source Template Linkage...');
        // Get a real clinic
        const clinicRes = await client.query("SELECT id, slug, schema_name FROM clinics WHERE status = 'active' LIMIT 1");
        if (clinicRes.rows.length === 0) {
            console.log('   ⚠️  No active clinics found to verify.');
        } else {
            const clinic = clinicRes.rows[0];
            console.log(`   Checking clinic: ${clinic.slug} (${clinic.schema_name})`);

            // Check roles
            const rolesRes = await client.query(`
                SELECT r.name, r.source_template_id, t.role_key 
                FROM ${clinic.schema_name}.roles r
                LEFT JOIN platform_role_templates t ON r.source_template_id = t.id
                WHERE r.is_system_role = true
            `);

            let linkedCount = 0;
            console.log('   --- Role Linkage Status ---');
            rolesRes.rows.forEach(r => {
                const status = r.source_template_id ? `✅ Linked -> ${r.role_key}` : '⚠️  Unlinked (Custom/Legacy)';
                console.log(`   - ${r.name.padEnd(20)} : ${status}`);
                if (r.source_template_id) linkedCount++;
            });
            console.log(`   Summary: ${linkedCount}/${rolesRes.rows.length} System Roles are hardened with Source IDs.`);
        }

        console.log('\n✅ Verification Complete.');
    } catch (err) {
        console.error('Verification Failed:', err);
    } finally {
        client.release();
        await pool.end();
    }
}

verify();
