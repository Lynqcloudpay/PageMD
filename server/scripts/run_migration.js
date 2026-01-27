const fs = require('fs');
const path = require('path');
const pool = require('../db');

/**
 * Generic Migration Runner
 * Runs a SQL file across all active clinic schemas plus 'public'.
 */
async function runMigration() {
    const filePath = process.argv[2];
    if (!filePath) {
        console.error('Usage: node run_migration.js <path_to_sql_file>');
        process.exit(1);
    }

    const absolutePath = path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);
    if (!fs.existsSync(absolutePath)) {
        console.error(`File not found: ${absolutePath}`);
        process.exit(1);
    }

    const sql = fs.readFileSync(absolutePath, 'utf8');

    try {
        console.log(`--- Starting Migration: ${path.basename(filePath)} ---`);

        // 1. Get all clinic schemas
        const clinicsResult = await pool.query("SELECT schema_name FROM clinics WHERE status = 'active'");
        const schemas = ['public', ...clinicsResult.rows.map(r => r.schema_name)];

        console.log(`Found ${schemas.length} schemas to update.`);

        for (const schema of schemas) {
            console.log(`Processing schema: ${schema}...`);
            const client = await pool.connect();
            try {
                // Ensure schema exists before trying to use it
                if (schema !== 'public') {
                    const schemaExists = await client.query("SELECT 1 FROM information_schema.schemata WHERE schema_name = $1", [schema]);
                    if (schemaExists.rowCount === 0) {
                        console.log(`⚠️  Schema ${schema} does not exist. Skipping.`);
                        continue;
                    }
                }

                await client.query(`SET search_path TO ${schema}, public`);
                await client.query('BEGIN');
                await client.query(sql);
                await client.query('COMMIT');
                console.log(`✅ Schema ${schema} updated successfully.`);
            } catch (err) {
                await client.query('ROLLBACK');
                console.error(`❌ Error updating schema ${schema}:`, err.message);
            } finally {
                client.release();
            }
        }

        console.log('--- Migration Complete ---');
        process.exit(0);
    } catch (error) {
        console.error('Migration execution failed:', error);
        process.exit(1);
    }
}

runMigration();
