const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

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
                await client.query(`
                    INSERT INTO ${schemaName}.users (email, password_hash, first_name, last_name, role)
                    VALUES ($1, $2, $3, $4, 'admin')
                `, [adminUser.email, passwordHash, adminUser.firstName, adminUser.lastName]);
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
     * Executes the base clinical schema into a target schema.
     */
    async _runMigrations(client, schemaName) {
        // Set context to this schema for the duration of these queries
        await client.query(`SET search_path TO ${schemaName}, public`);

        // Essential Tables (subset of full clinical schema)
        await client.query(`
            CREATE TABLE users (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                email VARCHAR(255) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                first_name VARCHAR(100) NOT NULL,
                last_name VARCHAR(100) NOT NULL,
                role VARCHAR(50) NOT NULL,
                active BOOLEAN DEFAULT true,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE patients (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                mrn VARCHAR(50) UNIQUE NOT NULL,
                first_name VARCHAR(100) NOT NULL,
                last_name VARCHAR(100) NOT NULL,
                dob DATE NOT NULL,
                sex VARCHAR(10),
                phone VARCHAR(20),
                email VARCHAR(255),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE visits (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                patient_id UUID REFERENCES patients(id),
                provider_id UUID REFERENCES users(id),
                visit_date DATE DEFAULT CURRENT_DATE,
                status VARCHAR(50) DEFAULT 'scheduled',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            -- Reset search path back to public just in case
            SET search_path TO public;
        `);
    }
}

module.exports = new TenantManager();

