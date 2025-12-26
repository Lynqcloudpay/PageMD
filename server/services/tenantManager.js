const { Pool } = require('pg');
const crypto = require('crypto');

// The Control Pool connects to the main platform database
const controlPool = new Pool({
    connectionString: process.env.CONTROL_DATABASE_URL || process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

const poolCache = new Map();

/**
 * TenantManager handles dynamic database routing for multi-tenancy.
 * Follows Option A (Physical Isolation): One Database Per Clinic.
 */
class TenantManager {
    /**
     * Resolves a clinic by its slug and returns its dedicated database pool.
     * Caches pools to avoid redundant connection setup.
     */
    async getTenantPool(slug) {
        if (!slug) return null;

        // Check cache first
        if (poolCache.has(slug)) {
            return poolCache.get(slug);
        }

        try {
            // Query control database for clinic connection info
            const query = `
        SELECT c.*, conn.* 
        FROM clinics c
        JOIN clinic_db_connections conn ON c.id = conn.clinic_id
        WHERE c.slug = $1 AND c.status = 'active'
      `;
            const { rows } = await controlPool.query(query, [slug]);

            if (rows.length === 0) {
                console.warn(`Tenant not found or inactive: ${slug}`);
                return null;
            }

            const tenantInfo = rows[0];

            // Decrypt password (Placeholder for actual encryption logic)
            // In production, use ENCRYPTION_KEY or KMS to decrypt rows[0].db_password_encrypted
            const dbPassword = this._decryptPassword(tenantInfo.db_password_encrypted);

            // Create a new pool for this tenant
            const tenantPool = new Pool({
                host: tenantInfo.host,
                port: tenantInfo.port,
                database: tenantInfo.db_name,
                user: tenantInfo.db_user,
                password: dbPassword,
                ssl: tenantInfo.ssl_mode === 'require' ? { rejectUnauthorized: false } : false,
                max: 10,
                idleTimeoutMillis: 30000,
            });

            // Attach tenant metadata to the pool for convenience
            tenantPool.clinicInfo = {
                id: tenantInfo.clinic_id,
                slug: tenantInfo.slug,
                name: tenantInfo.display_name,
                logo: tenantInfo.logo_url,
                specialty: tenantInfo.specialty
            };

            // Store in cache
            poolCache.set(slug, tenantPool);
            return tenantPool;

        } catch (error) {
            console.error(`Error resolving tenant pool for ${slug}:`, error);
            throw error;
        }
    }

    /**
     * Provision a new clinic database.
     * This is a Super Admin action.
     */
    async provisionClinic(clinicData, dbConfig) {
        const client = await controlPool.connect();
        try {
            await client.query('BEGIN');

            // 1. Create clinic record
            const clinicRes = await client.query(
                `INSERT INTO clinics (slug, display_name, specialty, status) 
         VALUES ($1, $2, $3, 'active') RETURNING id`,
                [clinicData.slug, clinicData.displayName, clinicData.specialty]
            );
            const clinicId = clinicRes.rows[0].id;

            // 2. Encrypt password
            const encryptedPassword = this._encryptPassword(dbConfig.password);

            // 3. Store connection details
            await client.query(
                `INSERT INTO clinic_db_connections (clinic_id, host, port, db_name, db_user, db_password_encrypted)
         VALUES ($1, $2, $3, $4, $5, $6)`,
                [clinicId, dbConfig.host, dbConfig.port, dbConfig.dbName, dbConfig.dbUser, encryptedPassword]
            );

            // 4. Initialize default settings
            await client.query(
                `INSERT INTO clinic_settings (clinic_id) VALUES ($1)`,
                [clinicId]
            );

            await client.query('COMMIT');

            // Note: Actual DB creation (CREATE DATABASE ...) usually requires a superuser connection
            // and should be handled by a dedicated infrastructure script or a separate service.

            return clinicId;
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    _encryptPassword(password) {
        // SECURITY NOTE: This is a placeholder. 
        // In production, use the encryptionService.js or a proper KMS.
        return Buffer.from(password).toString('base64');
    }

    _decryptPassword(encrypted) {
        // SECURITY NOTE: This is a placeholder.
        return Buffer.from(encrypted, 'base64').toString('ascii');
    }
}

module.exports = new TenantManager();
