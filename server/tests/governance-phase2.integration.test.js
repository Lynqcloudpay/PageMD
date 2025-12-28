const request = require('supertest');
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');

// 1. Point app to the test database BEFORE requiring it
const TEST_DB_NAME = 'paper_emr';
process.env.DATABASE_URL = `postgres://postgres:postgres@localhost:5432/${TEST_DB_NAME}`;
process.env.CONTROL_DATABASE_URL = process.env.DATABASE_URL;

const app = require('../index');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

describe('Phase 2: Role Governance & Permission Integrity', () => {
    let superAdminToken;
    let clinicId;
    let clinicSlug = 'gov-p2-test-' + Date.now();
    let schemaName = 'tenant_gov_p2_' + Date.now();

    beforeAll(async () => {
        // Setup SuperAdmin
        const saResult = await pool.query(`
            INSERT INTO super_admins (email, password_hash, first_name, last_name, role, is_active)
            VALUES ($1, 'hash', 'Gov', 'Tester', 'admin', true)
            ON CONFLICT (email) DO UPDATE SET is_active = true
            RETURNING id
        `, [`sa-p2-${Date.now()}@test.com`]);
        const saId = saResult.rows[0].id;

        superAdminToken = 'token-p2-' + Date.now();
        await pool.query(`
            INSERT INTO platform_admin_sessions (admin_id, token, expires_at)
            VALUES ($1, $2, NOW() + INTERVAL '1 hour')
        `, [saId, superAdminToken]);

        // Setup Clinic
        const clinicRes = await pool.query(`
            INSERT INTO clinics (display_name, slug, schema_name, status)
            VALUES ('Gov P2 Clinic', $1, $2, 'active')
            RETURNING id
        `, [clinicSlug, schemaName]);
        clinicId = clinicRes.rows[0].id;

        // Create Tenant Schema and Tables
        await pool.query(`CREATE SCHEMA IF NOT EXISTS ${schemaName}`);
        await pool.query(`
            CREATE TABLE IF NOT EXISTS ${schemaName}.roles (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                name VARCHAR(100) UNIQUE NOT NULL,
                description TEXT,
                is_system_role BOOLEAN DEFAULT false
            );
            CREATE TABLE IF NOT EXISTS ${schemaName}.privileges (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                name VARCHAR(100) UNIQUE NOT NULL,
                description TEXT,
                category VARCHAR(50)
            );
            CREATE TABLE IF NOT EXISTS ${schemaName}.role_privileges (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                role_id UUID REFERENCES ${schemaName}.roles(id) ON DELETE CASCADE,
                privilege_id UUID REFERENCES ${schemaName}.privileges(id) ON DELETE CASCADE,
                UNIQUE(role_id, privilege_id)
            );
            CREATE TABLE IF NOT EXISTS ${schemaName}.users (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                email VARCHAR(255) UNIQUE NOT NULL,
                role_id UUID REFERENCES ${schemaName}.roles(id)
            );
        `);
    });

    afterAll(async () => {
        try {
            await pool.query('DELETE FROM platform_audit_logs WHERE target_clinic_id = $1', [clinicId]);
            await pool.query('DELETE FROM platform_admin_sessions WHERE token = $1', [superAdminToken]);
            await pool.query('DELETE FROM clinics WHERE id = $1', [clinicId]);
            await pool.query(`DROP SCHEMA IF EXISTS ${schemaName} CASCADE`);
        } catch (e) {
            console.error('Cleanup failed:', e.message);
        } finally {
            await pool.end();
        }
    });

    describe('1. Global Role Templates API', () => {
        test('should list templates with privilege sets', async () => {
            const res = await request(app)
                .get('/api/super/governance/roles')
                .set('x-platform-token', superAdminToken);

            expect(res.status).toBe(200);
            expect(Array.isArray(res.body)).toBe(true);
            const physician = res.body.find(t => t.role_key === 'PHYSICIAN');
            expect(physician).toBeDefined();
            expect(Array.isArray(physician.privilege_set)).toBe(true);
            expect(physician.privilege_set).toContain('meds:prescribe');
        });
    });

    describe('2. Drift Detection', () => {
        test('should report MISSING for non-existent roles', async () => {
            const res = await request(app)
                .get(`/api/super/clinics/${clinicId}/governance/drift`)
                .set('x-platform-token', superAdminToken);

            expect(res.status).toBe(200);
            const physicianReport = res.body.drift.find(d => d.roleKey === 'PHYSICIAN');
            expect(physicianReport.status).toBe('MISSING');
            expect(physicianReport.missingPrivileges.length).toBeGreaterThan(0);
        });

        test('should report DRIFTED for roles with missing or extra privileges', async () => {
            // 1. Create a drifted role
            const roleRes = await pool.query(`INSERT INTO ${schemaName}.roles (name) VALUES ('PHYSICIAN') RETURNING id`);
            const roleId = roleRes.rows[0].id;

            const privRes = await pool.query(`INSERT INTO ${schemaName}.privileges (name) VALUES ('extra:priv'), ('patients:view_list') RETURNING id, name`);
            const extraPrivId = privRes.rows.find(p => p.name === 'extra:priv').id;
            const validPrivId = privRes.rows.find(p => p.name === 'patients:view_list').id;

            await pool.query(`INSERT INTO ${schemaName}.role_privileges (role_id, privilege_id) VALUES ($1, $2), ($1, $3)`, [roleId, extraPrivId, validPrivId]);

            const res = await request(app)
                .get(`/api/super/clinics/${clinicId}/governance/drift`)
                .set('x-platform-token', superAdminToken);

            const physicianReport = res.body.drift.find(d => d.roleKey === 'PHYSICIAN');
            expect(physicianReport.status).toBe('DRIFTED');
            expect(physicianReport.extraPrivileges).toContain('extra:priv');
            expect(physicianReport.missingPrivileges).toContain('meds:prescribe');
        });

        test('should detect Unknown Privileges not in canonical catalog', async () => {
            const res = await request(app)
                .get(`/api/super/clinics/${clinicId}/governance/drift`)
                .set('x-platform-token', superAdminToken);

            const physicianReport = res.body.drift.find(d => d.roleKey === 'PHYSICIAN');
            expect(physicianReport.unknownPrivileges).toContain('extra:priv');
        });
    });

    describe('3. Force Sync Remediation', () => {
        test('should repair a drifted role and preserve user assignments', async () => {
            // 1. Assign a test user to the role
            const userRes = await pool.query(`INSERT INTO ${schemaName}.users (email, role_id) VALUES ('physician@clinic.com', (SELECT id FROM ${schemaName}.roles WHERE name = 'PHYSICIAN')) RETURNING id`);
            const userId = userRes.rows[0].id;

            // 2. Trigger Sync
            const res = await request(app)
                .post(`/api/super/clinics/${clinicId}/governance/sync`)
                .set('x-platform-token', superAdminToken)
                .send({ roleKey: 'PHYSICIAN' });

            expect(res.status).toBe(200);

            // 3. Verify Sync Status
            const driftRes = await request(app)
                .get(`/api/super/clinics/${clinicId}/governance/drift`)
                .set('x-platform-token', superAdminToken);

            const physicianReport = driftRes.body.drift.find(d => d.roleKey === 'PHYSICIAN');
            expect(physicianReport.status).toBe('SYNCED');
            expect(physicianReport.missingPrivileges.length).toBe(0);
            expect(physicianReport.extraPrivileges.length).toBe(0);

            // 4. Verify user assignment remains
            const checkUser = await pool.query(`SELECT role_id FROM ${schemaName}.users WHERE id = $1`, [userId]);
            expect(checkUser.rows[0].role_id).toBeDefined();
        });

        test('should create role if missing and sync', async () => {
            const res = await request(app)
                .post(`/api/super/clinics/${clinicId}/governance/sync`)
                .set('x-platform-token', superAdminToken)
                .send({ roleKey: 'FRONT_DESK' });

            expect(res.status).toBe(200);

            const checkRole = await pool.query(`SELECT id FROM ${schemaName}.roles WHERE name = 'FRONT_DESK'`);
            expect(checkRole.rows.length).toBe(1);
        });

        test('should be idempotent: syncing twice yields same results', async () => {
            const res1 = await request(app)
                .post(`/api/super/clinics/${clinicId}/governance/sync`)
                .set('x-platform-token', superAdminToken)
                .send({ roleKey: 'FRONT_DESK' });

            const res2 = await request(app)
                .post(`/api/super/clinics/${clinicId}/governance/sync`)
                .set('x-platform-token', superAdminToken)
                .send({ roleKey: 'FRONT_DESK' });

            expect(res1.status).toBe(200);
            expect(res2.status).toBe(200);
        });

        test('should log ROLE_FORCE_SYNC in platform audit', async () => {
            const auditRes = await pool.query(`
                SELECT * FROM platform_audit_logs 
                WHERE action = 'ROLE_FORCE_SYNC' AND target_clinic_id = $1
                ORDER BY created_at DESC LIMIT 1
            `, [clinicId]);

            expect(auditRes.rows.length).toBe(1);
            expect(auditRes.rows[0].details.roleKey).toBe('FRONT_DESK');
        });

        test('should prevent concurrent syncs for same clinic', async () => {
            // We use a manual client to hold a lock
            const client = await pool.connect();
            await client.query('BEGIN');

            // Generate the same lock key as the service
            const hashStringToInt = (str) => {
                let hash = 0;
                for (let i = 0; i < str.length; i++) {
                    const char = str.charCodeAt(i);
                    hash = ((hash << 5) - hash) + char;
                    hash = hash & hash;
                }
                return Math.abs(hash);
            };

            await client.query('SELECT pg_advisory_xact_lock($1)', [hashStringToInt(clinicId)]);

            // Attempt sync via API (should fail with 429)
            const res = await request(app)
                .post(`/api/super/clinics/${clinicId}/governance/sync`)
                .set('x-platform-token', superAdminToken)
                .send({ roleKey: 'PHYSICIAN' });

            expect(res.status).toBe(429);
            expect(res.body.error).toMatch(/Sync in progress/);

            await client.query('ROLLBACK');
            client.release();
        });
    });

    describe('4. Security & Safety', () => {
        test('should fail if x-platform-token is missing', async () => {
            const res = await request(app)
                .get(`/api/super/clinics/${clinicId}/governance/drift`);
            expect(res.status).toBe(401);
        });

        test('should fail if x-platform-token is invalid', async () => {
            const res = await request(app)
                .get(`/api/super/clinics/${clinicId}/governance/drift`)
                .set('x-platform-token', 'invalid');
            expect(res.status).toBe(401);
        });
    });
});
