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

        // Debug log
        console.log('[Eligibility] Verify Request:', { patientId, payerId, memberId, subscriberFirstName, subscriberLastName });

        // Let the client know what's missing, but be helpful with defaults in non-prod
        let actualPayerId = payerId;
        if (!actualPayerId || actualPayerId === 'UNKNOWN') {
            const isProd = process.env.NODE_ENV === 'production' && process.env.CLEARINGHOUSE_MODE !== 'sandbox';
            if (!isProd) {
                actualPayerId = '61033'; // Generic Sandbox Payer (Medicare)
            } else {
                errors.push("Payer ID required");
            }
        }

        const patientEncryptionService = require('../services/patientEncryptionService');

        let actualMemberId = memberId;
        let actualDob = req.body.dob;
        let firstName = subscriberFirstName;
        let lastName = subscriberLastName;

        if (patientId) {
            const patRes = await pool.query(
                'SELECT date_of_birth, dob, first_name, last_name, insurance_id, insurance_member_id, encryption_metadata FROM patients WHERE id = $1',
                [patientId]
            );
            if (patRes.rows.length > 0) {
                // Decrypt PHI (names, IDs)
                const pat = await patientEncryptionService.decryptPatientPHI(patRes.rows[0]);

                actualDob = actualDob || pat.date_of_birth || pat.dob;
                firstName = firstName || pat.first_name;
                lastName = lastName || pat.last_name;
                if (!actualMemberId) {
                    actualMemberId = pat.insurance_id || pat.insurance_member_id;
                }
            }
        }

        if (!actualMemberId) errors.push("Member ID required");
        if (!actualDob) errors.push("Date of birth required for eligibility check");
        if (!firstName || !lastName) errors.push("Subscriber name required for eligibility check");

        if (errors.length > 0) {
            console.warn('[Eligibility] Validation Failed:', errors);
            return res.status(400).json({
                error: "Missing required fields for eligibility check",
                missing: errors
            });
        }

        // Format DOB if needed
        const formattedDob = typeof actualDob === 'string' ? actualDob :
            (actualDob instanceof Date ? actualDob.toISOString().split('T')[0] : null);

        // === SEND REQUEST ===
        const result = await clearinghouse.verifyEligibility({
            tenantId: req.user.tenant_id || 'default',
            payerId: actualPayerId,
            memberId: actualMemberId,
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
