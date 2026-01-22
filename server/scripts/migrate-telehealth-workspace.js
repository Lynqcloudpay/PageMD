const pool = require('../db');

async function migrate() {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        console.log('Adding structured_note and dx columns to visits table...');
        await client.query(`
            ALTER TABLE visits 
            ADD COLUMN IF NOT EXISTS structured_note JSONB,
            ADD COLUMN IF NOT EXISTS dx TEXT[];
        `);

        console.log('Creating after_visit_summaries table...');
        await client.query(`
            CREATE TABLE IF NOT EXISTS after_visit_summaries (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                encounter_id UUID NOT NULL REFERENCES visits(id) ON DELETE CASCADE UNIQUE,
                instructions TEXT,
                follow_up TEXT,
                return_precautions TEXT,
                sent_at TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        await client.query('COMMIT');
        console.log('✅ Telehealth Workspace migration completed');
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Migration failed:', error);
        process.exit(1);
    } finally {
        client.release();
    }
}

if (require.main === module) {
    migrate().then(() => process.exit(0));
}

module.exports = migrate;
