const pool = require('../db');

async function runMigrationForSchema(client, schema) {
    console.log(`🚀 Migrating overbooking cap for schema: ${schema}`);

    // Set search path to target schema
    await client.query(`SET search_path TO ${schema}, public`);

    // 1. Update clinical_settings
    console.log(`  Checking clinical_settings in ${schema}...`);
    const clinicalRes = await client.query(`SELECT 1 FROM information_schema.tables WHERE table_schema = '${schema}' AND table_name = 'clinical_settings'`);
    if (clinicalRes.rows.length > 0) {
        await client.query(`ALTER TABLE clinical_settings ADD COLUMN IF NOT EXISTS max_appointments_per_slot INTEGER DEFAULT NULL`);
        console.log(`  ✅ clinical_settings updated in ${schema}`);
    }

    // 2. Update practice_settings
    console.log(`  Checking practice_settings in ${schema}...`);
    const practiceRes = await client.query(`SELECT 1 FROM information_schema.tables WHERE table_schema = '${schema}' AND table_name = 'practice_settings'`);
    if (practiceRes.rows.length > 0) {
        await client.query(`ALTER TABLE practice_settings ADD COLUMN IF NOT EXISTS max_appointments_per_slot INTEGER DEFAULT NULL`);
        console.log(`  ✅ practice_settings updated in ${schema}`);
    }
}

async function migrate() {
    console.log('Starting multi-tenant migration: Add overbooking cap settings');
    const client = await pool.connect();

    try {
        // 1. Update Control/Practice tables in public schema
        console.log('Migrating control/public DB tables...');
        await client.query('SET search_path TO public');
        await client.query(`ALTER TABLE clinical_settings ADD COLUMN IF NOT EXISTS max_appointments_per_slot INTEGER DEFAULT NULL`);
        await client.query(`ALTER TABLE practice_settings ADD COLUMN IF NOT EXISTS max_appointments_per_slot INTEGER DEFAULT NULL`);
        await client.query(`ALTER TABLE clinic_settings ADD COLUMN IF NOT EXISTS max_appointments_per_slot INTEGER DEFAULT NULL`);
        console.log('✅ Control DB migration successful.');

        // 2. Update all tenant schemas
        const schemasResult = await client.query(`
            SELECT schema_name 
            FROM information_schema.schemata 
            WHERE schema_name LIKE 'tenant_%' OR schema_name = 'sandbox'
        `);

        const schemas = schemasResult.rows.map(r => r.schema_name);
        console.log(`Found tenant schemas: ${schemas.join(', ')}`);

        for (const schema of schemas) {
            try {
                await runMigrationForSchema(client, schema);
            } catch (err) {
                console.error(`❌ Failed to migrate schema ${schema}:`, err.message);
            }
        }

        console.log('✨ Migration suite complete!');
    } catch (error) {
        console.error('❌ Migration failed:', error);
        throw error;
    } finally {
        client.release();
    }
}

module.exports = migrate;
