/**
 * Patient Portal Integration Tests
 * 
 * Verifies the end-to-end flow:
 * 1. Staff invites patient
 * 2. Patient redeems invitation (Registration)
 * 3. Patient logs in
 * 4. Patient accesses chart data
 * 5. Patient sends message
 * 6. Patient requests appointment
 */

const request = require('supertest');
const app = require('../index');
const { Pool } = require('pg');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'paper_emr',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
});

const TEST_SCHEMA = 'test_portal_schema';
const JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

describe('Patient Portal Integration', () => {
    let testPatientId;
    let inviteToken;
    let portalAccessToken;
    let testStaffToken;
    let testStaffId;

    beforeAll(async () => {
        process.env.PATIENT_PORTAL_ENABLED = 'true';

        // 1. Setup Test Schema
        await pool.query(`CREATE SCHEMA IF NOT EXISTS ${TEST_SCHEMA}`);
        await pool.query(`SET search_path TO ${TEST_SCHEMA}, public`);

        // Run migrations on test schema (simplified for test)
        const fs = require('fs');
        const tenantSchema = fs.readFileSync('./config/tenantSchema.js', 'utf8')
            .match(/const tenantSchemaSQL = `([\s\S]+?)`;/)[1];
        await pool.query(tenantSchema);

        // 2. Setup Test Data
        // Create a clinic in control DB (public)
        await pool.query('SET search_path TO public');
        await pool.query(`
            INSERT INTO clinics (display_name, slug, schema_name) 
            VALUES ($1, $2, $3) 
            ON CONFLICT (slug) DO UPDATE SET schema_name = $3
        `, ['Test Clinic', 'test-clinic', TEST_SCHEMA]);

        // Create a staff user
        await pool.query(`SET search_path TO ${TEST_SCHEMA}`);
        const staffResult = await pool.query(`
            INSERT INTO users (email, password_hash, first_name, last_name, role_id, status)
            VALUES ($1, $2, $3, $4, $5, 'active')
            RETURNING id
        `, ['staff@test.com', 'hashed', 'Staff', 'User', null]);
        testStaffId = staffResult.rows[0].id;
        testStaffToken = jwt.sign({ userId: testStaffId, clinicSlug: 'test-clinic' }, JWT_SECRET);

        // Create a patient
        const patientResult = await pool.query(`
            INSERT INTO patients (mrn, first_name, last_name, dob, email)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING id
        `, ['PTEST001', 'John', 'Portal', '1985-05-05', 'john@portal.com']);
        testPatientId = patientResult.rows[0].id;
    });

    afterAll(async () => {
        await pool.query(`SET search_path TO public`);
        await pool.query(`DELETE FROM platform_patient_lookup WHERE email = $1`, ['john@portal.com']);
        await pool.query(`DELETE FROM clinics WHERE slug = $1`, ['test-clinic']);
        await pool.query(`DROP SCHEMA IF EXISTS ${TEST_SCHEMA} CASCADE`);
        await pool.end();
    });

    test('Step 1: Staff invites patient', async () => {
        const res = await request(app)
            .post(`/api/patients/${testPatientId}/portal-invite`)
            .set('Authorization', `Bearer ${testStaffToken}`)
            .set('X-Clinic-Slug', 'test-clinic')
            .send({ email: 'john@portal.com' });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.inviteLink).toBeDefined();

        // Extract token from link
        inviteToken = res.body.inviteLink.split('token=')[1];
    });

    test('Step 2: Patient verifies invitation', async () => {
        const res = await request(app)
            .get(`/api/portal/auth/invite/${inviteToken}`)
            .set('X-Clinic-Slug', 'test-clinic');

        expect(res.status).toBe(200);
        expect(res.body.email).toBe('john@portal.com');
        expect(res.body.patientName).toBe('John Portal');
    });

    test('Step 3: Patient registers (Redeem)', async () => {
        const res = await request(app)
            .post('/api/portal/auth/register')
            .set('X-Clinic-Slug', 'test-clinic')
            .send({
                token: inviteToken,
                password: 'StrongPassword123!'
            });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
    });

    test('Step 4: Patient logs in', async () => {
        const res = await request(app)
            .post('/api/portal/auth/login')
            .set('X-Clinic-Slug', 'test-clinic')
            .send({
                email: 'john@portal.com',
                password: 'StrongPassword123!'
            });

        expect(res.status).toBe(200);
        expect(res.body.token).toBeDefined();
        expect(res.body.patient.id).toBe(testPatientId);
        portalAccessToken = res.body.token;
    });

    test('Step 5: Patient accesses clinical data', async () => {
        const res = await request(app)
            .get('/api/portal/chart/me')
            .set('Authorization', `Bearer ${portalAccessToken}`)
            .set('X-Clinic-Slug', 'test-clinic');

        expect(res.status).toBe(200);
        expect(res.body.first_name).toBe('John');
    });

    test('Step 6: Patient sends a message', async () => {
        const res = await request(app)
            .post('/api/portal/messages/threads')
            .set('Authorization', `Bearer ${portalAccessToken}`)
            .set('X-Clinic-Slug', 'test-clinic')
            .send({
                subject: 'Hello Clinic',
                body: 'This is a test message from the portal.'
            });

        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);
        expect(res.body.threadId).toBeDefined();
    });

    test('Step 7: Patient requests an appointment', async () => {
        const res = await request(app)
            .post('/api/portal/appointments/requests')
            .set('Authorization', `Bearer ${portalAccessToken}`)
            .set('X-Clinic-Slug', 'test-clinic')
            .send({
                preferredDate: '2026-02-01',
                preferredTimeRange: 'morning',
                appointmentType: 'Follow-up',
                reason: 'Check my vitals'
            });

        expect(res.status).toBe(201);
        expect(res.body.status).toBe('pending');
    });

    test('Security: Patient cannot access staff APIs', async () => {
        const res = await request(app)
            .get('/api/users')
            .set('Authorization', `Bearer ${portalAccessToken}`)
            .set('X-Clinic-Slug', 'test-clinic');

        expect([401, 403]).toContain(res.status);
    });
});
