const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const tenantSchemaSQL = require('../config/tenantSchema');

// The Control Pool connects to the main platform database
const controlPool = new Pool({
    connectionString: process.env.CONTROL_DATABASE_URL || process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

/**
 * TenantManager handles dynamic database routing and provisioning.
 * Follows "Option B": Schema-per-Clinic Architecture.
 */
class TenantManager {
    /**
     * Sanitizes a slug into a safe PostgreSQL schema name.
     * Pattern: tenant_slug_with_underscores
     */
    getSchemaName(slug) {
        const sanitized = slug.toLowerCase().replace(/[^a-z0-9]/g, '_');
        const schemaName = `tenant_${sanitized}`;

        // Strict Validation: ^tenant_[a-z0-9_]{3,50}$
        if (!/^tenant_[a-z0-9_]{3,50}$/.test(schemaName)) {
            throw new Error(`Invalid schema name generated: ${schemaName}`);
        }
        return schemaName;
    }

    /**
     * Provision a new clinic.
     * 1. Create schema
     * 2. Run migrations in that schema
     * 3. Seed initial admin user
     * 4. Update control_db
     */
    async provisionClinic(clinicData, dbConfig, adminUser) {
        const schemaName = this.getSchemaName(clinicData.slug);
        const client = await controlPool.connect();

        try {
            await client.query('BEGIN');

            // 1. Check if clinic exists
            const existing = await client.query('SELECT id FROM clinics WHERE slug = $1 OR schema_name = $2', [clinicData.slug, schemaName]);
            if (existing.rows.length > 0) {
                throw new Error('Clinic with this slug or schema name already exists');
            }

            // 2. Create the Clinic record in control_db
            const clinicRes = await client.query(
                `INSERT INTO clinics (slug, schema_name, display_name, specialty, status) 
                 VALUES ($1, $2, $3, $4, 'active') RETURNING id`,
                [clinicData.slug, schemaName, clinicData.displayName, clinicData.specialty]
            );
            const clinicId = clinicRes.rows[0].id;

            // 3. Create the Physical Schema
            // Note: Schema names are identifiers, not values, so we must be careful with interpolation.
            // Since we validated schemaName strictly above, this is safe.
            await client.query(`CREATE SCHEMA ${schemaName}`);

            // 4. Run Core Migrations into the new schema
            await this._runMigrations(client, schemaName);

            // 5. Create Initial Admin User in the new schema
            if (adminUser && adminUser.email) {
                const passwordHash = await bcrypt.hash(adminUser.password, 10);

                // Get the admin role_id we just created in this schema
                const roleRes = await client.query(`SELECT id FROM ${schemaName}.roles WHERE name = 'admin'`);
                const roleId = roleRes.rows[0]?.id;

                await client.query(`
                    INSERT INTO ${schemaName}.users (email, password_hash, first_name, last_name, role, role_id, is_admin, status)
                    VALUES ($1, $2, $3, $4, 'admin', $5, true, 'active')
                `, [adminUser.email, passwordHash, adminUser.firstName, adminUser.lastName, roleId]);

                // 5b. Add to Global User Lookup (for recognition by email)
                await client.query(`
                    INSERT INTO platform_user_lookup (email, clinic_id, schema_name)
                    VALUES ($1, $2, $3)
                    ON CONFLICT (email) DO UPDATE SET 
                        clinic_id = EXCLUDED.clinic_id,
                        schema_name = EXCLUDED.schema_name
                `, [adminUser.email, clinicId, schemaName]);
            }

            // 6. Initialize Settings in control_db
            await client.query(
                `INSERT INTO clinic_settings (clinic_id) VALUES ($1)`,
                [clinicId]
            );

            await client.query('COMMIT');
            return clinicId;

        } catch (error) {
            await client.query('ROLLBACK');
            console.error('[TenantManager] Provisioning failed:', error);
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Executes the complete clinical schema into a target schema.
     * This ensures all new clinics have the full EMR database structure.
     */
    async _runMigrations(client, schemaName) {
        console.log(`[TenantManager] Running complete schema migration for ${schemaName}...`);

        // Set context to this schema for the duration of these queries
        await client.query(`SET search_path TO ${schemaName}, public`);

        // Execute the complete tenant schema SQL
        await client.query(tenantSchemaSQL);

        // Reset search path back to public
        await client.query('SET search_path TO public');

        console.log(`[TenantManager] Schema migration completed for ${schemaName}`);
    }

    /**
     * Deprovision a clinic (Delete everything)
     */
    async deprovisionClinic(clinicId) {
        const client = await controlPool.connect();
        try {
            await client.query('BEGIN');

            // 1. Get schema name
            const result = await client.query('SELECT schema_name, slug FROM clinics WHERE id = $1', [clinicId]);
            if (result.rows.length === 0) {
                throw new Error('Clinic not found');
            }

            const { schema_name, slug } = result.rows[0];

            // 2. Drop the Physical Schema
            // Security: schema_name is stored in our trusted control_db and validated on creation.
            if (schema_name && schema_name.startsWith('tenant_')) {
                await client.query(`DROP SCHEMA IF EXISTS ${schema_name} CASCADE`);
            }

            // 2b. Clean up Global User Lookup
            await client.query('DELETE FROM platform_user_lookup WHERE clinic_id = $1', [clinicId]);

            // Explicitly delete related records that might otherwise be SET NULL
            await client.query('DELETE FROM payment_history WHERE clinic_id = $1', [clinicId]);
            await client.query('DELETE FROM support_tickets WHERE clinic_id = $1', [clinicId]);

            // 3. Delete Clinic Record
            await client.query('DELETE FROM clinics WHERE id = $1', [clinicId]);

            // 4. Log the action
            await client.query(`
                INSERT INTO platform_audit_logs (action, details)
                VALUES ($1, $2)
            `, ['clinic_deleted', JSON.stringify({ clinicId, slug, schema_name })]);

            await client.query('COMMIT');
            return true;
        } catch (error) {
            await client.query('ROLLBACK');
            console.error('[TenantManager] Deprovisioning failed:', error);
            throw error;
        } finally {
            client.release();
        }
    }
}

module.exports = new TenantManager();
