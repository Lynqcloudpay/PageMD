/**
 * Encounters API v1
 */

const express = require('express');
const { requireScopes } = require('../../../middleware/oauthAuth');
const { success, successWithPagination, error, notFound, validationError, encodeCursor } = require('../../../utils/apiResponse');
const pool = require('../../../db');

const router = express.Router();

/**
 * List encounters
 * GET /api/v1/encounters
 */
router.get('/', requireScopes('encounter.read'), async (req, res) => {
    try {
        const { cursor, limit = 20, patient_id, provider_id, status } = req.query;
        const maxLimit = Math.min(parseInt(limit, 10) || 20, 100);

        let query = `
      SELECT v.id, v.patient_id, v.provider_id, v.visit_date, v.visit_time,
             v.visit_type, v.status, v.chief_complaint, v.signed_at, v.created_at, v.updated_at,
             p.first_name as patient_first, p.last_name as patient_last,
             u.first_name as provider_first, u.last_name as provider_last
      FROM visits v
      LEFT JOIN patients p ON v.patient_id = p.id
      LEFT JOIN users u ON v.provider_id = u.id
      WHERE 1=1
    `;
        const params = [];
        let paramIndex = 1;

        if (patient_id) { query += ` AND v.patient_id = $${paramIndex++}`; params.push(patient_id); }
        if (provider_id) { query += ` AND v.provider_id = $${paramIndex++}`; params.push(provider_id); }
        if (status) { query += ` AND v.status = $${paramIndex++}`; params.push(status); }

        if (cursor) {
            try {
                const decodedCursor = Buffer.from(cursor, 'base64url').toString('utf-8');
                query += ` AND v.id > $${paramIndex++}`;
                params.push(decodedCursor);
            } catch (e) {
                return error(res, 'invalid_cursor', 'Invalid cursor format', 400);
            }
        }

        query += ` ORDER BY v.visit_date DESC, v.id ASC LIMIT $${paramIndex++}`;
        params.push(maxLimit + 1);

        const result = await pool.query(query, params);

        const hasMore = result.rows.length > maxLimit;
        const encounters = hasMore ? result.rows.slice(0, maxLimit) : result.rows;
        const nextCursor = hasMore && encounters.length > 0 ? encodeCursor(encounters[encounters.length - 1].id) : null;

        const data = encounters.map(e => ({
            id: e.id,
            patient: { id: e.patient_id, name: `${e.patient_first} ${e.patient_last}` },
            provider: { id: e.provider_id, name: `${e.provider_first} ${e.provider_last}` },
            date: e.visit_date,
            time: e.visit_time,
            type: e.visit_type,
            status: e.status,
            chief_complaint: e.chief_complaint,
            signed_at: e.signed_at,
            created_at: e.created_at,
            updated_at: e.updated_at
        }));

        return successWithPagination(res, data, { limit: maxLimit, has_more: hasMore, next_cursor: nextCursor });
    } catch (err) {
        console.error('[API v1] List encounters error:', err);
        return error(res, 'server_error', 'Failed to list encounters', 500);
    }
});

/**
 * Get single encounter
 * GET /api/v1/encounters/:id
 */
router.get('/:id', requireScopes('encounter.read'), async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT v.*, p.first_name as patient_first, p.last_name as patient_last, p.mrn,
              u.first_name as provider_first, u.last_name as provider_last
       FROM visits v
       LEFT JOIN patients p ON v.patient_id = p.id
       LEFT JOIN users u ON v.provider_id = u.id
       WHERE v.id = $1`,
            [req.params.id]
        );

        if (result.rows.length === 0) {
            return notFound(res, 'Encounter');
        }

        const e = result.rows[0];
        return success(res, {
            id: e.id,
            patient: { id: e.patient_id, name: `${e.patient_first} ${e.patient_last}`, mrn: e.mrn },
            provider: { id: e.provider_id, name: `${e.provider_first} ${e.provider_last}` },
            date: e.visit_date,
            time: e.visit_time,
            type: e.visit_type,
            status: e.status,
            chief_complaint: e.chief_complaint,
            assessment: e.assessment,
            plan: e.plan,
            signed_at: e.signed_at,
            signed_by: e.signed_by,
            created_at: e.created_at,
            updated_at: e.updated_at
        });
    } catch (err) {
        console.error('[API v1] Get encounter error:', err);
        return error(res, 'server_error', 'Failed to get encounter', 500);
    }
});

/**
 * Create encounter
 * POST /api/v1/encounters
 */
router.post('/', requireScopes('encounter.write'), async (req, res) => {
    try {
        const { patient_id, provider_id, date, time, type, chief_complaint, appointment_id } = req.body;

        const errors = [];
        if (!patient_id) errors.push({ field: 'patient_id', issue: 'required' });
        if (!provider_id) errors.push({ field: 'provider_id', issue: 'required' });

        if (errors.length > 0) {
            return validationError(res, 'Validation failed', errors);
        }

        const visitDate = date || new Date().toISOString().split('T')[0];
        const visitTime = time || new Date().toTimeString().split(' ')[0];

        const result = await pool.query(
            `INSERT INTO visits (patient_id, provider_id, visit_date, visit_time, visit_type, chief_complaint, appointment_id, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'in_progress')
       RETURNING id, visit_date, status, created_at`,
            [patient_id, provider_id, visitDate, visitTime, type, chief_complaint, appointment_id]
        );

        return success(res, result.rows[0], 201);
    } catch (err) {
        console.error('[API v1] Create encounter error:', err);
        return error(res, 'server_error', 'Failed to create encounter', 500);
    }
});

/**
 * Close/sign encounter
 * POST /api/v1/encounters/:id/close
 */
router.post('/:id/close', requireScopes('encounter.write'), async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.oauth?.userId || req.user?.id;

        const existing = await pool.query('SELECT id, status FROM visits WHERE id = $1', [id]);
        if (existing.rows.length === 0) {
            return notFound(res, 'Encounter');
        }

        if (existing.rows[0].status === 'signed') {
            return error(res, 'already_signed', 'Encounter has already been signed', 400);
        }

        const result = await pool.query(
            `UPDATE visits SET status = 'signed', signed_at = NOW(), signed_by = $1, updated_at = NOW()
       WHERE id = $2 RETURNING id, status, signed_at`,
            [userId, id]
        );

        return success(res, result.rows[0]);
    } catch (err) {
        console.error('[API v1] Close encounter error:', err);
        return error(res, 'server_error', 'Failed to close encounter', 500);
    }
});

module.exports = router;
