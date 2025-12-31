/**
 * Fix Missing Tenant Tables
 * 
 * This script ensures all existing tenant schemas have the latest core tables,
 * including e-prescribing tables which might have been missed in earlier migrations.
 * 
 * Run with: node server/scripts/fix-missing-tenant-tables.js
 */

const { Pool } = require('pg');
require('dotenv').config();
const tenantSchemaSQL = require('../config/tenantSchema');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'paper_emr',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function fix() {
    console.log('🚀 Starting fix for missing tenant tables...');

    try {
        // 1. Get all tenant schemas from clinics table
        const schemasRes = await pool.query(`
          SELECT DISTINCT schema_name 
          FROM clinics 
          WHERE status = 'active'
        `);

        const schemas = schemasRes.rows.map(r => r.schema_name);
        console.log(`Found ${schemas.length} tenant schemas: ${schemas.join(', ')}`);

        for (const schema of schemas) {
            console.log(`\n--- Processing schema: ${schema} ---`);
            const client = await pool.connect();

            try {
                await client.query('BEGIN');

                // Ensure schema exists
                console.log(`Ensuring schema ${schema} exists...`);
                await client.query(`CREATE SCHEMA IF NOT EXISTS ${schema}`);

                // Set search path to this tenant
                console.log(`Setting search_path to ${schema}`);
                await client.query(`SET search_path TO ${schema}, public`);

                // Run the complete tenant schema with IF NOT EXISTS
                console.log(`Running core schema migration for ${schema}...`);
                await client.query(tenantSchemaSQL);

                // Manual column migrations for port parity
                console.log(`Ensuring new columns exist in ${schema}...`);
                await client.query(`
                  ALTER TABLE ar_session ADD COLUMN IF NOT EXISTS encounter UUID REFERENCES visits(id);
                  ALTER TABLE billing ADD COLUMN IF NOT EXISTS modifier1 VARCHAR(12) DEFAULT '';
                  ALTER TABLE billing ADD COLUMN IF NOT EXISTS modifier2 VARCHAR(12) DEFAULT '';
                  ALTER TABLE billing ADD COLUMN IF NOT EXISTS modifier3 VARCHAR(12) DEFAULT '';
                  ALTER TABLE billing ADD COLUMN IF NOT EXISTS modifier4 VARCHAR(12) DEFAULT '';
                  ALTER TABLE fee_schedule ADD COLUMN IF NOT EXISTS price_level VARCHAR(31) DEFAULT 'Standard';
                  
                  -- New Hardening Indexes/Constraints (ignore errors if already exist)
                `);

                // Try to add constraints separately since they can fail if already exist
                try {
                    await client.query(`ALTER TABLE drug_inventory ADD CONSTRAINT chk_drug_inventory_non_negative CHECK (on_hand >= 0)`);
                } catch (e) { /* constraint may already exist */ }

                try {
                    await client.query(`CREATE INDEX IF NOT EXISTS idx_drug_inventory_fifo ON drug_inventory(drug_id, expiration, id)`);
                    await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS uniq_ar_session_patient_copay_per_encounter ON ar_session(encounter) WHERE payment_type = 'Patient Payment'`);
                    await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS uniq_billing_encounter_code_once ON billing(encounter, code, COALESCE(modifier1,'')) WHERE activity = true`);
                } catch (e) { console.log('Index creation note:', e.message); }

                await client.query('COMMIT');
                console.log(`✅ Finished schema: ${schema}`);
            } catch (err) {
                if (client) await client.query('ROLLBACK');
                console.error(`❌ Failed schema ${schema}:`, err.message);
            } finally {
                if (client) client.release();
            }
        }

        console.log('\n✨ All schemas processed.');

    } catch (error) {
        console.error('💥 Global error:', error.message);
        if (error.stack) console.error(error.stack);
    } finally {
        await pool.end();
    }
}

fix();
