const { Pool } = require('pg');
const request = require('supertest');
const path = require('path');
const jwt = require('jsonwebtoken');

require('dotenv').config({ path: path.join(__dirname, '../.env') });

// Construct DATABASE_URL for db.js compatibility
const { DB_USER, DB_PASSWORD, DB_HOST, DB_PORT, DB_NAME } = process.env;
if (!process.env.DATABASE_URL && DB_USER) {
    process.env.DATABASE_URL = `postgres://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}`;
    process.env.CONTROL_DATABASE_URL = process.env.DATABASE_URL;
}

// Must require app after dotenv to ensure it loads config? 
// app imports db, which imports dotenv. It's fine.
// But we need to make sure we don't start the server twice.
// server/index.js checks require.main === module. So importing it won't start listen.
const app = require('../index');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

async function runAudit() {
    console.log("Starting Billing Port Audit...");

    try {
        // 1. Identification
        const resSlugs = await pool.query("SELECT slug, schema_name FROM clinics WHERE status='active' LIMIT 1");
        if (resSlugs.rows.length === 0) throw new Error("No active clinic found");
        const { slug, schema_name } = resSlugs.rows[0];
        console.log(`Using Clinic: ${slug} (${schema_name})`);

        // 2. Setup Data (Direct DB manipulation)
        const client = await pool.connect();
        let token;
        let userId, patientId, visitId, encounterId;

        try {
            await client.query('BEGIN');
            await client.query(`SET search_path TO ${schema_name}, public`);

            // Create Admin User
            const uniqueId = Date.now();
            const userRes = await client.query(`
                INSERT INTO users (email, password_hash, first_name, last_name, role)
                VALUES ('audit_${uniqueId}@example.com', 'hash', 'Audit', 'Admin', 'admin')
                RETURNING id
            `);
            userId = userRes.rows[0].id;

            // Generate Token
            // Auth middleware expects decoded.userId
            token = jwt.sign({ userId: userId, role: 'admin', clinicSlug: slug }, process.env.JWT_SECRET || 'dev_secret', { expiresIn: '1h' });

            // Create Patient
            const patRes = await client.query(`
                INSERT INTO patients (first_name, last_name, dob, mrn)
                VALUES ('Test', 'Patient', '1980-01-01', 'MRN-${uniqueId}')
                RETURNING id
            `);
            patientId = patRes.rows[0].id;

            // Create Visit
            const visRes = await client.query(`
                INSERT INTO visits (patient_id, provider_id, visit_date, visit_type)
                VALUES ($1, $2, NOW(), 'Office Visit')
                RETURNING id
            `, [patientId, userId]);
            visitId = visRes.rows[0].id;
            encounterId = visitId; // Sync ID

            // Create Billing Item (Unbilled)
            await client.query(`
                INSERT INTO billing (
                    date, code_type, code, pid, encounter, 
                    provider_id, user_id, fee, units, 
                    activity, billed
                ) VALUES (
                    NOW(), 'CPT4', '99214', $1, $2,
                    $3, $3, 150.00, 1,
                    true, false
                )
            `, [patientId, visitId, userId]);

            await client.query('COMMIT');
        } catch (e) {
            await client.query('ROLLBACK');
            throw e;
        } finally {
            client.release();
        }

        console.log("Setup Complete. Running API Tests...");

        // 3. API Workflow Tests
        const agent = request(app);

        // A. Billing Manager Report
        console.log("\n--- TEST A: Billing Manager Report ---");
        const resReport = await agent
            .get('/api/billing-openemr/reports')
            .set('Authorization', `Bearer ${token}`)
            .set('X-Clinic-Slug', slug)
            .query({ billed: 0 }); // Unbilled only

        console.log("Status:", resReport.status);
        console.log("Response Length:", resReport.body.length);
        console.log("Sample Item:", JSON.stringify(resReport.body[0], null, 2));

        if (resReport.status !== 200 || !Array.isArray(resReport.body)) {
            console.error("FAILED REPORT TEST");
        }

        // B. Claim Generation
        console.log("\n--- TEST B: Claim Generation ---");
        const resClaim = await agent
            .post('/api/billing-openemr/claims/generate')
            .set('Authorization', `Bearer ${token}`)
            .set('X-Clinic-Slug', slug)
            .send({ encounters: [encounterId], partnerId: 1 });

        console.log("Status:", resClaim.status);
        console.log("Response:", JSON.stringify(resClaim.body, null, 2));

        // Verify DB for Claims
        const client2 = await pool.connect();
        await client2.query(`SET search_path TO ${schema_name}, public`);
        const dbClaim = await client2.query(`SELECT * FROM claims WHERE encounter_id = $1`, [encounterId]);
        const dbBill = await client2.query(`SELECT billed, x12_partner_id FROM billing WHERE encounter = $1`, [encounterId]);
        client2.release();

        console.log("DB Verification (Claims):", dbClaim.rows[0] ? "Found" : "Missing");
        console.log("DB Verification (Billing Status):", dbBill.rows[0]);

        // C. Payment Posting
        console.log("\n--- TEST C: Payment Posting ---");
        const resSession = await agent
            .post('/api/billing-openemr/ar/session')
            .set('Authorization', `Bearer ${token}`)
            .set('X-Clinic-Slug', slug)
            .send({
                patientId,
                check_date: '2025-01-01',
                pay_total: 50.00,
                payment_type: 'Check',
                description: 'Partial Payment'
            });

        const sessionId = resSession.body.id;
        console.log("Session Created:", sessionId);

        const resDistribute = await agent
            .post(`/api/billing-openemr/ar/session/${sessionId}/distribute`)
            .set('Authorization', `Bearer ${token}`)
            .set('X-Clinic-Slug', slug)
            .send({
                items: [{
                    pid: patientId,
                    encounter: encounterId,
                    code: '99214',
                    pay_amount: 50.00,
                    adj_amount: 0
                }]
            });

        console.log("Distribution Status:", resDistribute.status);
        console.log("Distribution Result:", JSON.stringify(resDistribute.body, null, 2));

        // D. Balance Check
        console.log("\n--- TEST D: Balance Check ---");
        const resBal = await agent
            .get(`/api/billing-openemr/encounter/${encounterId}/balance`)
            .set('Authorization', `Bearer ${token}`)
            .set('X-Clinic-Slug', slug);

        console.log("Balance Response:", resBal.body);
        // Expect 100.00 (150 - 50)
        console.log("Expected Balance: 100.00");

        // E. Reports Verification (Phase 2)
        console.log("\n--- TEST E: Reports Verification ---");
        const resAging = await agent.get('/api/billing-openemr/reports/ar-aging').set('Authorization', `Bearer ${token}`).set('X-Clinic-Slug', slug);
        if (resAging.status !== 200) console.log("Aging Error Body:", resAging.body);
        console.log("Aging Report Status:", resAging.status, "(Items: " + (Array.isArray(resAging.body) ? resAging.body.length : 'Error') + ")");

        const resColl = await agent.get('/api/billing-openemr/reports/collections').set('Authorization', `Bearer ${token}`).set('X-Clinic-Slug', slug);
        if (resColl.status !== 200) console.log("Collections Error Body:", resColl.body);
        console.log("Collections Status:", resColl.status);

        const resStmt = await agent.get(`/api/billing-openemr/statements/patient/${patientId}`).set('Authorization', `Bearer ${token}`).set('X-Clinic-Slug', slug);
        console.log("Statement Status:", resStmt.status);
        if (resStmt.status === 200 && resStmt.body.totalDue !== undefined) console.log("Statement Balance:", resStmt.body.totalDue);

        // F. Collections Action (Phase 4)
        console.log("\n--- TEST F: Collections Action ---");
        const resCollAction = await agent.post('/api/billing-openemr/collections/send')
            .set('Authorization', `Bearer ${token}`)
            .set('X-Clinic-Slug', slug)
            .send({ encounterId: encounterId, agency: 'TestAgency' });

        console.log("Collection Action Status:", resCollAction.status);
        if (resCollAction.status !== 200) console.log("Collection Error Body:", resCollAction.body);
        if (resCollAction.status === 200) console.log("Collection Sent OK");

        // Cleanup
        // Optional: Delete test data? nah, audit trail.

    } catch (e) {
        console.error("Audit Failed:", e);
    } finally {
        await pool.end();
    }
}

runAudit();
