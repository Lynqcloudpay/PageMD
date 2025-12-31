const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'paper_emr',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
});

async function updateSchema() {
    const client = await pool.connect();
    try {
        console.log("Starting Idempotency Schema Update...");

        // 1. Get all tenant schemas
        const res = await client.query(`
            SELECT schema_name 
            FROM information_schema.schemata 
            WHERE schema_name LIKE 'tenant_%'
        `);

        console.log(`Found ${res.rows.length} tenant schemas.`);

        for (const row of res.rows) {
            const schema = row.schema_name;
            console.log(`Updating schema: ${schema}`);

            try {
                await client.query(`SET search_path TO ${schema}, public`);

                // Add idempotency_key column
                await client.query(`
                    ALTER TABLE ar_session 
                    ADD COLUMN IF NOT EXISTS idempotency_key UUID;
                `);

                // Add Unique Constraint (if not exists)
                // Postgres doesn't support "ADD CONSTRAINT IF NOT EXISTS" directly in one line easily
                // So we check first or use DO block.
                await client.query(`
                    DO $$
                    BEGIN
                        IF NOT EXISTS (
                            SELECT 1 FROM pg_constraint WHERE conname = 'uniq_ar_session_idempotency_key' AND connamespace = (SELECT oid FROM pg_namespace WHERE nspname = '${schema}')
                        ) THEN
                            ALTER TABLE ar_session ADD CONSTRAINT uniq_ar_session_idempotency_key UNIQUE (idempotency_key);
                        END IF;
                    END
                    $$;
                `);

                console.log(`  > Updated ar_session in ${schema}`);

            } catch (err) {
                console.error(`  > Failed to update ${schema}:`, err.message);
            }
        }

    } catch (e) {
        console.error("Migration Failed:", e);
    } finally {
        client.release();
        await pool.end();
    }
}

updateSchema();
