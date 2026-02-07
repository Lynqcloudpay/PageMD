const express = require('express');
const pool = require('../../db');
const { authenticatePortal, requirePortalPermission } = require('../../middleware/portalAuth');
const patientEncryptionService = require('../../services/patientEncryptionService');

const router = express.Router();

// All chart routes require portal authentication
router.use(authenticatePortal);

/**
 * Get Portal Me / Dashboard Summary
 * GET /api/portal/chart/me
 */
router.get('/me', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT id, first_name, last_name, dob, sex, phone, email, 
                   address_line1, address_line2, city, state, zip, encryption_metadata
            FROM patients
            WHERE id = $1
        `, [req.portalAccount.patient_id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Patient data not found' });
        }

        const decrypted = await patientEncryptionService.decryptPatientPHI(result.rows[0]);
        res.json(decrypted);
    } catch (error) {
        console.error('[Portal Chart] Error fetching me:', error);
        res.status(500).json({ error: 'Failed to fetch patient data' });
    }
});

/**
 * Get Medications
 * GET /api/portal/chart/medications
 */
router.get('/medications', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT id, medication_name, dosage, frequency, instructions, start_date, status
            FROM medications
            WHERE patient_id = $1 AND status = 'active'
            ORDER BY created_at DESC
        `, [req.portalAccount.patient_id]);

        res.json(result.rows);
    } catch (error) {
        console.error('[Portal Chart] Error fetching meds:', error);
        res.status(500).json({ error: 'Failed to fetch medications' });
    }
});

/**
 * Get Allergies
 * GET /api/portal/chart/allergies
 */
router.get('/allergies', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT id, allergen, reaction, severity, active
            FROM allergies
            WHERE patient_id = $1 AND active = true
            ORDER BY created_at DESC
        `, [req.portalAccount.patient_id]);

        res.json(result.rows);
    } catch (error) {
        console.error('[Portal Chart] Error fetching allergies:', error);
        res.status(500).json({ error: 'Failed to fetch allergies' });
    }
});

/**
 * Get Problems
 * GET /api/portal/chart/problems
 */
router.get('/problems', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT id, problem_name, icd10_code, onset_date, status
            FROM problems
            WHERE patient_id = $1 AND status = 'active'
            ORDER BY onset_date DESC
        `, [req.portalAccount.patient_id]);

        res.json(result.rows);
    } catch (error) {
        console.error('[Portal Chart] Error fetching problems:', error);
        res.status(500).json({ error: 'Failed to fetch problem list' });
    }
});

/**
 * Get Visits
 * GET /api/portal/chart/visits
 */
router.get('/visits', requirePortalPermission('can_view_notes'), async (req, res) => {
    try {
        // Only show signed notes/visits
        const result = await pool.query(`
            SELECT v.id, v.visit_date, v.visit_type, v.status,
                   u.first_name as provider_first, u.last_name as provider_last
            FROM visits v
            JOIN users u ON v.provider_id = u.id
            WHERE v.patient_id = $1 AND v.status = 'finalized'
            ORDER BY v.visit_date DESC
        `, [req.portalAccount.patient_id]);

        res.json(result.rows);
    } catch (error) {
        console.error('[Portal Chart] Error fetching visits:', error);
        res.status(500).json({ error: 'Failed to fetch visit history' });
    }
});

/**
 * Get Labs
 * GET /api/portal/chart/labs
 */
router.get('/labs', requirePortalPermission('can_view_labs'), async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT id, test_name, test_code, result_value, result_units, 
                   reference_range, abnormal_flags, completed_at, comment
            FROM orders
            WHERE patient_id = $1 AND order_type = 'lab' AND status = 'completed'
            ORDER BY completed_at DESC
        `, [req.portalAccount.patient_id]);

        res.json(result.rows);
    } catch (error) {
        console.error('[Portal Chart] Error fetching labs:', error);
        res.status(500).json({ error: 'Failed to fetch lab results' });
    }
});

/**
 * Get Vitals
 * GET /api/portal/chart/vitals
 */
router.get('/vitals', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT visit_date, vitals
            FROM visits
            WHERE patient_id = $1 AND vitals IS NOT NULL
            ORDER BY visit_date DESC
        `, [req.portalAccount.patient_id]);

        res.json(result.rows);
    } catch (error) {
        console.error('[Portal Chart] Error fetching vitals:', error);
        res.status(500).json({ error: 'Failed to fetch vital signs' });
    }
});

/**
 * Get Documents
 * GET /api/portal/chart/documents
 */
router.get('/documents', requirePortalPermission('can_view_documents'), async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT id, doc_type, filename, created_at, comment
            FROM documents
            WHERE patient_id = $1
            ORDER BY created_at DESC
        `, [req.portalAccount.patient_id]);

        res.json(result.rows);
    } catch (error) {
        console.error('[Portal Chart] Error fetching documents:', error);
        res.status(500).json({ error: 'Failed to fetch documents' });
    }
});

/**
 * Get Clinical Staff (for messaging/appointments)
 * GET /api/portal/chart/staff
 */
router.get('/staff', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT id, first_name, last_name, role
            FROM users
            WHERE active = true
            ORDER BY last_name ASC, first_name ASC
        `);

        res.json(result.rows);
    } catch (error) {
        console.error('[Portal Chart] Error fetching staff:', error);
        res.status(500).json({ error: 'Failed to fetch staff list' });
    }
});

/**
 * Get Patient Profile
 * GET /api/portal/chart/patient-profile
 */
router.get('/patient-profile', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT id, first_name, last_name, mrn, dob, sex, primary_care_provider, encryption_metadata
            FROM patients
            WHERE id = $1
        `, [req.portalAccount.patient_id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Patient not found' });
        }

        const decrypted = await patientEncryptionService.decryptPatientPHI(result.rows[0]);
        res.json(decrypted);
    } catch (error) {
        console.error('[Portal Chart] Error fetching patient profile:', error);
        res.status(500).json({ error: 'Failed to fetch patient profile' });
    }
});

module.exports = router;
