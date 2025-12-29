
const { Pool } = require('pg');
require('dotenv').config();
const tenantSchemaSQL = require('../config/tenantSchema');

// Parse command line arguments
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const targetTenant = args.find(a => a.startsWith('--tenant='))?.split('=')[1];

console.log('='.repeat(60));
console.log('Superbill Schema Migration Script');
console.log('='.repeat(60));
if (dryRun) console.log('🔍 DRY RUN MODE - No changes will be made');
if (targetTenant) console.log(`🎯 Targeting single tenant: ${targetTenant}`);
console.log('');

// Use control pool to find all tenants
const pool = new Pool({
    connectionString: process.env.CONTROL_DATABASE_URL || process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function migrate() {
    const results = { success: [], failed: [], skipped: [] };
    const startTime = Date.now();
    const client = await pool.connect();

    try {
        console.log('🔍 Identifying tenants...');
        const clinicsResult = await client.query('SELECT id, slug, schema_name FROM clinics ORDER BY slug');
        let tenants = clinicsResult.rows;
        console.log(`Found ${tenants.length} total tenants.\n`);

        // Filter to target tenant if specified
        if (targetTenant) {
            tenants = tenants.filter(t => t.slug === targetTenant || t.schema_name === targetTenant);
            if (tenants.length === 0) {
                console.error(`❌ Tenant "${targetTenant}" not found!`);
                return;
            }
        }

        for (const tenant of tenants) {
            const tenantStart = Date.now();

            if (dryRun) {
                console.log(`[DRY-RUN] Would migrate: ${tenant.slug} (${tenant.schema_name})`);
                results.skipped.push(tenant.slug);
                continue;
            }

            console.log(`🚀 Migrating tenant: ${tenant.slug} (${tenant.schema_name})...`);

            try {
                await client.query('BEGIN');

                // Set search path to tenant schema
                await client.query(`SET search_path TO ${tenant.schema_name}, public`);

                // Check if superbill tables already exist
                const existsCheck = await client.query(
                    "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = $1 AND table_name = 'superbills')",
                    [tenant.schema_name]
                );

                if (existsCheck.rows[0].exists) {
                    console.log(`   ⚡ Tables already exist, running idempotent update...`);
                }

                // Run the full template (it uses CREATE TABLE IF NOT EXISTS)
                await client.query(tenantSchemaSQL);

                await client.query('COMMIT');

                const duration = ((Date.now() - tenantStart) / 1000).toFixed(2);
                console.log(`   ✅ ${tenant.slug} migrated successfully (${duration}s)`);
                results.success.push(tenant.slug);

            } catch (err) {
                await client.query('ROLLBACK');
                console.error(`   ❌ Failed: ${err.message}`);
                results.failed.push({ slug: tenant.slug, error: err.message });
            }
        }

        // Summary
        const totalDuration = ((Date.now() - startTime) / 1000).toFixed(2);
        console.log('\n' + '='.repeat(60));
        console.log('Migration Summary');
        console.log('='.repeat(60));
        console.log(`✅ Success: ${results.success.length}`);
        console.log(`❌ Failed:  ${results.failed.length}`);
        console.log(`⏭️  Skipped: ${results.skipped.length}`);
        console.log(`⏱️  Duration: ${totalDuration}s`);

        if (results.failed.length > 0) {
            console.log('\nFailed tenants:');
            results.failed.forEach(f => console.log(`  - ${f.slug}: ${f.error}`));
        }

        console.log('\n🎉 Migration completed.');

    } catch (error) {
        console.error('Fatal migration error:', error);
    } finally {
        client.release();
        await pool.end();
    }
}

// Show help if requested
if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Usage: node apply-superbills-to-all-tenants.js [options]

Options:
  --dry-run         Show what would be done without making changes
  --tenant=<slug>   Target a specific tenant by slug or schema name
  --help, -h        Show this help message

Examples:
  node apply-superbills-to-all-tenants.js --dry-run
  node apply-superbills-to-all-tenants.js --tenant=tenant_miami
  node apply-superbills-to-all-tenants.js
`);
    process.exit(0);
}

migrate();
