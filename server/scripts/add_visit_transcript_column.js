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
    console.log(`🚀 Adding visit_transcript to schema: ${schema}`);
    await client.query(`SET search_path TO ${schema}, public`);

    const tableVisits = await client.query(`SELECT 1 FROM information_schema.tables WHERE table_schema = '${schema}' AND table_name = 'visits'`);
    if (tableVisits.rows.length > 0) {
        await client.query(`
            ALTER TABLE visits
            ADD COLUMN IF NOT EXISTS visit_transcript TEXT;
        `);
        console.log(`  ✅ visits table in ${schema} updated with visit_transcript.`);
    } else {
        console.log(`  ⚠️ visits table not found in ${schema}.`);
    }
}

async function migrate() {
    let client;
    try {
        client = await pool.connect();

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

        console.log('\n✨ All visit_transcript multi-tenant migrations completed.');
    } catch (error) {
        console.error('❌ Global migration failed:', error);
    } finally {
        if (client) client.release();
        await pool.end();
    }
}

migrate();
