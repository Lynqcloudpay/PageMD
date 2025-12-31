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
 * 
 * REQUIRED FIELDS (per payer standards):
 * - payerId: Trading partner ID
 * - memberId: Subscriber/Member ID
 * - dob: Date of birth (YYYY-MM-DD)
 * - subscriberFirstName, subscriberLastName: Subscriber name
 */
router.post('/verify', requirePermission('billing:view'), async (req, res) => {
    const startTime = Date.now();

    try {
        const {
            patientId,
            payerId,
            memberId,
            groupNumber,
            serviceTypeCode,
            npi,
            subscriberFirstName,
            subscriberLastName
        } = req.body;

        // === STRICT VALIDATION (Required for 270) ===
        const errors = [];

        if (!payerId) errors.push("Payer ID required");
        if (!memberId) errors.push("Member ID required");

        // Fetch patient data if patientId provided
        let dob = req.body.dob;
        let firstName = subscriberFirstName;
        let lastName = subscriberLastName;

        if (patientId) {
            const patRes = await pool.query(
                'SELECT date_of_birth, first_name, last_name FROM patients WHERE id = $1',
                [patientId]
            );
            if (patRes.rows.length > 0) {
                const pat = patRes.rows[0];
                dob = dob || pat.date_of_birth;
                firstName = firstName || pat.first_name;
                lastName = lastName || pat.last_name;
            }
        }

        if (!dob) errors.push("Date of birth required for eligibility check");
        if (!firstName || !lastName) errors.push("Subscriber name required for eligibility check");

        if (errors.length > 0) {
            return res.status(400).json({
                error: "Missing required fields for eligibility check",
                missing: errors
            });
        }

        // Format DOB if needed
        const formattedDob = typeof dob === 'string' ? dob :
            (dob instanceof Date ? dob.toISOString().split('T')[0] : null);

        // === SEND REQUEST ===
        const result = await clearinghouse.verifyEligibility({
            tenantId: req.user.tenant_id || 'default',
            payerId,
            memberId,
            groupNumber,
            npi: npi || process.env.CLINIC_NPI,
            dob: formattedDob,
            subscriberFirstName: firstName,
            subscriberLastName: lastName,
            serviceTypeCode: serviceTypeCode || '30' // Health Benefit Plan Coverage
        });

        // === PHI-SAFE AUDIT LOG ===
        // Do NOT log: memberId, DOB, names, SSN, etc.
        // Only log: payerId, status, response time, success/fail
        const responseTimeMs = Date.now() - startTime;
        try {
            await pool.query(`
                INSERT INTO billing_event_log (
                    event_type, actor_id, details
                ) VALUES (
                    'eligibility_check', $1, $2
                )
            `, [
                req.user.id,
                JSON.stringify({
                    patientId, // OK - internal UUID, not PHI
                    payerId,   // OK - payer code
                    status: result.status || result.coverage?.active ? 'active' : 'inactive',
                    responseTimeMs,
                    hasError: false
                })
            ]);
        } catch (auditErr) {
            console.warn("Audit log failed (non-blocking):", auditErr.message);
        }

        res.json(result);

    } catch (e) {
        // Log error without PHI
        console.error("Eligibility Check Failed:", e.message);

        // Audit the failure
        try {
            await pool.query(`
                INSERT INTO billing_event_log (
                    event_type, actor_id, details
                ) VALUES (
                    'eligibility_check', $1, $2
                )
            `, [
                req.user.id,
                JSON.stringify({
                    hasError: true,
                    errorType: e.name || 'UnknownError',
                    // Do NOT log e.message if it might contain PHI
                    responseTimeMs: Date.now() - startTime
                })
            ]);
        } catch (auditErr) {
            // Ignore audit failures
        }

        // Return sanitized error - NO PHI
        res.status(502).json({
            error: "Eligibility verification failed",
            code: 'ELIGIBILITY_FAILED'
        });
    }
});

module.exports = router;
