const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authenticate, logAudit } = require('../middleware/auth');
const { requirePermission } = require('../services/authorization');

/**
 * @api {get} /api/patient-flags/types Get all flag types for the clinic
 */
router.get('/types', authenticate, async (req, res) => {
    try {
        const clinicId = req.user.clinic_id || req.user.clinicId;
        // Return both clinic-specific flags and system default flags
        const result = await pool.query(
            `SELECT * FROM flag_types 
             WHERE clinic_id = $1 OR (clinic_id IS NULL AND is_default = true)
             ORDER BY severity = 'critical' DESC, label ASC`,
            [clinicId]
        );
        res.json(result.rows);
    } catch (err) {
        console.error('[PatientFlags] Error fetching types:', err);
        res.status(500).json({ error: 'Failed to fetch flag types' });
    }
});

/**
 * @api {post} /api/patient-flags/types Create a new flag type
 */
router.post('/types', authenticate, requirePermission('patient_flags:manage_types'), async (req, res) => {
    try {
        const clinicId = req.user.clinic_id || req.user.clinicId;
        const { label, category, severity, color, requires_acknowledgment, requires_expiration, default_expiration_days } = req.body;

        const result = await pool.query(
            `INSERT INTO flag_types (clinic_id, label, category, severity, color, requires_acknowledgment, requires_expiration, default_expiration_days)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             RETURNING *`,
            [clinicId, label, category, severity, color, requires_acknowledgment || false, requires_expiration || false, default_expiration_days]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('[PatientFlags] Error creating type:', err);
        res.status(500).json({ error: 'Failed to create flag type' });
    }
});

/**
 * @api {put} /api/patient-flags/types/:id Update a flag type
 */
router.put('/types/:id', authenticate, requirePermission('patient_flags:manage_types'), async (req, res) => {
    try {
        const { id } = req.params;
        const clinicId = req.user.clinic_id || req.user.clinicId;
        const { label, category, severity, color, requires_acknowledgment, requires_expiration, default_expiration_days } = req.body;

        const result = await pool.query(
            `UPDATE flag_types 
             SET label = $1, category = $2, severity = $3, color = $4, requires_acknowledgment = $5, 
                 requires_expiration = $6, default_expiration_days = $7, updated_at = CURRENT_TIMESTAMP
             WHERE id = $8 AND clinic_id = $9
             RETURNING *`,
            [label, category, severity, color, requires_acknowledgment, requires_expiration, default_expiration_days, id, clinicId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Flag type not found' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error('[PatientFlags] Error updating type:', err);
        res.status(500).json({ error: 'Failed to update flag type' });
    }
});

/**
 * @api {delete} /api/patient-flags/types/:id Delete a flag type
 */
router.delete('/types/:id', authenticate, requirePermission('patient_flags:manage_types'), async (req, res) => {
    try {
        const { id } = req.params;
        const clinicId = req.user.clinic_id || req.user.clinicId;

        const result = await pool.query(
            'DELETE FROM flag_types WHERE id = $1 AND clinic_id = $2 RETURNING *',
            [id, clinicId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Flag type not found' });
        }
        res.json({ message: 'Flag type deleted' });
    } catch (err) {
        console.error('[PatientFlags] Error deleting type:', err);
        res.status(500).json({ error: 'Failed to delete flag type' });
    }
});

/**
 * @api {get} /api/patient-flags/patient/:patientId Get all flags for a patient
 */
router.get('/patient/:patientId', authenticate, async (req, res) => {
    try {
        const { patientId } = req.params;
        const clinicId = req.user.clinic_id || req.user.clinicId;

        // Use COALESCE to prioritize custom_label over flag_type label if needed,
        // or just return both and let the frontend decide.
        const result = await pool.query(
            `SELECT pf.*, 
                    COALESCE(ft.label, pf.custom_label) as display_label,
                    COALESCE(ft.category, 'admin') as category, 
                    COALESCE(ft.severity, pf.custom_severity, 'info') as display_severity, 
                    COALESCE(ft.color, pf.custom_color) as display_color,
                    COALESCE(ft.requires_acknowledgment, false) as requires_acknowledgment,
                    u.first_name as created_by_first, u.last_name as created_by_last,
                    ru.first_name as resolved_by_first, ru.last_name as resolved_by_last,
                    (SELECT COUNT(*) FROM patient_flag_acknowledgments pfa WHERE pfa.patient_flag_id = pf.id AND pfa.user_id = $3) > 0 as current_user_acknowledged
             FROM patient_flags pf
             LEFT JOIN flag_types ft ON pf.flag_type_id = ft.id
             LEFT JOIN users u ON pf.created_by_user_id = u.id
             LEFT JOIN users ru ON pf.resolved_by_user_id = ru.id
             WHERE pf.patient_id = $1 AND pf.clinic_id = $2
             ORDER BY pf.status = 'active' DESC, 
                      severity = 'critical' DESC, 
                      pf.created_at DESC`,
            [patientId, clinicId, req.user.id]
        );

        res.json(result.rows);
    } catch (err) {
        console.error('[PatientFlags] Error fetching patient flags:', {
            error: err.message,
            stack: err.stack,
            patientId: req.params.patientId,
            userId: req.user?.id
        });
        res.status(500).json({ error: 'Failed to fetch patient flags', details: err.message });
    }
});

/**
 * @api {post} /api/patient-flags/patient/:patientId Add a flag to a patient
 */
router.post('/patient/:patientId', authenticate, requirePermission('patient_flags:create'), async (req, res) => {
    try {
        const { patientId } = req.params;
        const clinicId = req.user.clinic_id || req.user.clinicId;
        const { flag_type_id, note, expires_at, custom_label, custom_severity, custom_color } = req.body;

        // Handle 'other' from dropdown which isn't a valid UUID
        const actualFlagTypeId = (flag_type_id === 'other' || !flag_type_id) ? null : flag_type_id;

        const result = await pool.query(
            `INSERT INTO patient_flags (
                clinic_id, patient_id, flag_type_id, 
                note, expires_at, created_by_user_id,
                custom_label, custom_severity, custom_color
            )
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
             RETURNING *`,
            [
                clinicId, patientId, actualFlagTypeId,
                note, expires_at || null, req.user.id,
                custom_label, custom_severity || 'info', custom_color
            ]
        );

        // Standardized HIPAA Audit log
        await logAudit(
            req.user.id,
            'flag.created',
            'patient',
            patientId,
            {
                flag_id: result.rows[0].id,
                flag_type_id,
                custom_label: custom_label ? true : false
            },
            req.ip,
            req.get('user-agent')
        );

        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('[PatientFlags] Error adding flag:', err);
        res.status(500).json({ error: 'Failed to add flag', details: err.message });
    }
});

/**
 * @api {patch} /api/patient-flags/:id/resolve Resolve a patient flag
 */
router.patch('/:id/resolve', authenticate, requirePermission('patient_flags:resolve'), async (req, res) => {
    try {
        const { id } = req.params;
        const clinicId = req.user.clinic_id || req.user.clinicId;

        const result = await pool.query(
            `UPDATE patient_flags
             SET status = 'resolved', resolved_by_user_id = $1, resolved_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
             WHERE id = $2 AND clinic_id = $3 AND status = 'active'
             RETURNING *`,
            [req.user.id, id, clinicId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Active flag not found' });
        }

        // Standardized HIPAA Audit log
        await logAudit(
            req.user.id,
            'flag.resolved',
            'patient',
            result.rows[0].patient_id,
            { flag_id: id },
            req.ip,
            req.get('user-agent')
        );

        res.json(result.rows[0]);
    } catch (err) {
        console.error('[PatientFlags] Error resolving flag:', err);
        res.status(500).json({ error: 'Failed to resolve flag', details: err.message });
    }
});

/**
 * @api {post} /api/patient-flags/:id/acknowledge Acknowledge a flag
 */
router.post('/:id/acknowledge', authenticate, async (req, res) => {
    try {
        const { id } = req.params;
        const clinicId = req.user.clinic_id || req.user.clinicId;

        // Verify flag exists and update
        const flagCheck = await pool.query('SELECT patient_id FROM patient_flags WHERE id = $1 AND clinic_id = $2', [id, clinicId]);
        if (flagCheck.rows.length === 0) return res.status(404).json({ error: 'Flag not found' });

        await pool.query(
            `INSERT INTO patient_flag_acknowledgments (clinic_id, patient_flag_id, user_id)
             VALUES ($1, $2, $3)
             ON CONFLICT (patient_flag_id, user_id) DO NOTHING`,
            [clinicId, id, req.user.id]
        );

        res.json({ success: true });
    } catch (err) {
        console.error('[PatientFlags] Error acknowledging flag:', err);
        res.status(500).json({ error: 'Failed to acknowledge flag' });
    }
});

module.exports = router;
