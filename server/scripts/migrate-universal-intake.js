/**
 * Migration: Universal Digital Intake System (Phase 1)
 * This replaces the previous invite-based system.
 */
const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const pool = new Pool(process.env.DATABASE_URL ? {
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
} : {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'paper_emr',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
});

async function migrate() {
    const client = await pool.connect();
    try {
        // Get all active tenant schemas
        const schemas = await client.query("SELECT schema_name FROM clinics WHERE status = 'active'");

        for (const row of schemas.rows) {
            const schema = row.schema_name;
            console.log(`Migrating schema: ${schema}`);

            await client.query('BEGIN');

            // 1. Drop old tables (Revert previous implementation)
            await client.query(`DROP TABLE IF EXISTS ${schema}.intake_submissions CASCADE;`);
            await client.query(`DROP TABLE IF EXISTS ${schema}.intake_invites CASCADE;`);

            // 2. Create NEW intake_sessions table
            await client.query(`
        CREATE TABLE IF NOT EXISTS ${schema}.intake_sessions (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          tenant_id UUID NOT NULL,
          status VARCHAR(20) NOT NULL DEFAULT 'IN_PROGRESS', -- IN_PROGRESS, SUBMITTED, NEEDS_EDITS, APPROVED, EXPIRED
          resume_code_hash TEXT NOT NULL,
          expires_at TIMESTAMPTZ NOT NULL,
          patient_id UUID, -- Links to EMR patient once approved
          prefill_json JSONB, -- {firstName, lastName, dob, phone}
          data_json JSONB DEFAULT '{}',
          signature_json JSONB DEFAULT '{}',
          review_notes JSONB DEFAULT '[]',
          submitted_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        );
      `);

            // 3. Add indexes
            await client.query(`CREATE INDEX IF NOT EXISTS idx_intake_sessions_resume ON ${schema}.intake_sessions (resume_code_hash);`);
            await client.query(`CREATE INDEX IF NOT EXISTS idx_intake_sessions_status ON ${schema}.intake_sessions (status);`);
            await client.query(`CREATE INDEX IF NOT EXISTS idx_intake_sessions_patient ON ${schema}.intake_sessions (patient_id);`);

            // 4. Trigger for updated_at
            await client.query(`
        CREATE OR REPLACE FUNCTION ${schema}.update_updated_at_column()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.updated_at = now();
            RETURN NEW;
        END;
        $$ language 'plpgsql';
      `);

            await client.query(`
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_intake_sessions_updated_at') THEN
                CREATE TRIGGER trg_intake_sessions_updated_at
                BEFORE UPDATE ON ${schema}.intake_sessions
                FOR EACH ROW
                EXECUTE FUNCTION ${schema}.update_updated_at_column();
            END IF;
        END $$;
      `);

            await client.query('COMMIT');
            console.log(`Successfully migrated ${schema}`);
        }

        console.log('All schemas migrated and old tables removed.');
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Migration failed:', err);
    } finally {
        client.release();
        await pool.end();
    }
}

migrate();
