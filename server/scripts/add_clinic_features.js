const pool = require('../db');

async function migrate() {
    console.log('🚀 Migrating clinics table to include enabled_features...');

    const client = await pool.controlPool.connect();
    try {
        await client.query('BEGIN');

        // Add enabled_features JSONB column if it doesn't exist
        await client.query(`
      ALTER TABLE clinics 
      ADD COLUMN IF NOT EXISTS enabled_features JSONB DEFAULT '{"efax": false, "labs": false, "telehealth": false, "eprescribe": false, "billing": true, "portal": true}'::jsonb;
    `);

        // Initialize enabled_features for any existing clinics that might have it as NULL
        await client.query(`
      UPDATE clinics 
      SET enabled_features = '{"efax": false, "labs": false, "telehealth": false, "eprescribe": false, "billing": true, "portal": true}'::jsonb
      WHERE enabled_features IS NULL;
    `);

        await client.query('COMMIT');
        console.log('✅ Clinic features migration completed successfully!');
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('❌ Migration failed:', err);
        process.exit(1);
    } finally {
        client.release();
        process.exit(0);
    }
}

migrate();
