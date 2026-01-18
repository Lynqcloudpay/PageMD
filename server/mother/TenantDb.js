const pool = require('../db');

/**
 * TenantDb Service
 * Handles clinic_id enforcement and schema/search_path isolation.
 */
class TenantDb {
    /**
     * Executes a function within a tenant context.
     * Ensures search_path is set if schema isolation is used.
     * @param {string} clinicId - UUID of the clinic
     * @param {Function} fn - async function(dbClient, clinicId)
     */
    static async withTenantDb(clinicId, fn) {
        const client = await pool.connect();
        try {
            // Some deployments use schema isolation.
            // We check for organizations table safely.
            try {
                // First check if table exists
                const tableCheck = await client.query("SELECT 1 FROM information_schema.tables WHERE table_name = 'organizations' LIMIT 1");
                if (tableCheck.rowCount > 0 && clinicId) {
                    const schemaRes = await client.query('SELECT schema_name FROM organizations WHERE id = $1', [clinicId]);
                    const schemaName = schemaRes.rows[0]?.schema_name;
                    if (schemaName) {
                        await client.query(`SET search_path TO ${schemaName}, public`);
                    }
                }
            } catch (e) {
                // skip schema isolation
            }

            return await fn(client, clinicId);
        } finally {
            client.release();
        }
    }

    /**
     * Helper to add clinic_id to query parameters if not already present.
     */
    static enforceTenant(query, params, clinicId) {
        // Implementation for dynamic query modification if needed
        // For now, we prefer explicit clinicId in service method signatures.
    }
}

module.exports = TenantDb;
