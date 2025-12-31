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
    try {
        console.log('Fetching tenant schemas...');
        const res = await pool.query("SELECT schema_name FROM information_schema.schemata WHERE schema_name LIKE 'tenant_%'");
        const schemas = res.rows.map(r => r.schema_name);

        console.log(`Found ${schemas.length} tenant schemas.`);

        for (const schema of schemas) {
            console.log(`Updating schema: ${schema}`);
            const client = await pool.connect();
            try {
                await client.query('BEGIN');
                await client.query(`SET search_path TO ${schema}, public`);

                // 1. Visits Table Update
                console.log('  Adding last_level_billed to visits...');
                await client.query(`
                    ALTER TABLE visits 
                    ADD COLUMN IF NOT EXISTS last_level_billed INTEGER DEFAULT 0;
                `);

                // 2. Billing Table Update
                console.log('  Updating billing table columns...');
                const billingCols = [
                    "ADD COLUMN IF NOT EXISTS billed BOOLEAN DEFAULT FALSE",
                    "ADD COLUMN IF NOT EXISTS activity BOOLEAN DEFAULT TRUE",
                    "ADD COLUMN IF NOT EXISTS x12_partner_id INTEGER",
                    "ADD COLUMN IF NOT EXISTS process_file VARCHAR(255)",
                    "ADD COLUMN IF NOT EXISTS target VARCHAR(30)",
                    "ADD COLUMN IF NOT EXISTS authorized BOOLEAN DEFAULT FALSE",
                    "ADD COLUMN IF NOT EXISTS pricelevel VARCHAR(31) DEFAULT ''"
                ];
                await client.query(`ALTER TABLE billing ${billingCols.join(', ')};`);


                // 3. X12 Partners Table
                console.log('  Creating x12_partners table...');
                await client.query(`
                    CREATE TABLE IF NOT EXISTS x12_partners (
                        id SERIAL PRIMARY KEY,
                        name VARCHAR(255),
                        id_number VARCHAR(255),
                        x12_sender_id VARCHAR(255),
                        x12_receiver_id VARCHAR(255),
                        processing_format VARCHAR(50),
                        x12_isa01 VARCHAR(2) DEFAULT '00',
                        x12_isa02 VARCHAR(10) DEFAULT '          ',
                        x12_isa03 VARCHAR(2) DEFAULT '00',
                        x12_isa04 VARCHAR(10) DEFAULT '          ',
                        x12_isa05 CHAR(2) DEFAULT 'ZZ',
                        x12_isa07 CHAR(2) DEFAULT 'ZZ',
                        x12_isa14 CHAR(1) DEFAULT '0',
                        x12_isa15 CHAR(1) DEFAULT 'P',
                        x12_gs02 VARCHAR(15),
                        x12_gs03 VARCHAR(15),
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    );
                `);

                // 4. Claims Table (Replace old definition)
                console.log('  Recreating claims table...');
                // We drop and recreate.
                await client.query(`DROP TABLE IF EXISTS claims CASCADE;`);

                await client.query(`
                    CREATE TABLE claims (
                        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                        patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
                        encounter_id UUID NOT NULL REFERENCES visits(id) ON DELETE CASCADE,
                        version INTEGER NOT NULL DEFAULT 1,
                        payer_id UUID, 
                        status INTEGER DEFAULT 0,
                        payer_type INTEGER DEFAULT 0,
                        bill_process INTEGER DEFAULT 0,
                        bill_time TIMESTAMP,
                        process_time TIMESTAMP,
                        process_file VARCHAR(255),
                        target VARCHAR(30),
                        x12_partner_id INTEGER,
                        submitted_claim TEXT,
                        created_by UUID REFERENCES users(id),
                        diagnosis_codes JSONB,
                        procedure_codes JSONB,
                        total_amount DECIMAL(10, 2),
                        insurance_provider VARCHAR(255),
                        claim_number VARCHAR(100),
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        UNIQUE(patient_id, encounter_id, version)
                    );
                `);

                await client.query(`CREATE INDEX IF NOT EXISTS idx_claims_patient ON claims(patient_id);`);

                await client.query('COMMIT');
                console.log(`  Schema ${schema} updated successfully.`);

            } catch (e) {
                await client.query('ROLLBACK');
                console.error(`  Error updating schema ${schema}:`, e);
            } finally {
                client.release();
            }
        }
    } catch (err) {
        console.error('Migration failed:', err);
    } finally {
        // Close control pool
        await pool.end();
    }
}

updateSchema();
