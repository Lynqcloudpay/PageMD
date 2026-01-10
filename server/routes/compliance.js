const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { requirePermission } = require('../services/authorization');
const pool = require('../db');

// All compliance routes require admin/audit permission
router.use(authenticate, requirePermission('audit:view'));

/**
 * GET /api/compliance/logs
 * Audit logs with advanced filtering
 */
router.get('/logs', async (req, res) => {
    try {
        const { patientId, patientSearch, userId, accessType, isRestricted, breakGlass, startDate, endDate, limit = 50, offset = 0 } = req.query;
        const clinicId = req.user.clinic_id || req.user.clinicId;

        let query = `
      SELECT l.*, 
             p.first_name as patient_first_name, p.last_name as patient_last_name,
             u.first_name as user_first_name, u.last_name as user_last_name
      FROM chart_access_logs l
      LEFT JOIN patients p ON l.patient_id = p.id
      LEFT JOIN users u ON l.user_id = u.id
      WHERE l.clinic_id = $1
    `;
        const params = [clinicId];
        let pCount = 1;

        if (patientId) {
            pCount++;
            query += ` AND l.patient_id = $${pCount}`;
            params.push(patientId);
        }
        if (patientSearch) {
            pCount++;
            query += ` AND (p.first_name ILIKE $${pCount} OR p.last_name ILIKE $${pCount} OR CONCAT(p.first_name, ' ', p.last_name) ILIKE $${pCount} OR p.mrn ILIKE $${pCount})`;
            params.push(`%${patientSearch}%`);
        }
        if (userId) {
            pCount++;
            query += ` AND l.user_id = $${pCount}`;
            params.push(userId);
        }
        if (accessType) {
            pCount++;
            query += ` AND l.access_type = $${pCount}`;
            params.push(accessType);
        }
        if (isRestricted !== undefined) {
            pCount++;
            query += ` AND l.is_restricted = $${pCount}`;
            params.push(isRestricted === 'true');
        }
        if (breakGlass !== undefined) {
            pCount++;
            query += ` AND l.break_glass_used = $${pCount}`;
            params.push(breakGlass === 'true');
        }
        if (startDate) {
            pCount++;
            query += ` AND l.created_at >= $${pCount}`;
            params.push(startDate);
        }
        if (endDate) {
            pCount++;
            query += ` AND l.created_at <= $${pCount}`;
            params.push(endDate);
        }

        query += ` ORDER BY l.created_at DESC LIMIT $${++pCount} OFFSET $${++pCount}`;
        params.push(parseInt(limit), parseInt(offset));

        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (error) {
        console.error('[Compliance-Route] Error fetching logs:', error);
        res.status(500).json({ error: 'Failed to fetch audit logs' });
    }
});

/**
 * GET /api/compliance/alerts
 * Fetch privacy alerts
 */
router.get('/alerts', async (req, res) => {
    try {
        const { unresolvedOnly = 'true', patientSearch } = req.query;
        const clinicId = req.user.clinic_id || req.user.clinicId;

        let query = `
      SELECT a.*, 
             p.first_name as patient_first_name, p.last_name as patient_last_name,
             u.first_name as user_first_name, u.last_name as user_last_name,
             ru.first_name as resolver_first_name, ru.last_name as resolver_last_name
      FROM privacy_alerts a
      LEFT JOIN patients p ON a.patient_id = p.id
      LEFT JOIN users u ON a.user_id = u.id
      LEFT JOIN users ru ON a.resolved_by_user_id = ru.id
      WHERE a.clinic_id = $1
    `;
        const params = [clinicId];
        let pCount = 1;

        if (unresolvedOnly === 'true') {
            query += ` AND a.resolved_at IS NULL`;
        }

        if (patientSearch) {
            pCount++;
            query += ` AND (p.first_name ILIKE $${pCount} OR p.last_name ILIKE $${pCount} OR CONCAT(p.first_name, ' ', p.last_name) ILIKE $${pCount} OR p.mrn ILIKE $${pCount})`;
            params.push(`%${patientSearch}%`);
        }

        query += ` ORDER BY a.created_at DESC`;

        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (error) {
        console.error('[Compliance-Route] Error fetching alerts:', error);
        res.status(500).json({ error: 'Failed to fetch privacy alerts' });
    }
});

/**
 * PATCH /api/compliance/alerts/:id/resolve
 */
router.patch('/alerts/:id/resolve', async (req, res) => {
    try {
        const { id } = req.params;
        const { resolutionNote } = req.body;
        const userId = req.user.id;
        const clinicId = req.user.clinic_id || req.user.clinicId;

        if (!clinicId) {
            return res.status(400).json({ error: 'Clinic context missing' });
        }

        const result = await pool.query(
            `UPDATE privacy_alerts SET 
                resolved_at = CURRENT_TIMESTAMP, 
                resolved_by_user_id = $1,
                details_json = COALESCE(details_json, '{}'::jsonb) || jsonb_build_object('resolution_note', $2::text)
            WHERE id = $3 AND clinic_id = $4
            RETURNING id`,
            [userId, resolutionNote || '', id, clinicId]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Alert not found or already resolved' });
        }

        res.json({ success: true });
    } catch (error) {
        console.error('[Compliance-Route] Error resolving alert:', error);
        res.status(500).json({ error: 'Failed to resolve alert: ' + error.message });
    }
});

/**
 * GET /api/compliance/stats
 * Basic stats for the dashboard
 */
router.get('/stats', async (req, res) => {
    try {
        const clinicId = req.user.clinic_id || req.user.clinicId;

        const statsQuery = `
            SELECT 
                (SELECT COUNT(*) FROM chart_access_logs WHERE clinic_id = $1) as total_access,
                (SELECT COUNT(*) FROM chart_access_logs WHERE clinic_id = $1 AND is_restricted = true) as restricted_access,
                (SELECT COUNT(*) FROM chart_access_logs WHERE clinic_id = $1 AND break_glass_used = true) as break_glass_count,
                (SELECT COUNT(*) FROM privacy_alerts WHERE clinic_id = $1 AND resolved_at IS NULL) as active_alerts
        `;

        const result = await pool.query(statsQuery, [clinicId]);
        res.json(result.rows[0]);
    } catch (error) {
        console.error('[Compliance-Route] Error fetching stats:', error);
        res.status(500).json({ error: 'Failed to fetch compliance stats' });
    }
});

/**
 * GET /api/compliance/reports/restricted-patients
 * Inventory of all patients with high-privacy flags active.
 */
router.get('/reports/restricted-patients', async (req, res) => {
    try {
        const clinicId = req.user.clinic_id || req.user.clinicId;

        const query = `
            SELECT id, first_name, last_name, mrn, dob, sex, 
                   COALESCE(restricted_status, 'normal') as status,
                   created_at
            FROM patients 
            WHERE clinic_id = $1 AND restricted_status = 'restricted'
            ORDER BY last_name, first_name
        `;

        const result = await pool.query(query, [clinicId]);
        res.json(result.rows);
    } catch (error) {
        console.error('[Compliance-Route] Error fetching restricted patients:', error);
        res.status(500).json({ error: 'Failed to fetch restricted patients report' });
    }
});

module.exports = router;
