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
            INSERT INTO users (email, first_name, last_name, role, is_admin, status)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING id
        `, ['demo@pagemd.com', 'Doctor', 'Sandbox', 'Clinician', true, 'active']);
        const providerId = providerRes.rows[0].id;

        // 3. Seed Clinical Data
        await seedSandbox(client, schemaName, providerId);

        await client.query('COMMIT');

        // 4. Issue JWT
        const token = jwt.sign({
            userId: 'demo-user',
            email: 'demo@pagemd.com',
            isSandbox: true,
            sandboxId: sandboxId,
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
