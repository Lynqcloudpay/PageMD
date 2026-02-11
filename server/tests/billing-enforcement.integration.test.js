/**
 * Billing Enforcement Integration Tests
 * 
 * Verifies that:
 * 1. Clinics with expired trials and no subscription are blocked from mutable actions (402).
 * 2. Clinics with active subscriptions are allowed.
 * 3. Sandboxes are exempt from billing blocks.
 * 4. GET requests are allowed even with expired trials.
 */

const request = require('supertest');
const app = require('../index');
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');

const pool = process.env.DATABASE_URL
    ? new Pool({ connectionString: process.env.DATABASE_URL })
    : new Pool({
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        database: process.env.DB_NAME || 'paper_emr',
        user: process.env.DB_USER || 'mjrodriguez',
    });

const TEST_SCHEMA = 'test_billing_enforcement';
const JWT_SECRET = process.env.JWT_SECRET || 'CHANGE_ME_GENERATE_STRONG_RANDOM_SECRET_64_CHARS_MIN'; // Match .env

const fs = require('fs');

describe('Billing Enforcement Integration', () => {
    let testStaffToken;
    let testStaffId;
    let clinicId;

    beforeAll(async () => {
        // 1. Setup Test Schema
        await pool.query(`CREATE SCHEMA IF NOT EXISTS ${TEST_SCHEMA}`);
        await pool.query(`SET search_path TO ${TEST_SCHEMA}, public`);

        // Run full migrations
        const schemaPath = '/Volumes/Mel\'s SSD/paper emr/server/config/tenantSchema.js';
        const schemaContent = fs.readFileSync(schemaPath, 'utf8');
        const sqlMatch = schemaContent.match(/const tenantSchemaSQL = `([\s\S]+?)`;/);
        if (sqlMatch) {
            await pool.query(sqlMatch[1]);
        }

        // 2. Setup Clinic in Control DB
        await pool.query('SET search_path TO public');
        const res = await pool.query(`
            INSERT INTO clinics (display_name, slug, schema_name, status, trial_expiry_at, stripe_subscription_status) 
            VALUES ($1, $2, $3, $4, $5, $6) 
            ON CONFLICT (slug) DO UPDATE SET 
                trial_expiry_at = EXCLUDED.trial_expiry_at,
                stripe_subscription_status = EXCLUDED.stripe_subscription_status
            RETURNING id
        `, ['Enforcement Clinic', 'enforce-test', TEST_SCHEMA, 'active', new Date(Date.now() - 86400000), 'none']);
        clinicId = res.rows[0].id;

        // Create a staff user
        await pool.query(`SET search_path TO ${TEST_SCHEMA}`);
        const staffResult = await pool.query(`
            INSERT INTO users (email, password_hash, first_name, last_name, role, status)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING id
        `, ['staff@enforce.com', 'hashed', 'Staff', 'User', 'Admin', 'active']);
        testStaffId = staffResult.rows[0].id;
        testStaffToken = jwt.sign({ userId: testStaffId, clinicSlug: 'enforce-test', clinicId }, JWT_SECRET);
    });

    afterAll(async () => {
        await pool.query(`SET search_path TO public`);
        await pool.query(`DELETE FROM clinics WHERE id = $1`, [clinicId]);
        await pool.query(`DROP SCHEMA IF EXISTS ${TEST_SCHEMA} CASCADE`);
        await pool.end();
    });

    test('POST request is BLOCKED for expired trial (402)', async () => {
        const res = await request(app)
            .post('/api/patients')
            .set('Authorization', `Bearer ${testStaffToken}`)
            .set('X-Clinic-Slug', 'enforce-test')
            .send({ first_name: 'Blocked', last_name: 'Patient' });

        expect(res.status).toBe(402);
        expect(res.body.error).toBe('Subscription Required');
    });

    test('GET request is ALLOWED for expired trial (200)', async () => {
        const res = await request(app)
            .get('/api/patients')
            .set('Authorization', `Bearer ${testStaffToken}`)
            .set('X-Clinic-Slug', 'enforce-test');

        // Should be allowed even if it returns empty array
        expect(res.status).toBe(200);
    });

    test('POST request is ALLOWED if subscription is active', async () => {
        // Update clinic to be active
        await pool.query('SET search_path TO public');
        await pool.query(`UPDATE clinics SET stripe_subscription_status = 'active' WHERE id = $1`, [clinicId]);

        const res = await request(app)
            .post('/api/patients')
            .set('Authorization', `Bearer ${testStaffToken}`)
            .set('X-Clinic-Slug', 'enforce-test')
            .send({ first_name: 'Allowed', last_name: 'Patient' });

        expect(res.status).toBe(201); // Created
    });

    test('POST request is ALLOWED if trial is valid', async () => {
        // Update clinic to have valid trial and none subscription
        await pool.query('SET search_path TO public');
        await pool.query(`
            UPDATE clinics 
            SET stripe_subscription_status = 'none', 
                trial_expiry_at = NOW() + INTERVAL '1 day' 
            WHERE id = $1
        `, [clinicId]);

        const res = await request(app)
            .post('/api/patients')
            .set('Authorization', `Bearer ${testStaffToken}`)
            .set('X-Clinic-Slug', 'enforce-test')
            .send({ first_name: 'Trial', last_name: 'Patient' });

        expect(res.status).toBe(201);
    });

    test('Sandbox is EXEMPT from billing blocks', async () => {
        // Create an expired trial clinic but with sandbox token
        const sandboxToken = jwt.sign({
            userId: testStaffId,
            isSandbox: true,
            sandboxId: 'test-enforce',
            clinicId: '60456326-868d-4e21-942a-fd35190ed4fc'
        }, JWT_SECRET);

        const res = await request(app)
            .post('/api/patients')
            .set('Authorization', `Bearer ${sandboxToken}`)
            .send({ first_name: 'Sandbox', last_name: 'Patient' });

        // Note: For sandbox, it uses its own schema, so we just check if it gets PAST the middleware (402 check)
        // It might fail later with 500 or 404 because tables don't exist in the sandbox schema,
        // but it should NOT return 402.
        expect(res.status).not.toBe(402);
    });
});
