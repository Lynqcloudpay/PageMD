const { Pool } = require('pg');
require('dotenv').config();

const config = process.env.DATABASE_URL
    ? { connectionString: process.env.DATABASE_URL }
    : {
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        database: process.env.DB_NAME || 'paper_emr',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'postgres',
    };

const pool = new Pool(config);

async function runMigrationForSchema(client, schema) {
    console.log(`🚀 Migrating schema: ${schema}`);

    // Set search path to target schema
    await client.query(`SET search_path TO ${schema}, public`);

    // 1. Update Visits Table
    console.log(`  Updating visits table in ${schema}...`);
    await client.query(`
        ALTER TABLE visits
        ADD COLUMN IF NOT EXISTS clinical_snapshot JSONB,
        ADD COLUMN IF NOT EXISTS structured_note JSONB,
        ADD COLUMN IF NOT EXISTS dx TEXT[],
        ADD COLUMN IF NOT EXISTS appointment_id UUID,
        ADD COLUMN IF NOT EXISTS note_signed_at TIMESTAMP,
        ADD COLUMN IF NOT EXISTS note_signed_by UUID,
        ADD COLUMN IF NOT EXISTS note_draft TEXT,
        ADD COLUMN IF NOT EXISTS status VARCHAR(50);
    `);

    // 2. Update Appointments Table
    console.log(`  Updating appointments table in ${schema}...`);
    await client.query(`
        ALTER TABLE appointments
        ADD COLUMN IF NOT EXISTS visit_method VARCHAR(50) DEFAULT 'office',
        ADD COLUMN IF NOT EXISTS clinic_id UUID;
    `);

    // 3. Update Patients Table (Ensure dob/date_of_birth parity)
    console.log(`  Updating patients table in ${schema}...`);
    await client.query(`
        ALTER TABLE patients
        ADD COLUMN IF NOT EXISTS dob DATE,
        ADD COLUMN IF NOT EXISTS date_of_birth DATE;
    `);

    // Sync dob and date_of_birth if one is missing but other exists
    await client.query(`
        UPDATE patients SET dob = date_of_birth WHERE dob IS NULL AND date_of_birth IS NOT NULL;
        UPDATE patients SET date_of_birth = dob WHERE date_of_birth IS NULL AND dob IS NOT NULL;
    `);

    console.log(`✅ Schema ${schema} updated successfully.`);
}

async function migrate() {
    const client = await pool.connect();
    try {
        // Find all tenant schemas + public
        const schemasResult = await client.query(`
            SELECT schema_name 
            FROM information_schema.schemata 
            WHERE schema_name LIKE 'tenant_%' OR schema_name = 'public'
        `);

        const schemas = schemasResult.rows.map(r => r.schema_name);
        console.log(`Found schemas to check: ${schemas.join(', ')}`);

        for (const schema of schemas) {
            try {
                await runMigrationForSchema(client, schema);
            } catch (err) {
                console.error(`❌ Failed to migrate schema ${schema}:`, err.message);
            }
        }

        console.log('\n✨ All schema corrections completed.');
    } catch (error) {
        console.error('❌ Global migration failed:', error);
    } finally {
        client.release();
        await pool.end();
    }
}

migrate();
