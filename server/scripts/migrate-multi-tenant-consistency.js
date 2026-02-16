/**
 * Multi-tenant Consistency Migration
 * 
 * Ensures common columns like 'clinic_id' are present in all major tables
 * across all tenant and sandbox schemas for query consistency.
 */

const pool = require('../db');

const TABLES_NEEDING_CLINIC_ID = [
    'appointments',
    'patients',
    'visits',
    'documents',
    'orders',
    'inbox_items',
    'messages',
    'portal_appointment_requests',
    'problems',
    'medications',
    'allergies'
];

async function runMigrationForSchema(client, schema) {
    console.log(`🚀 Ensuring column consistency for schema: ${schema}`);

    // Set search path
    await client.query(`SET search_path TO ${schema}, public`);

    for (const table of TABLES_NEEDING_CLINIC_ID) {
        // Check if table exists in this schema
        const res = await client.query(`
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = '${schema}' AND table_name = '${table}'
        `);

        if (res.rows.length > 0) {
            try {
                await client.query(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS clinic_id UUID`);
                console.log(`  ✅ Ensured clinic_id in ${schema}.${table}`);
            } catch (err) {
                console.error(`  ⚠️ Could not add clinic_id to ${schema}.${table}: ${err.message}`);
            }
        }
    }
}

async function migrate() {
    console.log('Starting multi-tenant consistency migration...');
    const client = await pool.connect();

    try {
        const schemasResult = await client.query(`
            SELECT schema_name 
            FROM information_schema.schemata 
            WHERE schema_name LIKE 'tenant_%' OR schema_name LIKE 'sandbox_%' OR schema_name = 'sandbox'
        `);

        const schemas = schemasResult.rows.map(r => r.schema_name);
        console.log(`Found schemas: ${schemas.join(', ')}`);

        // Run for public first
        await runMigrationForSchema(client, 'public');

        for (const schema of schemas) {
            try {
                await runMigrationForSchema(client, schema);
            } catch (err) {
                console.error(`❌ Failed to migrate schema ${schema}:`, err.message);
            }
        }

        console.log('✨ Consistency migration complete!');
    } catch (error) {
        console.error('❌ Migration failed:', error);
        throw error;
    } finally {
        client.release();
    }
}

if (require.main === module) {
    migrate()
        .then(() => process.exit(0))
        .catch(() => process.exit(1));
}

module.exports = migrate;
