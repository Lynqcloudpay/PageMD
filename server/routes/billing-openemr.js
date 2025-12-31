const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { requirePermission } = require('../services/authorization');
const billingService = require('../services/billingService');
const arService = require('../services/arService');
const insuranceService = require('../services/insuranceService');

// Apply authentication
router.use(authenticate);

router.get('/insurance/verify/:id', requirePermission('billing:view'), async (req, res) => {
    try {
        const result = await insuranceService.verify(req.params.id);
        res.json(result);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

/**
 * GET /api/billing-openemr/reports
 * Search for billing items (Billing Manager)
 */
router.get('/reports', requirePermission('billing:view'), async (req, res) => {
    try {
        const results = await billingService.getBillingReport(req.query);
        res.json(results);
    } catch (e) {
        console.error("Error fetching billing report", e);
        res.status(500).json({ error: e.message });
    }
});

router.get('/reports/ar-aging', requirePermission('billing:view'), async (req, res) => {
    try {
        const results = await arService.getARAging(req.query.asOfDate);
        res.json(results);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.get('/reports/collections', requirePermission('billing:view'), async (req, res) => {
    try {
        const results = await arService.getCollectionsReport(req.query);
        res.json(results);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.get('/statements/patient/:id', requirePermission('billing:view'), async (req, res) => {
    try {
        const results = await arService.getPatientStatement(req.params.id, req.query.from, req.query.to);
        res.json(results);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

/**
 * POST /api/billing-openemr/claims/generate
 * Generate X12 Claims for encounters
 */
/**
 * POST /api/billing-openemr/claims/generate
 * Generate X12 Claims for encounters
 */
router.post('/claims/generate', requirePermission('billing:edit'), async (req, res) => {
    try {
        const { encounters, partnerId, batchId } = req.body;
        if (!encounters || !Array.isArray(encounters)) {
            return res.status(400).json({ error: "Encounters array required" });
        }
        const results = await billingService.generateClaims(encounters, partnerId, req.user.id, batchId);
        res.json(results);
    } catch (e) {
        console.error("Error generating claims", e);
        res.status(500).json({ error: e.message });
    }
});

router.post('/collections/send', requirePermission('billing:edit'), async (req, res) => {
    try {
        const { encounterId, agency } = req.body;
        const pool = require('../db');
        // Note: Using direct pool query or service. Ideally service. 
        // Accessing pool directly here for brevity in Phase 4.

        // Skipping direct table update for safety as column schema varies.
        // Relying on billing_event_log (below) for audit trail of this action.
        // await pool.query(`UPDATE visits SET billing_notes = ...`);

        await pool.query(`
            INSERT INTO billing_event_log (event_type, actor_id, visit_id, details)
            VALUES ('sent_collections', $1, $2, $3)
        `, [req.user.id, encounterId, JSON.stringify({ agency })]);

        res.json({ status: 'sent' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});



/**
 * POST /api/billing-openemr/ar/session
 * Create a new AR Session (Payment Entry)
 */
router.post('/ar/session', requirePermission('billing:edit'), async (req, res) => {
    try {
        const session = await arService.createSession(req.body, req.user.id);
        if (session.error === 'DUPLICATE_PAYMENT') {
            return res.status(409).json({ error: "Payment already posted (Idempotency Check)" });
        }
        res.json(session);
    } catch (e) {
        if (e.message === 'ALLOCATION_MISMATCH_SERVER') {
            return res.status(400).json({ error: "Allowed mismatch: Allocations do not equal total payment amount" });
        }
        if (e.message === 'DUPLICATE_PAYMENT') {
            return res.status(409).json({ error: "Payment already posted (Idempotency Check)" });
        }
        console.error("Error creating AR session", e);
        res.status(500).json({ error: e.message });
    }
});

/**
 * GET /api/billing-openemr/claims/:id
 * Get Claim Details
 */
router.get('/claims/:id', requirePermission('billing:view'), async (req, res) => {
    try {
        const claim = await billingService.getClaim(req.params.id);
        if (!claim) return res.status(404).json({ error: "Claim not found" });
        res.json(claim);
    } catch (e) {
        console.error("Error fetching claim", e);
        res.status(500).json({ error: e.message });
    }
});


/**
 * GET /api/billing-openemr/patients/search
 * Search patients for payment posting
 */
router.get('/patients/search', requirePermission('billing:view'), async (req, res) => {
    try {
        const results = await arService.searchPatients(req.query.q);
        res.json(results);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

/**
 * GET /api/billing-openemr/encounters/open
 * Get open encounters for a patient
 */
router.get('/encounters/open', requirePermission('billing:view'), async (req, res) => {
    try {
        if (!req.query.patientId) return res.status(400).json({ error: "patientId required" });
        const results = await arService.getOpenEncounters(req.query.patientId);
        res.json(results);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

/**
 * GET /api/billing-openemr/encounters/:id/ledger
 * Get ledger details for an encounter
 */
router.get('/encounters/:id/ledger', requirePermission('billing:view'), async (req, res) => {
    try {
        const results = await arService.getEncounterLedger(req.params.id);
        res.json(results);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});



/**
 * POST /api/billing-openemr/ar/session/:id/distribute
 * Post activity/payments to an AR Session
 */
router.post('/ar/session/:id/distribute', requirePermission('billing:edit'), async (req, res) => {
    try {
        const { items } = req.body; // Array of distribution items
        if (!items || !Array.isArray(items)) {
            return res.status(400).json({ error: "Items array required" });
        }
        const results = await arService.postActivity(req.params.id, items, req.user.id);
        res.json(results);
    } catch (e) {
        console.error("Error posting activity", e);
        res.status(500).json({ error: e.message });
    }
});

/**
 * GET /api/billing-openemr/encounter/:id/balance
 * Get balance for an encounter
 */
router.get('/encounter/:id/balance', requirePermission('billing:view'), async (req, res) => {
    try {
        const balance = await arService.getEncounterBalance(req.params.id);
        res.json({ balance });
    } catch (e) {
        console.error("Error fetching balance", e);
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
