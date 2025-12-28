// 1. Set Env Vars BEFORE requires
const TEST_DB_NAME = 'paper_emr';
process.env.DATABASE_URL = `postgres://postgres:postgres@localhost:5432/${TEST_DB_NAME}`;
process.env.CONTROL_DATABASE_URL = process.env.DATABASE_URL;

const { Pool } = require('pg');
// Now require services, they will pick up the env vars for their internal db require
const AuditService = require('../services/auditService');
const governanceService = require('../services/governanceService');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 20
});

describe('Phase 3: Source Template Linkage & Audit Hashing', () => {
    let clinicId;
    let schemaName = 'tenant_p3_test_' + Date.now();
    let templateId;

    beforeAll(async () => {
        // Cleanup potential leftovers
        await pool.query('DELETE FROM platform_role_template_privileges');
        await pool.query('DELETE FROM platform_role_templates');
        await pool.query('DROP TABLE IF EXISTS platform_audit_logs CASCADE'); // Force drop to ensure new schema

        // 1. Setup Control Tables
        await pool.query(`
            CREATE TABLE IF NOT EXISTS platform_role_templates (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                role_key VARCHAR(50) UNIQUE NOT NULL,
                display_name VARCHAR(100) NOT NULL,
                version INT DEFAULT 1,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            
            CREATE TABLE IF NOT EXISTS platform_role_template_privileges (
                template_id UUID REFERENCES platform_role_templates(id),
                privilege_name VARCHAR(100) NOT NULL,
                PRIMARY KEY (template_id, privilege_name)
            );

            CREATE TABLE IF NOT EXISTS clinics (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                display_name VARCHAR(255),
                slug VARCHAR(50) UNIQUE,
                schema_name VARCHAR(63) UNIQUE,
                status VARCHAR(50) DEFAULT 'active'
            );

            -- Audit Logs with Phase 3 Columns
            CREATE TABLE platform_audit_logs (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                action VARCHAR(100) NOT NULL,
                target_clinic_id UUID,
                details JSONB,
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                hash VARCHAR(64),
                previous_hash VARCHAR(64)
            );
        `);

        // 2. Setup Tenant Schema & Tables
        await pool.query(`CREATE SCHEMA IF NOT EXISTS ${schemaName}`);
        await pool.query(`
            CREATE TABLE IF NOT EXISTS ${schemaName}.roles (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                name VARCHAR(100) NOT NULL,
                description TEXT,
                is_system_role BOOLEAN DEFAULT false,
                source_template_id UUID -- Phase 3 Linkage
            );

            CREATE TABLE IF NOT EXISTS ${schemaName}.privileges (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                name VARCHAR(100) UNIQUE NOT NULL,
                category VARCHAR(50)
            );

            CREATE TABLE IF NOT EXISTS ${schemaName}.role_privileges (
                role_id UUID REFERENCES ${schemaName}.roles(id),
                privilege_id UUID REFERENCES ${schemaName}.privileges(id)
            );
        `);

        // 3. Insert Test Clinic
        const cRes = await pool.query(`
            INSERT INTO clinics (display_name, slug, schema_name)
            VALUES ('Phase 3 Test', '${schemaName}', '${schemaName}')
            RETURNING id
        `);
        clinicId = cRes.rows[0].id;
    });

    afterAll(async () => {
        // Cleanup
        await pool.query(`DROP SCHEMA IF EXISTS ${schemaName} CASCADE`);
        await pool.query('DELETE FROM clinics WHERE id = $1', [clinicId]);
        await pool.query('DELETE FROM platform_role_templates');
        await pool.query('DELETE FROM platform_audit_logs');
        await pool.end();
    });

    describe('Source Template Linkage', () => {
        test('should prefer link ID over name when detecting drift', async () => {
            // 1. Create Global Template
            const tRes = await pool.query(`
                INSERT INTO platform_role_templates (role_key, display_name)
                VALUES ('PHYSICIAN', 'Physician')
                RETURNING id
            `);
            templateId = tRes.rows[0].id;

            await pool.query(`
                INSERT INTO platform_role_template_privileges (template_id, privilege_name)
                VALUES ($1, 'notes:sign'), ($1, 'prescriptions:create')
            `, [templateId]);

            // 2. Create Tenant Role (Renamed but Linked)
            // Name is 'Doctor', but source_template_id points to 'PHYSICIAN'
            const rRes = await pool.query(`
                INSERT INTO ${schemaName}.roles (name, source_template_id)
                VALUES ('Doctor', $1)
                RETURNING id
            `, [templateId]);
            const roleId = rRes.rows[0].id;

            // Give it matching privileges
            const pRes = await pool.query(`
                INSERT INTO ${schemaName}.privileges (name) VALUES ('notes:sign'), ('prescriptions:create')
                ON CONFLICT DO NOTHING
                RETURNING id
            `);
            // (Assuming privileges might exist, fetch ids)
            const pIds = await pool.query(`SELECT id FROM ${schemaName}.privileges WHERE name IN ('notes:sign', 'prescriptions:create')`);

            for (const p of pIds.rows) {
                await pool.query(`INSERT INTO ${schemaName}.role_privileges (role_id, privilege_id) VALUES ($1, $2)`, [roleId, p.id]);
            }

            // 3. Detect Drift
            const report = await governanceService.detectDrift(clinicId);

            // 4. Assertions
            const physicianReport = report.find(r => r.roleKey === 'PHYSICIAN');

            if (physicianReport.status !== 'SYNCED') {
                console.log('Drift Report Debug:', JSON.stringify(physicianReport, null, 2));
            }

            expect(physicianReport).toBeDefined();
            expect(physicianReport.isLinked).toBe(true);
            expect(physicianReport.status).toBe('SYNCED'); // Should match despite name difference
        });
    });

    describe('Audit Hashing Concurrency', () => {
        test('should maintain chain integrity under parallel load', async () => {
            const iterations = 10;
            const promises = [];

            // 1. Fire parallel requests
            for (let i = 0; i < iterations; i++) {
                promises.push(AuditService.log(null, 'concurrent_action', clinicId, { index: i }));
            }

            const results = await Promise.all(promises);
            expect(results.length).toBe(iterations);

            // 2. Verify Chain
            const verification = await AuditService.verifyChain();

            if (!verification.valid) {
                console.error('Audit Verification Errors:', verification.errors);
            }

            expect(verification.valid).toBe(true);
            expect(verification.count).toBeGreaterThanOrEqual(iterations);
        }, 10000); // 10s timeout

        test('verifier should detect tamper', async () => {
            // 1. Create a log
            const logRes = await AuditService.log(null, 'tamper_target', clinicId, { sensitive: true });

            // 2. Direct DB Tamper
            await pool.query(`
                UPDATE platform_audit_logs 
                SET details = '{"hacked": true}' 
                WHERE id = $1
            `, [logRes.id]);

            // 3. Verify
            const verification = await AuditService.verifyChain();
            expect(verification.valid).toBe(false);
            expect(verification.errors[0]).toMatch(/Integrity Failure/);
        });
    });
});
