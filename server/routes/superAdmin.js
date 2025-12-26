const express = require('express');
const pool = require('../db');
const tenantManager = require('../services/tenantManager');

const router = express.Router();

// Middleware to verify Super Admin status
// In production, this should check a specific Super Admin JWT or IP whitelist
const verifySuperAdmin = (req, res, next) => {
    // Simple check for demonstration; replace with real Super Admin auth
    const adminSecret = req.headers['x-super-admin-secret'];
    if (adminSecret && adminSecret === process.env.SUPER_ADMIN_SECRET) {
        return next();
    }
    res.status(403).json({ error: 'Access denied. Super Admin credentials required.' });
};

/**
 * GET /api/super/clinics
 * List all clinics across the platform
 */
router.get('/clinics', verifySuperAdmin, async (req, res) => {
    try {
        const { rows } = await pool.controlPool.query('SELECT * FROM clinics ORDER BY created_at DESC');
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch clinics from Control DB' });
    }
});

/**
 * POST /api/super/clinics/onboard
 * Provisions a new clinic:
 * 1. Creates clinic record in Control DB
 * 2. Sets up DB connection info
 * 3. (Manual Step for now) Provisioning the Postgres DB itself
 */
router.post('/clinics/onboard', verifySuperAdmin, async (req, res) => {
    const { clinic, dbConfig } = req.body;

    if (!clinic.slug || !dbConfig.dbName) {
        return res.status(400).json({ error: 'Missing required onboarding data.' });
    }

    try {
        const clinicId = await tenantManager.provisionClinic(clinic, dbConfig);
        res.status(201).json({
            message: 'Clinic onboarded successfully. Database linked.',
            clinicId
        });
    } catch (error) {
        console.error('Onboarding failed:', error);
        res.status(500).json({ error: 'Failed to onboard clinic.' });
    }
});

module.exports = router;
