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
    console.log(`🚀 Migrating patient photos for schema: ${schema}`);

    // Set search path to target schema
    await client.query(`SET search_path TO ${schema}, public`);

    // 1. Update doc_type constraint in documents table
    console.log(`  Updating doc_type constraint in ${schema}.documents...`);
    try {
        // Drop old constraint and add new one
        await client.query(`
            ALTER TABLE documents 
            DROP CONSTRAINT IF EXISTS documents_doc_type_check;
            
            ALTER TABLE documents
            ADD CONSTRAINT documents_doc_type_check 
            CHECK (doc_type::text = ANY (ARRAY['imaging'::character varying, 'consult'::character varying, 'lab'::character varying, 'other'::character varying, 'profile_photo'::character varying]::text[]));
        `);
        console.log(`  ✅ documents_doc_type_check updated in ${schema}`);
    } catch (err) {
        console.warn(`  ⚠️  Warning updating doc_type constraint in ${schema}:`, err.message);
        // It might fail if the table doesn't exist yet in some schemas, which is fine
    }

    // 2. Add photo_document_id to patients table
    console.log(`  Adding photo_document_id to ${schema}.patients...`);
    try {
        await client.query(`
            ALTER TABLE patients
            ADD COLUMN IF NOT EXISTS photo_document_id UUID REFERENCES documents(id) ON DELETE SET NULL;
        `);
        console.log(`  ✅ photo_document_id added to ${schema}.patients`);
    } catch (err) {
        console.error(`  ❌ Failed to add photo_document_id to ${schema}:`, err.message);
    }
}

async function migrate() {
    console.log('Starting patient photo migration...');
    const client = await pool.connect();
    try {
        const schemasResult = await client.query(`
            SELECT schema_name 
            FROM information_schema.schemata 
            WHERE schema_name LIKE 'tenant_%' OR schema_name = 'public'
        `);

        const schemas = schemasResult.rows.map(r => r.schema_name);
        console.log(`Found schemas: ${schemas.join(', ')}`);

        for (const schema of schemas) {
            await runMigrationForSchema(client, schema);
        }
        console.log('\n✨ Patient photo migration completed successfully!');
    } catch (error) {
        console.error('❌ Global migration failed:', error);
    } finally {
        client.release();
        await pool.end();
    }
}

migrate();
