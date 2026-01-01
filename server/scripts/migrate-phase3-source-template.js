/**
 * Phase 3 Migration: Source Template Linkage
 * Adds source_template_id to tenant roles tables to allow robust linking to platform templates.
 */
const pool = require('../db');

async function migrate() {
    const client = await pool.connect();
    try {
        console.log('--- Starting Phase 3 Migration: Source Template ID ---');

        // 1. Get all clinics
        const clinicsRes = await client.query('SELECT id, schema_name FROM clinics');
        const clinics = clinicsRes.rows;

        // 2. Get all platform templates for backfilling
        const templatesRes = await client.query('SELECT id, role_key FROM platform_role_templates');
        const templateMap = new Map();
        templatesRes.rows.forEach(t => templateMap.set(t.role_key, t.id));

        console.log(`Found ${clinics.length} clinics and ${templateMap.size} role templates.`);

        for (const clinic of clinics) {
            console.log(`Processing clinic: ${clinic.schema_name}`);

            // Add column if not exists
            await client.query(`
                ALTER TABLE ${clinic.schema_name}.roles 
                ADD COLUMN IF NOT EXISTS source_template_id UUID
            `);

            // Backfill: Update source_template_id based on name matching role_key
            for (const [key, id] of templateMap.entries()) {
                const res = await client.query(`
                    UPDATE ${clinic.schema_name}.roles 
                    SET source_template_id = $1 
                    WHERE name = $2 AND source_template_id IS NULL
                    RETURNING id
                `, [id, key]);

                if (res.rowCount > 0) {
                    console.log(`  - Linked ${res.rowCount} role(s) to template '${key}'`);
                }
            }
        }

        console.log('✅ Phase 3 migration completed successfully');
    } catch (err) {
        console.error('❌ Phase 3 migration failed:', err);
        throw err;
    } finally {
        client.release();
        await pool.end();
    }
}

migrate();
