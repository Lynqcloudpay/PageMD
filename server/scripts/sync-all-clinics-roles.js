const pool = require('../db');
const governanceService = require('../services/governanceService');

async function syncAllClinics() {
    try {
        console.log('--- Starting Global Role Sync & Deduplication ---');

        // 1. Get all clinics
        const clinics = await pool.controlPool.query('SELECT id, display_name, schema_name FROM clinics WHERE status = \'active\'');
        console.log(`Found ${clinics.rows.length} active clinics.`);

        // 2. Get all platform templates
        const templates = await pool.controlPool.query('SELECT id, role_key, display_name FROM platform_role_templates');
        console.log(`Platform has ${templates.rows.length} role templates defined.`);

        for (const clinic of clinics.rows) {
            console.log(`\n[${clinic.display_name}] Processing roles...`);

            // Step 1: Sync all standard roles
            // This will link/create roles using the new logic (prefers display names)
            for (const tpl of templates.rows) {
                try {
                    await governanceService.syncRole(clinic.id, tpl.role_key, '00000000-0000-0000-0000-000000000000');
                } catch (roleErr) {
                    console.error(`  ❌ Failed to sync ${tpl.role_key}:`, roleErr.message);
                }
            }

            // Step 2: Handle Redundancy & User Migration
            // We might have legacy roles (e.g. 'Admin') and dummy roles created by previous scripts (e.g. 'CLINIC_ADMIN')
            for (const tpl of templates.rows) {
                // Find all roles linked to this template ID in this clinic
                const rolesRes = await pool.controlPool.query(`
                    SELECT id, name FROM ${clinic.schema_name}.roles WHERE source_template_id = $1
                `, [tpl.id]);

                if (rolesRes.rows.length > 1) {
                    console.log(`  ⚠️ Multiple roles found for template ${tpl.role_key}. Deduplicating...`);

                    // Prefer the one that IS already used by users, or the one with the prettier name
                    // Actually, let's find the one that is NOT named exactly like the role_key (if possible)
                    const canonicalRole = rolesRes.rows.find(r => r.name === tpl.display_name) || rolesRes.rows[0];
                    const redundantRoles = rolesRes.rows.filter(r => r.id !== canonicalRole.id);

                    for (const red of redundantRoles) {
                        console.log(`    Migrating users from '${red.name}' to '${canonicalRole.name}'...`);
                        await pool.controlPool.query(`
                            UPDATE ${clinic.schema_name}.users SET role_id = $1 WHERE role_id = $2
                        `, [canonicalRole.id, red.id]);

                        console.log(`    Deleting redundant role '${red.name}'...`);
                        await pool.controlPool.query(`
                            DELETE FROM ${clinic.schema_name}.roles WHERE id = $1
                        `, [red.id]);
                    }
                }
            }

            // Step 3: Link 'staff' to FRONT_DESK if FRONT_DESK is unlinked or if staff is still around
            const staffRes = await pool.controlPool.query(`SELECT id FROM ${clinic.schema_name}.roles WHERE name = 'staff'`);
            if (staffRes.rows.length > 0) {
                const frontDeskTpl = templates.rows.find(t => t.role_key === 'FRONT_DESK');
                if (frontDeskTpl) {
                    const frontDeskRole = await pool.controlPool.query(`SELECT id FROM ${clinic.schema_name}.roles WHERE source_template_id = $1`, [frontDeskTpl.id]);
                    if (frontDeskRole.rows.length > 0) {
                        console.log(`  Merging legacy 'staff' into 'Front Desk'...`);
                        await pool.controlPool.query(`UPDATE ${clinic.schema_name}.users SET role_id = $1 WHERE role_id = $2`, [frontDeskRole.rows[0].id, staffRes.rows[0].id]);
                        await pool.controlPool.query(`DELETE FROM ${clinic.schema_name}.roles WHERE id = $1`, [staffRes.rows[0].id]);
                    }
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
