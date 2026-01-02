const pool = require('../db');
const fs = require('fs');
const path = require('path');

async function migrate() {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        console.log('🚀 Starting Patient Portal Full Migration...');

        // 1. Create global lookup table if it doesn't exist
        console.log('Ensuring platform_patient_lookup exists in public schema...');
        await client.query(`
            CREATE TABLE IF NOT EXISTS public.platform_patient_lookup (
                email TEXT PRIMARY KEY,
                clinic_id TEXT NOT NULL,
                schema_name TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // 2. Run the schema-loop migrations
        // We'll read the files we created earlier
        const migrationFiles = [
            'patient_portal_migration.sql',
            'patient_portal_messaging_migration.sql',
            'patient_portal_appointments_migration.sql',
            'patient_portal_reset_migration.sql'
        ];

        for (const file of migrationFiles) {
            console.log(`Running migration: ${file}...`);
            const sqlPath = path.join(__dirname, '../../', file);
            if (fs.existsSync(sqlPath)) {
                const sql = fs.readFileSync(sqlPath, 'utf8');
                await client.query(sql);
                console.log(`✅ Finished ${file}`);
            } else {
                console.warn(`⚠️ Migration file not found: ${file}`);
            }
        }

        await client.query('COMMIT');
        console.log('✅ All Patient Portal migrations completed successfully');
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Migration failed:', error);
        process.exit(1);
    } finally {
        client.release();
    }
}

migrate();
