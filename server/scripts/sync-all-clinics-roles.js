const pool = require('../db');
const governanceService = require('../services/governanceService');

async function syncAllClinics() {
    try {
        console.log('--- Starting Global Role Sync (Robust) ---');

        // 1. Get all clinics
        const clinics = await pool.controlPool.query('SELECT id, display_name, schema_name FROM clinics WHERE status = \'active\'');
        console.log(`Found ${clinics.rows.length} active clinics.`);

        // 2. Get all platform templates
        const templates = await pool.controlPool.query('SELECT role_key, display_name FROM platform_role_templates');
        console.log(`Platform has ${templates.rows.length} role templates defined.`);

        for (const clinic of clinics.rows) {
            console.log(`\n[${clinic.display_name}] Processing roles...`);

            // Link existing roles by name if they are not linked
            // 'Admin' -> CLINIC_ADMIN
            // 'Physician' -> PHYSICIAN
            // 'staff' -> FRONT_DESK
            const mappings = [
                { name: 'Admin', key: 'CLINIC_ADMIN' },
                { name: 'Physician', key: 'PHYSICIAN' },
                { name: 'staff', key: 'FRONT_DESK' },
                { name: 'Nurse Practitioner', key: 'NURSE_PRACTITIONER' },
                { name: 'Physician Assistant', key: 'PHYSICIAN_ASSISTANT' },
                { name: 'Nurse', key: 'NURSE' },
                { name: 'Medical Assistant', key: 'MEDICAL_ASSISTANT' },
                { name: 'Billing Specialist', key: 'BILLING_SPECIALIST' },
                { name: 'Front Desk', key: 'FRONT_DESK' }
            ];

            for (const map of mappings) {
                const tpl = templates.rows.find(t => t.role_key === map.key);
                if (!tpl) continue;

                // Update the roles table in the clinic schema to set source_template_id for existing roles
                await pool.controlPool.query(`
                    UPDATE ${clinic.schema_name}.roles 
                    SET source_template_id = $1 
                    WHERE name = $2 AND source_template_id IS NULL
                `, [tpl.id, map.name]);
            }

            // Now run the sync for each template to ensure ALL 8 exist
            for (const tpl of templates.rows) {
                try {
                    // console.log(`  Syncing ${tpl.role_key}...`);
                    await governanceService.syncRole(clinic.id, tpl.role_key, '00000000-0000-0000-0000-000000000000');
                } catch (roleErr) {
                    console.error(`  ❌ Failed to sync ${tpl.role_key}:`, roleErr.message);
                }
            }
            console.log(`  ✅ Done.`);
        }

        console.log('\n--- Global Role Sync Completed ---');
    } catch (err) {
        console.error('Migration failed:', err.message);
    } finally {
        await pool.end();
    }
}

syncAllClinics();
