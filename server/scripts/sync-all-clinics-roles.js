const pool = require('../db');
const governanceService = require('../services/governanceService');

async function syncAllClinics() {
    try {
        console.log('--- Starting Global Role Sync ---');

        // 1. Get all clinics
        const clinics = await pool.controlPool.query('SELECT id, display_name, schema_name FROM clinics WHERE status = \'active\'');
        console.log(`Found ${clinics.rows.length} active clinics.`);

        // 2. Get all platform templates
        const templates = await pool.controlPool.query('SELECT role_key FROM platform_role_templates');
        const roleKeys = templates.rows.map(t => t.role_key);
        console.log(`Platform has ${roleKeys.length} role templates defined: ${roleKeys.join(', ')}`);

        for (const clinic of clinics.rows) {
            console.log(`\nProcessing Clinic: ${clinic.display_name} (${clinic.schema_name})`);

            for (const roleKey of roleKeys) {
                try {
                    console.log(`  Syncing role: ${roleKey}...`);
                    // Using a system admin ID for the audit log
                    await governanceService.syncRole(clinic.id, roleKey, '00000000-0000-0000-0000-000000000000');
                    console.log(`  ✅ ${roleKey} synced.`);
                } catch (roleErr) {
                    console.error(`  ❌ Failed to sync ${roleKey}:`, roleErr.message);
                }
            }
        }

        console.log('\n--- Global Role Sync Completed ---');
    } catch (err) {
        console.error('Migration failed:', err.message);
    } finally {
        await pool.end();
    }
}

syncAllClinics();
