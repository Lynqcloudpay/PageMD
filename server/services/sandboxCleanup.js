/**
 * Sandbox Cleanup Service
 * Automatically drops sandbox schemas older than a threshold (e.g., 30 minutes).
 */

const pool = require('../db');

async function cleanupExpiredSandboxes() {
    console.log('[Sandbox Cleanup] Running routine...');
    const client = await pool.controlPool.connect();

    try {
        // Find all schemas starting with sandbox_
        const res = await client.query(`
            SELECT schema_name 
            FROM information_schema.schemata 
            WHERE schema_name LIKE 'sandbox_%'
        `);

        for (const row of res.rows) {
            const schemaName = row.schema_name;
            const sandboxId = schemaName.replace('sandbox_', '');

            // We'll check the creation time of the schema.
            // PostgreSQL doesn't store schema creation time directly in information_schema.
            // As a workaround, we can check the 'created_at' of the 'users' table in that schema,
            // or we could have stored metadata in a control table.

            // For now, let's use a try-catch and check the users table creation.
            try {
                const ageRes = await client.query(`
                    SELECT MIN(created_at) as created_at 
                    FROM ${schemaName}.users
                `);

                if (ageRes.rows.length > 0) {
                    const createdAt = new Date(ageRes.rows[0].created_at);
                    const now = new Date();
                    const ageMinutes = (now - createdAt) / 1000 / 60;

                    if (ageMinutes > 30) {
                        console.log(`[Sandbox Cleanup] Dropping expired schema: ${schemaName} (Age: ${Math.round(ageMinutes)}m)`);
                        await client.query(`DROP SCHEMA ${schemaName} CASCADE`);
                    }
                }
            } catch (e) {
                // If the schema is partially broken or empty, drop it anyway
                console.warn(`[Sandbox Cleanup] Error checking age for ${schemaName}, dropping to be safe.`, e.message);
                await client.query(`DROP SCHEMA IF EXISTS ${schemaName} CASCADE`);
            }
        }
    } catch (error) {
        console.error('[Sandbox Cleanup] Failed:', error);
    } finally {
        client.release();
    }
}

// Export the routine to be started in server/index.js
module.exports = { cleanupExpiredSandboxes };
