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

    // Update Users Table
    console.log(`  Updating users table in ${schema}...`);
    await client.query(`
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS invite_token UUID UNIQUE,
        ADD COLUMN IF NOT EXISTS invite_expires_at TIMESTAMP WITH TIME ZONE,
        ADD COLUMN IF NOT EXISTS reset_token UUID UNIQUE,
        ADD COLUMN IF NOT EXISTS reset_expires_at TIMESTAMP WITH TIME ZONE;
    `);

    console.log(`✅ Users table in ${schema} updated.`);
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

        console.log('\n✨ Auth token migrations completed.');
    } catch (error) {
        console.error('❌ Global migration failed:', error);
    } finally {
        client.release();
        await pool.end();
    }
}

migrate();
