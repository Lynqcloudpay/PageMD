const fs = require('fs');
const path = require('path');
const pool = require('../db');

/**
 * Project Echo Activation Script (Fixed for Governance Schema)
 * 
 * 1. Runs the foundation SQL (tables, indexes, audit trail)
 * 2. Injects the 'ai.echo' privilege into the platform templates
 * 3. Syncs the privilege to all active clinic schemas
 */
async function activateEcho() {
    console.log('🚀 Starting Echo AI Activation...');

    try {
        // 1. Run Schema Migration
        // Note: The migration file uses "CREATE TABLE IF NOT EXISTS"
        const schemaPath = path.join(__dirname, '../migrations/20260210_echo_foundation.sql');
        const schemaSql = fs.readFileSync(schemaPath, 'utf8');

        console.log('📦 Creating Echo database tables...');
        // We run this against the main pool which defaults to PUBLIC schema
        await pool.query(schemaSql);
        console.log('✅ Base schema created.');

        // 2. Inject Privilege into Platform Governance
        console.log('🛡️  Registering ai.echo in platform governance...');

        // Find Physician and Admin templates
        const templatesRes = await pool.controlPool.query(
            "SELECT id, role_key FROM platform_role_templates WHERE role_key IN ('CLINIC_ADMIN', 'PHYSICIAN', 'NURSE_PRACTITIONER', 'PHYSICIAN_ASSISTANT')"
        );

        if (templatesRes.rows.length === 0) {
            console.warn('⚠️  No platform role templates found. Skipping template assignment.');
        } else {
            for (const tpl of templatesRes.rows) {
                try {
                    await pool.controlPool.query(`
                        INSERT INTO platform_role_template_privileges (template_id, privilege_name)
                        VALUES ($1, $2)
                        ON CONFLICT DO NOTHING
                    `, [tpl.id, 'ai.echo']);
                    console.log(`   ✅ Assigned to ${tpl.role_key}`);
                } catch (tplErr) {
                    console.warn(`   ⚠️ Could not assign to ${tpl.role_key}:`, tplErr.message);
                }
            }
        }

        // 3. Inject Privilege into each Clinic Schema + PUBLIC schema
        console.log('🔄 Syncing ai.echo into all active tenant schemas...');
        const clinics = await pool.controlPool.query("SELECT schema_name FROM clinics WHERE status = 'active'");

        // Include 'public' in the sync list
        const schemas = ['public', ...clinics.rows.map(c => c.schema_name)];

        for (const schema of schemas) {
            try {
                // Check if privileges table exists in the schema
                const tableCheck = await pool.controlPool.query(`
                    SELECT 1 FROM information_schema.tables 
                    WHERE table_schema = $1 AND table_name = 'privileges'
                `, [schema]);

                if (tableCheck.rows.length === 0) {
                    console.log(`   ⏭️  Skipping schema ${schema}: 'privileges' table not found.`);
                    continue;
                }

                // Ensure the privilege exists in the tenant's privilege list
                await pool.controlPool.query(`
                    INSERT INTO ${schema}.privileges (name, description, category)
                    VALUES ($1, $2, $3)
                    ON CONFLICT (name) DO UPDATE SET description = $2, category = $3
                `, ['ai.echo', 'Access to Echo AI Clinical Assistant', 'AI']);

                // Assign to roles that are linked to Physician or Admin templates
                await pool.controlPool.query(`
                    INSERT INTO ${schema}.role_privileges (role_id, privilege_id)
                    SELECT r.id, p.id 
                    FROM ${schema}.roles r
                    JOIN ${schema}.privileges p ON p.name = 'ai.echo'
                    WHERE r.name ILIKE '%Physician%' 
                       OR r.name ILIKE '%Clinician%' 
                       OR r.name ILIKE '%Admin%'
                       OR r.name ILIKE '%Practitioner%'
                       OR r.name ILIKE '%Super%'
                    ON CONFLICT DO NOTHING
                `);

                console.log(`   ✅ Synced for schema: ${schema}`);
            } catch (clinicErr) {
                console.warn(`   ⚠️ Sync failed for ${schema}:`, clinicErr.message);
            }
        }

        console.log('✨ Echo has been successfully activated across the platform.');

    } catch (err) {
        console.error('❌ Echo Activation Failed:', err);
    } finally {
        await pool.end();
    }
}

activateEcho();
