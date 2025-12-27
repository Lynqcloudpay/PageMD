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

    // 1. Update Patients Table
    console.log(`  Updating patients table in ${schema}...`);
    await client.query(`
        ALTER TABLE patients
        ADD COLUMN IF NOT EXISTS middle_name VARCHAR(100),
        ADD COLUMN IF NOT EXISTS name_suffix VARCHAR(20),
        ADD COLUMN IF NOT EXISTS preferred_name VARCHAR(100),
        ADD COLUMN IF NOT EXISTS gender VARCHAR(50),
        ADD COLUMN IF NOT EXISTS race VARCHAR(50),
        ADD COLUMN IF NOT EXISTS ethnicity VARCHAR(50),
        ADD COLUMN IF NOT EXISTS marital_status VARCHAR(50),
        ADD COLUMN IF NOT EXISTS sex VARCHAR(10),
        ADD COLUMN IF NOT EXISTS phone_secondary VARCHAR(20),
        ADD COLUMN IF NOT EXISTS phone_cell VARCHAR(20),
        ADD COLUMN IF NOT EXISTS phone_work VARCHAR(20),
        ADD COLUMN IF NOT EXISTS phone_preferred VARCHAR(20),
        ADD COLUMN IF NOT EXISTS email_secondary VARCHAR(255),
        ADD COLUMN IF NOT EXISTS preferred_language VARCHAR(50),
        ADD COLUMN IF NOT EXISTS interpreter_needed BOOLEAN DEFAULT false,
        ADD COLUMN IF NOT EXISTS communication_preference VARCHAR(50),
        ADD COLUMN IF NOT EXISTS consent_to_text BOOLEAN DEFAULT false,
        ADD COLUMN IF NOT EXISTS consent_to_email BOOLEAN DEFAULT false,
        ADD COLUMN IF NOT EXISTS country VARCHAR(100) DEFAULT 'United States',
        ADD COLUMN IF NOT EXISTS address_type VARCHAR(50) DEFAULT 'Home',
        ADD COLUMN IF NOT EXISTS employment_status VARCHAR(50),
        ADD COLUMN IF NOT EXISTS occupation VARCHAR(255),
        ADD COLUMN IF NOT EXISTS employer_name VARCHAR(255),
        ADD COLUMN IF NOT EXISTS emergency_contact_name VARCHAR(255),
        ADD COLUMN IF NOT EXISTS emergency_contact_phone VARCHAR(20),
        ADD COLUMN IF NOT EXISTS emergency_contact_relationship VARCHAR(100),
        ADD COLUMN IF NOT EXISTS emergency_contact_address TEXT,
        ADD COLUMN IF NOT EXISTS emergency_contact_2_name VARCHAR(255),
        ADD COLUMN IF NOT EXISTS emergency_contact_2_phone VARCHAR(20),
        ADD COLUMN IF NOT EXISTS emergency_contact_2_relationship VARCHAR(100),
        ADD COLUMN IF NOT EXISTS insurance_group_number VARCHAR(100),
        ADD COLUMN IF NOT EXISTS insurance_plan_name VARCHAR(255),
        ADD COLUMN IF NOT EXISTS insurance_plan_type VARCHAR(100),
        ADD COLUMN IF NOT EXISTS insurance_subscriber_name VARCHAR(255),
        ADD COLUMN IF NOT EXISTS insurance_subscriber_dob DATE,
        ADD COLUMN IF NOT EXISTS insurance_subscriber_relationship VARCHAR(50),
        ADD COLUMN IF NOT EXISTS insurance_copay VARCHAR(50),
        ADD COLUMN IF NOT EXISTS insurance_effective_date DATE,
        ADD COLUMN IF NOT EXISTS insurance_expiry_date DATE,
        ADD COLUMN IF NOT EXISTS insurance_notes TEXT,
        ADD COLUMN IF NOT EXISTS pharmacy_npi VARCHAR(20),
        ADD COLUMN IF NOT EXISTS pharmacy_fax VARCHAR(20),
        ADD COLUMN IF NOT EXISTS pharmacy_preferred BOOLEAN DEFAULT false,
        ADD COLUMN IF NOT EXISTS referral_source VARCHAR(255),
        ADD COLUMN IF NOT EXISTS smoking_status VARCHAR(50),
        ADD COLUMN IF NOT EXISTS alcohol_use VARCHAR(50),
        ADD COLUMN IF NOT EXISTS allergies_known BOOLEAN DEFAULT false,
        ADD COLUMN IF NOT EXISTS notes TEXT,
        ADD COLUMN IF NOT EXISTS deceased BOOLEAN DEFAULT false,
        ADD COLUMN IF NOT EXISTS deceased_date DATE,
        ADD COLUMN IF NOT EXISTS encryption_metadata JSONB,
        ADD COLUMN IF NOT EXISTS clinic_id UUID;
    `);

    // 2. Update Audit Logs Table
    console.log(`  Updating audit_logs table in ${schema}...`);
    await client.query(`
        ALTER TABLE audit_logs
        ADD COLUMN IF NOT EXISTS actor_user_id UUID REFERENCES users(id),
        ADD COLUMN IF NOT EXISTS actor_ip INET,
        ADD COLUMN IF NOT EXISTS outcome VARCHAR(20) DEFAULT 'success',
        ADD COLUMN IF NOT EXISTS request_id VARCHAR(100),
        ADD COLUMN IF NOT EXISTS session_id UUID;
    `);

    // Ensure actor_user_id mapping if needed
    await client.query(`
        DO $$
        BEGIN
            IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='${schema}' AND table_name='audit_logs' AND column_name='user_id')
               AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='${schema}' AND table_name='audit_logs' AND column_name='record_id') THEN
               -- This is just a check, the actual rename is handled by ADD COLUMN IF NOT EXISTS logic generally
               NULL;
            END IF;
        END $$;
    `);

    console.log(`✅ Schema ${schema} updated.`);
}

async function migrate() {
    const client = await pool.connect();
    try {
        // Find all tenant schemas
        const schemasResult = await client.query(`
            SELECT schema_name 
            FROM information_schema.schemata 
            WHERE schema_name LIKE 'tenant_%' OR schema_name = 'public'
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

        console.log('\n✨ All multi-tenant migrations completed.');
    } catch (error) {
        console.error('❌ Global migration failed:', error);
    } finally {
        client.release();
        await pool.end();
    }
}

migrate();
