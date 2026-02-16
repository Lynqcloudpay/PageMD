/**
 * Add Telehealth Columns (Multi-tenant Robust)
 * 
 * This script adds 'visit_method' column to appointments and portal_appointment_requests tables
 * across all tenant and sandbox schemas.
 * 
 * Usage: node scripts/add-telehealth-columns.js
 */

const pool = require('../db');

async function runMigrationForSchema(client, schema) {
  console.log(`🚀 Migrating telehealth columns for schema: ${schema}`);

  // Set search path
  await client.query(`SET search_path TO ${schema}, public`);

  // 1. Update appointments
  await client.query(`
        ALTER TABLE appointments 
        ADD COLUMN IF NOT EXISTS visit_method VARCHAR(20) DEFAULT 'office'
    `);
  console.log(`  ✅ Added visit_method to appointments in ${schema}`);

  // 2. Update portal_appointment_requests
  const tableRes = await client.query(`
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = '${schema}' AND table_name = 'portal_appointment_requests'
    `);
  if (tableRes.rows.length > 0) {
    await client.query(`
            ALTER TABLE portal_appointment_requests 
            ADD COLUMN IF NOT EXISTS visit_method VARCHAR(20) DEFAULT 'office'
        `);
    console.log(`  ✅ Added visit_method to portal_appointment_requests in ${schema}`);
  }
}

async function migrate() {
  console.log('Starting multi-tenant telehealth migration...');
  const client = await pool.connect();

  try {
    // 1. List all schemas
    const schemasResult = await client.query(`
            SELECT schema_name 
            FROM information_schema.schemata 
            WHERE schema_name LIKE 'tenant_%' OR schema_name LIKE 'sandbox_%' OR schema_name = 'sandbox'
        `);

    const schemas = schemasResult.rows.map(r => r.schema_name);
    console.log(`Found schemas: ${schemas.join(', ')}`);

    // Also include public for base tables
    await runMigrationForSchema(client, 'public');

    for (const schema of schemas) {
      try {
        await runMigrationForSchema(client, schema);
      } catch (err) {
        console.error(`❌ Failed to migrate schema ${schema}:`, err.message);
      }
    }

    console.log('✨ Telehealth migration complete!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    client.release();
  }
}

if (require.main === module) {
  migrate()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = migrate;
