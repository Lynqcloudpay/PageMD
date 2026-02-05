const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const pool = require('../db');
const tenantSchemaSQL = require('../config/tenantSchema');
const { seedSandbox } = require('../scripts/seed-sandbox-core');

/**
 * Sandbox Provisioning Endpoint
 * 1. Creates a unique schema sandbox_{id}
 * 2. Runs tenant migrations
 * 3. Seeds master demo data
 * 4. Issues sandbox JWT
 */
router.post('/provision', async (req, res) => {
    const sandboxId = crypto.randomBytes(8).toString('hex');
    const schemaName = `sandbox_${sandboxId}`;

    let client;
    try {
        console.log(`[Sandbox] Provisioning new demo: ${schemaName}`);
        client = await pool.controlPool.connect();

        await client.query('BEGIN');

        // 1. Create Schema and Tables
        await client.query(`CREATE SCHEMA ${schemaName}`);
        await client.query(`SET search_path TO ${schemaName}, public`);
        await client.query(tenantSchemaSQL);

        // 2. Create Default Sandbox Provider
        const providerRes = await client.query(`
            INSERT INTO users (email, password_hash, first_name, last_name, role, is_admin, status)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING id
        `, ['demo@pagemd.com', 'sandbox_auto_login_placeholder', 'Doctor', 'Sandbox', 'Clinician', true, 'active']);
        const providerId = providerRes.rows[0].id;
        const sandboxClinicId = '60456326-868d-4e21-942a-fd35190ed4fc'; // Matches public.clinics 'sandboxclinic' slug

        // 3. Seed Basic Settings
        await client.query(`
            INSERT INTO practice_settings (practice_name, practice_type, timezone)
            VALUES ('Sandbox Medical Center', 'General Practice', 'America/New_York')
        `);

        await client.query(`
            INSERT INTO clinical_settings (require_dx_on_visit, enable_clinical_alerts)
            VALUES (true, true)
        `);

        // 4. Seed Clinical Data
        await seedSandbox(client, schemaName, providerId, sandboxClinicId);

        await client.query('COMMIT');

        // 4. Issue JWT
        const token = jwt.sign({
            userId: providerId,
            email: 'demo@pagemd.com',
            isSandbox: true,
            sandboxId: sandboxId,
            clinicId: sandboxClinicId,
            clinicSlug: 'demo',
            role: 'Clinician'
        }, process.env.JWT_SECRET, { expiresIn: '1h' });

        res.json({
            success: true,
            token,
            sandboxId,
            redirect: '/dashboard'
        });

    } catch (error) {
        if (client) await client.query('ROLLBACK');
        console.error('[Sandbox] Provisioning failed:', error);
        res.status(500).json({ error: 'Failed to provision demo environment.' });
    } finally {
        if (client) client.release();
    }
});

module.exports = router;
