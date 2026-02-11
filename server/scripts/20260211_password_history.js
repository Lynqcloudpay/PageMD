const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

async function runMigrationForSchema(client, schema) {
    console.log(`🚀 Migrating schema: ${schema}`);

    // Set search path to target schema
    await client.query(`SET search_path TO ${schema}, public`);

    // Create Password History Table
    console.log(`  Creating password_history table in ${schema}...`);
    await client.query(`
        CREATE TABLE IF NOT EXISTS password_history (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            password_hash TEXT NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
        
        CREATE INDEX IF NOT EXISTS idx_password_history_user_id ON password_history(user_id);
    `);

    console.log(`✅ Password history table in ${schema} created.`);
}

async function migrate() {
    const client = await pool.connect();
    try {
        // Find all tenant schemas from the clinics table first
        let schemas = ['public'];
        try {
            const clinicsResult = await client.query(`SELECT DISTINCT schema_name FROM clinics WHERE schema_name IS NOT NULL`);
            const clinicSchemas = clinicsResult.rows.map(r => r.schema_name);
            schemas = [...new Set([...schemas, ...clinicSchemas])];
        } catch (e) {
            console.warn('Could not fetch schemas from clinics table, falling back to pattern search:', e.message);
            const schemasResult = await client.query(`
                SELECT schema_name 
                FROM information_schema.schemata 
                WHERE schema_name LIKE 'tenant_%' OR schema_name = 'public'
            `);
            schemas = schemasResult.rows.map(r => r.schema_name);
        }

        console.log(`Found schemas to migrate: ${schemas.join(', ')}`);

        for (const schema of schemas) {
            try {
                await runMigrationForSchema(client, schema);
            } catch (err) {
                console.error(`❌ Failed to migrate schema ${schema}:`, err.message);
            }
        }

    } finally {
        client.release();
    }
}

migrate()
    .then(() => {
        console.log('\n✨ Password history migrations completed.');
        process.exit(0);
    })
    .catch(err => {
        console.error('Migration failed:', err);
        process.exit(1);
    });
