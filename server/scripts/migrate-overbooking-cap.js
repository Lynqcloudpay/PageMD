const pool = require('../db');

async function migrate() {
    console.log('Starting migration: Add overbooking cap settings');

    // We need to run this on both the current tenant (via pool.query) 
    // and the control pool (via pool.controlPool) to be thorough.

    const migrationSql = `
        ALTER TABLE clinical_settings ADD COLUMN IF NOT EXISTS max_appointments_per_slot INTEGER DEFAULT NULL;
        ALTER TABLE practice_settings ADD COLUMN IF NOT EXISTS max_appointments_per_slot INTEGER DEFAULT NULL;
    `;

    const controlMigrationSql = `
        ALTER TABLE clinic_settings ADD COLUMN IF NOT EXISTS max_appointments_per_slot INTEGER DEFAULT NULL;
    `;

    try {
        console.log('Migrating tenant/main DB tables...');
        await pool.query(migrationSql);
        console.log('Tenant DB migration successful.');
    } catch (err) {
        console.error('Tenant DB migration failed:', err.message);
    }

    if (pool.controlPool) {
        try {
            console.log('Migrating control DB tables...');
            await pool.controlPool.query(controlMigrationSql);
            console.log('Control DB migration successful.');
        } catch (err) {
            console.warn('Control DB migration failed (might be same table or missing):', err.message);
        }
    }

    console.log('Migration suite complete!');
    if (require.main === module) {
        process.exit();
    }
}

if (require.main === module) {
    migrate();
}

module.exports = migrate;
