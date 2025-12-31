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
        console.log("Starting Phase 1 Billing Hardening...");

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

                // 1. Add Idempotency to Claims
                await client.query(`
                    ALTER TABLE claims 
                    ADD COLUMN IF NOT EXISTS idempotency_key UUID;
                `);

                await client.query(`
                    DO $$
                    BEGIN
                        IF NOT EXISTS (
                            SELECT 1 FROM pg_constraint WHERE conname = 'uniq_claims_idempotency_key' AND connamespace = (SELECT oid FROM pg_namespace WHERE nspname = '${schema}')
                        ) THEN
                            ALTER TABLE claims ADD CONSTRAINT uniq_claims_idempotency_key UNIQUE (idempotency_key);
                        END IF;
                    END
                    $$;
                `);
                console.log(`  > Updated claims table`);

                // 2. Create Billing Event Log
                await client.query(`
                    CREATE TABLE IF NOT EXISTS billing_event_log (
                        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                        event_type VARCHAR(50) NOT NULL,
                        actor_id UUID REFERENCES users(id),
                        visit_id UUID REFERENCES visits(id),
                        claim_id UUID REFERENCES claims(id),
                        session_id UUID REFERENCES ar_session(id),
                        details JSONB,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    );
                `);

                await client.query(`
                    CREATE INDEX IF NOT EXISTS idx_billing_log_visit ON billing_event_log(visit_id);
                    CREATE INDEX IF NOT EXISTS idx_billing_log_claim ON billing_event_log(claim_id);
                    CREATE INDEX IF NOT EXISTS idx_billing_log_session ON billing_event_log(session_id);
                `);
                console.log(`  > Created billing_event_log`);

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
