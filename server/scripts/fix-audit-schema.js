const pool = require('../db');

async function runMigrationForSchema(client, schema) {
    console.log(`🚀 Fixing audit schema for: ${schema}`);

    // Set search path to target schema
    await client.query(`SET search_path TO ${schema}, public`);

    // 1. Update audit_events
    console.log(`  Checking audit_events in ${schema}...`);
    const auditEventsRes = await client.query(`SELECT 1 FROM information_schema.tables WHERE table_schema = '${schema}' AND table_name = 'audit_events'`);
    if (auditEventsRes.rows.length > 0) {
        await client.query(`
            ALTER TABLE audit_events 
            ADD COLUMN IF NOT EXISTS actor_type VARCHAR(50),
            ADD COLUMN IF NOT EXISTS actor_role VARCHAR(100),
            ADD COLUMN IF NOT EXISTS actor_user_id UUID,
            ADD COLUMN IF NOT EXISTS reason_for_access TEXT,
            ADD COLUMN IF NOT EXISTS previous_hash VARCHAR(64),
            ADD COLUMN IF NOT EXISTS current_hash VARCHAR(64)
        `);
        console.log(`  ✅ audit_events fixed in ${schema}`);
    }

    // 2. Update audit_logs (legacy/alternative table)
    console.log(`  Checking audit_logs in ${schema}...`);
    const auditLogsRes = await client.query(`SELECT 1 FROM information_schema.tables WHERE table_schema = '${schema}' AND table_name = 'audit_logs'`);
    if (auditLogsRes.rows.length > 0) {
        await client.query(`
            ALTER TABLE audit_logs 
            ADD COLUMN IF NOT EXISTS actor_type VARCHAR(50),
            ADD COLUMN IF NOT EXISTS outcome VARCHAR(20) DEFAULT 'success'
        `);
        console.log(`  ✅ audit_logs fixed in ${schema}`);
    }
}

async function migrate() {
    console.log('Starting multi-tenant audit schema fix');
    const client = await pool.connect();

    try {
        // Find all schemas
        const schemasResult = await client.query(`
            SELECT schema_name 
            FROM information_schema.schemata 
            WHERE schema_name LIKE 'tenant_%' OR schema_name = 'sandbox' OR schema_name = 'public'
        `);

        const schemas = schemasResult.rows.map(r => r.schema_name);
        console.log(`Found schemas: ${schemas.join(', ')}`);

        for (const schema of schemas) {
            try {
                await runMigrationForSchema(client, schema);
            } catch (err) {
                console.error(`❌ Failed to migrate schema ${schema}:`, err.message);
            }
        }

        console.log('✨ Audit fix complete!');
    } catch (error) {
        console.error('❌ Migration failed:', error);
    } finally {
        client.release();
    }
}

module.exports = migrate;

if (require.main === module) {
    migrate().then(() => process.exit(0)).catch(() => process.exit(1));
}
