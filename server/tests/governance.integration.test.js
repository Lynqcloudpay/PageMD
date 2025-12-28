/**
 * Governance & Control Integration Tests
 * Verifies Phase 1 "Air Traffic Control" Features
 */
const request = require('supertest');
const { Pool } = require('pg');

// 1. Point app to the test database BEFORE requiring it
const TEST_DB_NAME = 'paper_emr'; // Use standard name
process.env.DATABASE_URL = `postgres://postgres:postgres@localhost:5432/${TEST_DB_NAME}`;
process.env.CONTROL_DATABASE_URL = process.env.DATABASE_URL;

const app = require('../index');
const jwt = require('jsonwebtoken');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

const JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key';

describe('Phase 1: Governance & Control Verification', () => {
    let superAdminToken;
    let clinicId;
    let testUserId;
    let clinicSlug = 'test-clinic-gov-' + Date.now();

    beforeAll(async () => {
        // 1. Setup Necessary Tables
        await pool.query(`
      CREATE TABLE IF NOT EXISTS super_admins (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        first_name VARCHAR(100),
        last_name VARCHAR(100),
        role VARCHAR(50),
        is_active BOOLEAN DEFAULT true
      );

      CREATE TABLE IF NOT EXISTS platform_admin_sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        admin_id UUID REFERENCES super_admins(id),
        token TEXT UNIQUE NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS clinics (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        display_name VARCHAR(255) NOT NULL,
        slug VARCHAR(50) UNIQUE NOT NULL,
        schema_name VARCHAR(63) UNIQUE,
        status VARCHAR(50) DEFAULT 'active',
        tenant_type VARCHAR(20) DEFAULT 'Solo',
        emr_version VARCHAR(20) DEFAULT '1.0.0',
        compliance_zones JSONB DEFAULT '[]'::jsonb,
        region VARCHAR(50) DEFAULT 'US',
        go_live_date TIMESTAMP,
        is_read_only BOOLEAN DEFAULT false,
        billing_locked BOOLEAN DEFAULT false,
        prescribing_locked BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS platform_audit_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        action VARCHAR(100) NOT NULL,
        target_clinic_id UUID REFERENCES clinics(id),
        details JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS platform_impersonation_tokens (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        admin_id UUID REFERENCES super_admins(id),
        target_clinic_id UUID REFERENCES clinics(id),
        target_user_id UUID NOT NULL,
        token TEXT UNIQUE NOT NULL,
        reason TEXT NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      -- Add role column if it doesn't exist on users
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='role') THEN
          ALTER TABLE users ADD COLUMN role VARCHAR(50);
        END IF;
      END $$;
    `);

        // 2. Setup Test SuperAdmin Session
        const saResult = await pool.query(`
      INSERT INTO super_admins (email, password_hash, first_name, last_name, role, is_active)
      VALUES ('sa@test.com', 'hash', 'Super', 'Admin', 'admin', true)
      ON CONFLICT (email) DO UPDATE SET is_active = true
      RETURNING id
    `);
        const saId = saResult.rows[0].id;

        superAdminToken = 'test-sa-token-' + Date.now();
        await pool.query(`
      INSERT INTO platform_admin_sessions (admin_id, token, expires_at)
      VALUES ($1, $2, NOW() + INTERVAL '1 hour')
    `, [saId, superAdminToken]);

        // 3. Setup Test Clinic
        const clinicResult = await pool.query(`
      INSERT INTO clinics (display_name, slug, schema_name, status, tenant_type)
      VALUES ('Test Governance Clinic', $1, 'tenant_test_gov', 'active', 'Solo')
      ON CONFLICT (slug) DO UPDATE SET status = 'active'
      RETURNING id
    `, [clinicSlug]);
        clinicId = clinicResult.rows[0].id;

        // 4. Setup Test User
        testUserId = '00000000-0000-0000-0000-000000000001';
        await pool.query(`
      INSERT INTO users (id, email, password_hash, first_name, last_name, status, is_admin, role)
      VALUES ($1, 'user@test.com', 'dummy_hash', 'Test', 'User', 'active', true, 'admin')
      ON CONFLICT (id) DO UPDATE SET status = 'active'
    `, [testUserId]);
    });

    afterAll(async () => {
        await pool.query('DELETE FROM platform_impersonation_tokens WHERE target_clinic_id = $1', [clinicId]);
        await pool.query('DELETE FROM platform_audit_logs WHERE target_clinic_id = $1', [clinicId]);
        await pool.query('DELETE FROM clinics WHERE id = $1', [clinicId]);
        await pool.query('DELETE FROM platform_admin_sessions WHERE token = $1', [superAdminToken]);
        await pool.end();
    });

    describe('1. Clinic Registry & Commercial Controls', () => {
        test('should update clinic controls and log before/after audit', async () => {
            const updateData = {
                tenant_type: 'Group',
                emr_version: '1.2.0-beta',
                compliance_zones: ['HIPAA', 'GDPR']
            };

            const res = await request(app)
                .patch(`/api/super/clinics/${clinicId}/controls`)
                .set('x-platform-token', superAdminToken)
                .send(updateData);

            expect(res.status).toBe(200);
            expect(res.body.tenant_type).toBe('Group');

            // Check Platform Audit Log
            const auditRes = await pool.query(`
        SELECT * FROM platform_audit_logs 
        WHERE target_clinic_id = $1 AND action = 'clinic_controls_updated'
        ORDER BY created_at DESC LIMIT 1
      `, [clinicId]);

            expect(auditRes.rows.length).toBe(1);
            const details = auditRes.rows[0].details;
            expect(details.changes.tenant_type).toBe('Group');
            expect(details.previousState.tenant_type).toBe('Solo');
        });

        test('should reject invalid tenantType enum', async () => {
            const res = await request(app)
                .patch(`/api/super/clinics/${clinicId}/controls`)
                .set('x-platform-token', superAdminToken)
                .send({ tenant_type: 'InvalidType' });

            expect(res.status).toBe(400);
            expect(res.body.error).toMatch(/Invalid tenant type/);
        });
    });

    describe('2. Read-Only Mode Kill Switch', () => {
        test('should block mutation requests when Read-Only is ON', async () => {
            // 1. Enable Read-Only
            await pool.query('UPDATE clinics SET is_read_only = true WHERE id = $1', [clinicId]);

            // 2. Attempt POST
            const res = await request(app)
                .post('/api/patients')
                .set('x-clinic-slug', clinicSlug)
                .set('Authorization', `Bearer ${jwt.sign({ userId: testUserId, clinicSlug }, JWT_SECRET)}`)
                .send({ first_name: 'Test' });

            expect(res.status).toBe(423);
            expect(res.body.code).toBe('TENANT_READ_ONLY');
        });

        test('should allow GET requests even when Read-Only is ON', async () => {
            const res = await request(app)
                .get('/api/patients')
                .set('x-clinic-slug', clinicSlug)
                .set('Authorization', `Bearer ${jwt.sign({ userId: testUserId, clinicSlug }, JWT_SECRET)}`);

            expect(res.status).not.toBe(423);
        });
    });

    describe('3. Financial & Prescribing Locks', () => {
        beforeAll(async () => {
            // Disable read-only mode 
            await pool.query('UPDATE clinics SET is_read_only = false WHERE id = $1', [clinicId]);
        });

        test('should block billing actions when billing_locked is ON', async () => {
            await pool.query('UPDATE clinics SET billing_locked = true WHERE id = $1', [clinicId]);

            const res = await request(app)
                .post('/api/billing/claims')
                .set('x-clinic-slug', clinicSlug)
                .set('Authorization', `Bearer ${jwt.sign({ userId: testUserId, clinicSlug }, JWT_SECRET)}`)
                .send({});

            expect(res.status).toBe(403);
            expect(res.body.code).toBe('BILLING_LOCKED');
        });

        test('should block prescribing actions when prescribing_locked is ON', async () => {
            await pool.query('UPDATE clinics SET prescribing_locked = true WHERE id = $1', [clinicId]);

            const res = await request(app)
                .post('/api/eprescribe/sso')
                .set('x-clinic-slug', clinicSlug)
                .set('Authorization', `Bearer ${jwt.sign({ userId: testUserId, clinicSlug }, JWT_SECRET)}`)
                .send({});

            expect(res.status).toBe(403);
            expect(res.body.code).toBe('PRESCRIBING_LOCKED');
        });
    });

    describe('4. Break Glass Impersonation', () => {
        test('should require reason for impersonation', async () => {
            const res = await request(app)
                .post(`/api/super/clinics/${clinicId}/impersonate`)
                .set('x-platform-token', superAdminToken)
                .send({ userId: testUserId });

            expect(res.status).toBe(400);
            expect(res.body.error).toMatch(/reason is required/);
        });

        test('should create token and log initiation', async () => {
            const res = await request(app)
                .post(`/api/super/clinics/${clinicId}/impersonate`)
                .set('x-platform-token', superAdminToken)
                .send({ userId: testUserId, reason: 'Testing Impersonation' });

            expect(res.status).toBe(200);
            expect(res.body.token).toBeDefined();
        });

        test('should reject impersonating another platform admin', async () => {
            const otherAdminRes = await pool.query(`
        INSERT INTO super_admins (email, password_hash, first_name, last_name, role, is_active)
        VALUES ('other@test.com', 'hash', 'Other', 'Admin', 'admin', true)
        ON CONFLICT (email) DO UPDATE SET is_active = true
        RETURNING id
      `);
            const otherAdminId = otherAdminRes.rows[0].id;

            const res = await request(app)
                .post(`/api/super/clinics/${clinicId}/impersonate`)
                .set('x-platform-token', superAdminToken)
                .send({ userId: otherAdminId, reason: 'Should fail' });

            expect(res.status).toBe(403);
            expect(res.body.error).toMatch(/Cannot impersonate another Platform Administrator/);
        });
    });
});
