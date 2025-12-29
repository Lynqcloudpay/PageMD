/**
 * Superbill Schema Validation Script
 * 
 * Validates that superbill tables, constraints, and indexes exist in tenant schemas.
 * Usage: node scripts/validate-superbill-schema.js [--tenant=<slug>]
 */

const { Pool } = require('pg');
require('dotenv').config();

const args = process.argv.slice(2);
const targetTenant = args.find(a => a.startsWith('--tenant='))?.split('=')[1];

const pool = new Pool({
    connectionString: process.env.CONTROL_DATABASE_URL || process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

const REQUIRED_TABLES = [
    'superbills',
    'superbill_diagnoses',
    'superbill_lines',
    'superbill_suggested_lines',
    'superbill_payments_summary',
    'superbill_audit_logs',
    'organizations',
    'locations',
    'payer_policies'
];

const REQUIRED_INDEXES = [
    { table: 'superbills', name: 'idx_superbills_patient' },
    { table: 'superbills', name: 'idx_superbills_visit' },
    { table: 'superbills', name: 'idx_superbills_status' },
    { table: 'superbill_diagnoses', name: 'idx_superbill_diagnoses_superbill' },
    { table: 'superbill_lines', name: 'idx_superbill_lines_superbill' },
];

async function validateSchema(client, schema) {
    const issues = [];

    // Set search path
    await client.query(`SET search_path TO ${schema}, public`);

    // 1. Check required tables exist
    for (const table of REQUIRED_TABLES) {
        const result = await client.query(
            `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = $1 AND table_name = $2)`,
            [schema, table]
        );
        if (!result.rows[0].exists) {
            issues.push({ type: 'MISSING_TABLE', table, severity: 'ERROR' });
        }
    }

    // 2. Check unique constraint on superbills.visit_id
    const uniqueCheck = await client.query(`
        SELECT EXISTS (
            SELECT FROM pg_constraint c
            JOIN pg_class t ON c.conrelid = t.oid
            JOIN pg_namespace n ON t.relnamespace = n.oid
            WHERE n.nspname = $1 
            AND t.relname = 'superbills'
            AND c.contype = 'u'
            AND EXISTS (
                SELECT 1 FROM pg_attribute a
                WHERE a.attrelid = t.oid
                AND a.attnum = ANY(c.conkey)
                AND a.attname = 'visit_id'
            )
        )
    `, [schema]);

    if (!uniqueCheck.rows[0].exists) {
        issues.push({ type: 'MISSING_CONSTRAINT', constraint: 'UNIQUE(visit_id)', table: 'superbills', severity: 'CRITICAL' });
    }

    // 3. Check required indexes
    for (const idx of REQUIRED_INDEXES) {
        const result = await client.query(`
            SELECT EXISTS (
                SELECT FROM pg_indexes 
                WHERE schemaname = $1 AND indexname = $2
            )
        `, [schema, idx.name]);
        if (!result.rows[0].exists) {
            issues.push({ type: 'MISSING_INDEX', index: idx.name, table: idx.table, severity: 'WARNING' });
        }
    }

    // 4. Check FK relationships
    const fkCheck = await client.query(`
        SELECT COUNT(*) FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        JOIN pg_namespace n ON t.relnamespace = n.oid
        WHERE n.nspname = $1 
        AND t.relname = 'superbills'
        AND c.contype = 'f'
    `, [schema]);

    const fkCount = parseInt(fkCheck.rows[0].count);
    if (fkCount < 4) { // Should have FKs to patients, visits, users (2-3x), locations, payer_policies
        issues.push({ type: 'LOW_FK_COUNT', expected: '>= 4', actual: fkCount, table: 'superbills', severity: 'WARNING' });
    }

    return issues;
}

async function main() {
    const client = await pool.connect();
    const results = [];

    try {
        console.log('='.repeat(60));
        console.log('Superbill Schema Validation');
        console.log('='.repeat(60));
        console.log('');

        // Get tenants
        const clinicsResult = await client.query('SELECT id, slug, schema_name FROM clinics ORDER BY slug');
        let tenants = clinicsResult.rows;

        if (targetTenant) {
            tenants = tenants.filter(t => t.slug === targetTenant || t.schema_name === targetTenant);
            if (tenants.length === 0) {
                console.error(`❌ Tenant "${targetTenant}" not found!`);
                return;
            }
        }

        for (const tenant of tenants) {
            console.log(`Validating: ${tenant.slug} (${tenant.schema_name})`);

            try {
                const issues = await validateSchema(client, tenant.schema_name);

                if (issues.length === 0) {
                    console.log(`  ✅ Schema is valid`);
                    results.push({ tenant: tenant.slug, status: 'VALID', issues: [] });
                } else {
                    const criticals = issues.filter(i => i.severity === 'CRITICAL');
                    const errors = issues.filter(i => i.severity === 'ERROR');
                    const warnings = issues.filter(i => i.severity === 'WARNING');

                    console.log(`  ⚠️  Found ${issues.length} issues (${criticals.length} critical, ${errors.length} errors, ${warnings.length} warnings)`);
                    issues.forEach(i => {
                        const icon = i.severity === 'CRITICAL' ? '🔴' : i.severity === 'ERROR' ? '❌' : '⚠️';
                        console.log(`    ${icon} ${i.type}: ${i.table || i.constraint || i.index}`);
                    });

                    results.push({ tenant: tenant.slug, status: criticals.length > 0 ? 'CRITICAL' : errors.length > 0 ? 'ERROR' : 'WARNING', issues });
                }
            } catch (err) {
                console.log(`  ❌ Validation error: ${err.message}`);
                results.push({ tenant: tenant.slug, status: 'ERROR', issues: [{ type: 'VALIDATION_ERROR', message: err.message }] });
            }
        }

        // Summary
        console.log('\n' + '='.repeat(60));
        console.log('Summary');
        console.log('='.repeat(60));

        const valid = results.filter(r => r.status === 'VALID').length;
        const critical = results.filter(r => r.status === 'CRITICAL').length;
        const errors = results.filter(r => r.status === 'ERROR').length;
        const warnings = results.filter(r => r.status === 'WARNING').length;

        console.log(`✅ Valid:    ${valid}`);
        console.log(`🔴 Critical: ${critical}`);
        console.log(`❌ Errors:   ${errors}`);
        console.log(`⚠️  Warnings: ${warnings}`);

        if (critical > 0 || errors > 0) {
            process.exit(1);
        }

    } finally {
        client.release();
        await pool.end();
    }
}

main();
