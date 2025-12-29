
const { Pool } = require('pg');
require('dotenv').config();
const tenantSchemaSQL = require('../config/tenantSchema');

// Use control pool to find all tenants
const pool = new Pool({
    connectionString: process.env.CONTROL_DATABASE_URL || process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function migrate() {
    const client = await pool.connect();
    try {
        console.log('🔍 Identifying tenants...');
        const clinicsResult = await client.query('SELECT id, slug, schema_name FROM clinics');
        const tenants = clinicsResult.rows;
        console.log(`Found ${tenants.length} tenants.`);

        for (const tenant of tenants) {
            console.log(`🚀 Migrating tenant: ${tenant.slug} (${tenant.schema_name})...`);
            try {
                await client.query('BEGIN');

                // Set search path to tenant schema
                await client.query(`SET search_path TO ${tenant.schema_name}, public`);

                // Run the full template (it uses CREATE TABLE IF NOT EXISTS)
                // Note: We only want the superbill part now if we want to be fast, 
                // but the template is designed to be idempotent.
                await client.query(tenantSchemaSQL);

                // Also ensure the ENUM is created outside IF NOT EXISTS if needed, 
                // but our template handles it with a DO block for the ENUM.

                await client.query('COMMIT');
                console.log(`✅ Tenant ${tenant.slug} migrated successfully.`);
            } catch (err) {
                await client.query('ROLLBACK');
                console.error(`❌ Failed to migrate tenant ${tenant.slug}:`, err.message);
            }
        }
        console.log('🎉 All migrations completed.');
    } catch (error) {
        console.error('Fatal migration error:', error);
    } finally {
        client.release();
        await pool.end();
    }
}

migrate();
