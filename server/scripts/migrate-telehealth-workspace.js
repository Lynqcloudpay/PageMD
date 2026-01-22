const pool = require('../db');

async function migrate() {
    // 1. Get all active schemas
    const schemasRes = await pool.controlPool.query(
        "SELECT schema_name FROM clinics WHERE status = 'active'"
    );
    const schemas = schemasRes.rows.map(r => r.schema_name);
    console.log(`Found ${schemas.length} active schemas to migrate:`, schemas);

    for (const schema of schemas) {
        console.log(`\n--- Migrating Schema: ${schema} ---`);
        const client = await pool.controlPool.connect();
        try {
            await client.query('BEGIN');
            await client.query(`SET search_path TO ${schema}, public`);

            console.log(`[${schema}] Hardening visits table (appointment_id, structured_note, dx)...`);
            await client.query(`
                ALTER TABLE visits 
                ADD COLUMN IF NOT EXISTS appointment_id UUID,
                ADD COLUMN IF NOT EXISTS structured_note JSONB,
                ADD COLUMN IF NOT EXISTS dx TEXT[];
            `);

            // Add index for performance
            await client.query(`
                CREATE INDEX IF NOT EXISTS idx_visits_appointment_id ON visits(appointment_id);
            `);

            console.log(`[${schema}] Creating after_visit_summaries table...`);
            await client.query(`
                CREATE TABLE IF NOT EXISTS after_visit_summaries (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    encounter_id UUID NOT NULL REFERENCES visits(id) ON DELETE CASCADE UNIQUE,
                    instructions TEXT,
                    follow_up TEXT,
                    return_precautions TEXT,
                    sent_at TIMESTAMP,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            `);

            await client.query('COMMIT');
            console.log(`✅ [${schema}] Migration successful`);
        } catch (error) {
            await client.query('ROLLBACK');
            console.error(`❌ [${schema}] Migration failed:`, error.message);
        } finally {
            client.release();
        }
    }
    console.log('\nAll migrations completed.');
}

if (require.main === module) {
    migrate().then(() => process.exit(0));
}

module.exports = migrate;
