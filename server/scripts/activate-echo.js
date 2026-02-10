const fs = require('fs');
const path = require('path');
const pool = require('../db');

/**
 * Project Echo Activation Script
 * 
 * 1. Runs the foundation SQL (tables, indexes, audit trail)
 * 2. Injects the 'ai.echo' privilege into the platform
 * 3. Assigns 'ai.echo' to basic Clinician roles
 */
async function activateEcho() {
    console.log('🚀 Starting Echo AI Activation...');

    try {
        // 1. Run Schema Migration
        const schemaPath = path.join(__dirname, '../migrations/20260210_echo_foundation.sql');
        const schemaSql = fs.readFileSync(schemaPath, 'utf8');

        console.log('📦 Creating Echo database tables...');
        await pool.query(schemaSql);
        console.log('✅ Base schema created.');

        // 2. Inject Privilege (Platform Level)
        console.log('🛡️  Registering ai.echo privilege...');

        // Add to main privileges table (per-tenant)
        const clinics = await pool.controlPool.query("SELECT schema_name FROM clinics WHERE status = 'active'");
        for (const clinic of clinics.rows) {
            try {
                await pool.controlPool.query(`
                    INSERT INTO ${clinic.schema_name}.privileges (name, description, category)
                    VALUES ($1, $2, $3)
                    ON CONFLICT (name) DO UPDATE SET description = $2, category = $3
                `, ['ai.echo', 'Access to Echo AI Clinical Assistant', 'AI']);
            } catch (pErr) {
                console.warn(`  ⚠️ Failed to inject privilege into ${clinic.schema_name}:`, pErr.message);
            }
        }

        // Add to platform templates (Global)
        const echoPrivRes = await pool.controlPool.query(
            "INSERT INTO platform_privileges (name, description, category) VALUES ($1, $2, $3) ON CONFLICT (name) DO NOTHING RETURNING id",
            ['ai.echo', 'Access to Echo AI Clinical Assistant', 'AI']
        );

        const privId = echoPrivRes.rows.length > 0
            ? echoPrivRes.rows[0].id
            : (await pool.controlPool.query("SELECT id FROM platform_privileges WHERE name = 'ai.echo'")).rows[0].id;

        // Assign to Clinician and Admin templates
        const templates = await pool.controlPool.query(
            "SELECT id FROM platform_role_templates WHERE role_key IN ('CLINICIAN', 'ADMIN', 'NP_PA', 'PHYSICIAN')"
        );

        for (const tpl of templates.rows) {
            await pool.controlPool.query(`
                INSERT INTO platform_role_privileges (role_template_id, privilege_id)
                VALUES ($1, $2)
                ON CONFLICT DO NOTHING
            `, [tpl.id, privId]);
        }

        console.log('✅ Privileges registered and assigned to templates.');

        // 3. Sync Existing Roles (Tenant Level)
        console.log('🔄 Syncing clinic roles for all active tenants...');
        // We'll give it to all existing 'Clinical' roles as a baseline
        for (const clinic of clinics.rows) {
            try {
                // Find clinical roles in this clinic
                const rolesRes = await pool.controlPool.query(`
                    SELECT id FROM ${clinic.schema_name}.roles 
                    WHERE name ILIKE '%Clinician%' OR name ILIKE '%Physician%' OR name ILIKE '%Admin%'
                `);

                for (const role of rolesRes.rows) {
                    await pool.controlPool.query(`
                        INSERT INTO ${clinic.schema_name}.role_privileges (role_id, privilege_id)
                        SELECT $1, id FROM ${clinic.schema_name}.privileges WHERE name = 'ai.echo'
                        ON CONFLICT DO NOTHING
                    `, [role.id]);
                }
            } catch (syncErr) {
                console.warn(`  ⚠️ Sync failed for ${clinic.schema_name}:`, syncErr.message);
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
