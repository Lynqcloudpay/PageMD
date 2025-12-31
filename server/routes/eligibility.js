const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { requirePermission } = require('../services/authorization');
const clearinghouse = require('../services/clearinghouse');
const pool = require('../db');

router.use(authenticate);

/**
 * POST /api/eligibility/verify
 * Real-time 270/271 Eligibility Check
 */
router.post('/verify', requirePermission('billing:view'), async (req, res) => {
    try {
        const {
            patientId,
            payerId,
            memberId,
            groupNumber,
            serviceTypeCode,
            npi
        } = req.body;

        // Validation
        if (!payerId) return res.status(400).json({ error: "Payer ID required" });
        if (!memberId) return res.status(400).json({ error: "Member ID required" });

        // Fetch Patient if DOB needed (usually is for 270)
        let dob = req.body.dob;
        if (!dob && patientId) {
            const patRes = await pool.query('SELECT date_of_birth FROM patients WHERE id = $1', [patientId]);
            if (patRes.rows.length > 0) {
                dob = patRes.rows[0].date_of_birth; // Assuming formatted or Date object
            }
        }

        // Determine Tenant (Clinic) Config
        // In this app, we might use req.user.tenant_id or similar.
        // For now, passing 'default' or relying on factory to resolve from context if we had it.
        // We'll pass tenantId from req.user if available.

        const result = await clearinghouse.verifyEligibility({
            tenantId: req.user.tenant_id || 'default',
            payerId,
            memberId,
            groupNumber,
            npi: npi || process.env.CLINIC_NPI || '1234567890', // specific provider NPI or Fallback
            dob: dob,
            serviceTypeCode: serviceTypeCode || '30'
        });

        // Audit Log
        // (Assuming we have a logAudit middleware or helper available, doing rough insert for now)
        try {
            await pool.query(`
                INSERT INTO billing_event_log (
                    event_type, actor_id, details
                ) VALUES (
                    'eligibility_check', $1, $2
                )
            `, [req.user.id, JSON.stringify({ patientId, payerId, status: result.status })]);
        } catch (e) {
            console.warn("Audit log failed", e.message);
        }

        res.json(result);

    } catch (e) {
        console.error("Eligibility Check Failed:", e);
        // Do NOT return full error payload with PHI
        res.status(502).json({
            error: "Eligibility check failed with clearinghouse",
            details: e.message
        });
    }
});

module.exports = router;
