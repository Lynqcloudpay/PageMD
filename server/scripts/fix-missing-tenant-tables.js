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
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'paper_emr',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
});

async function fix() {
    console.log('🚀 Starting fix for missing tenant tables...');

    try {
        // 1. Get all tenant schemas
        const schemasRes = await pool.query(`
      SELECT schema_name 
      FROM information_schema.schemata 
      WHERE schema_name LIKE 'tenant_%'
    `);

        const schemas = schemasRes.rows.map(r => r.schema_name);
        console.log(`Found ${schemas.length} tenant schemas: ${schemas.join(', ')}`);

        for (const schema of schemas) {
            console.log(`\n--- Processing schema: ${schema} ---`);
            const client = await pool.connect();

            try {
                await client.query('BEGIN');

                // Set search path to this tenant
                console.log(`Setting search_path to ${schema}`);
                await client.query(`SET search_path TO ${schema}, public`);

                // Run the complete tenant schema with IF NOT EXISTS
                console.log(`Running core schema migration for ${schema}...`);
                await client.query(tenantSchemaSQL);

                await client.query('COMMIT');
                console.log(`✅ Finished schema: ${schema}`);
            } catch (err) {
                await client.query('ROLLBACK');
                console.error(`❌ Failed schema ${schema}:`, err.message);
            } finally {
                client.release();
            }
        }

        console.log('\n✨ All schemas processed.');

    } catch (error) {
        console.error('💥 Global error:', error.message);
    } finally {
        await pool.end();
    }
}

fix();
