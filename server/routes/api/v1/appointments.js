/**
 * Appointments API v1
 */

const express = require('express');
const { requireScopes } = require('../../../middleware/oauthAuth');
const { success, successWithPagination, error, notFound, validationError, encodeCursor, parseUpdatedSince } = require('../../../utils/apiResponse');
const pool = require('../../../db');

const router = express.Router();

/**
 * List appointments
 * GET /api/v1/appointments
 * Requires: appointment.read
 */
router.get('/', requireScopes('appointment.read'), async (req, res) => {
    try {
        const { cursor, limit = 20, patient_id, provider_id, date_from, date_to, status } = req.query;
        const maxLimit = Math.min(parseInt(limit, 10) || 20, 100);

        let query = `
      SELECT a.id, a.patient_id, a.provider_id, a.appointment_date, a.appointment_time,
             a.duration, a.type, a.status, a.reason, a.notes, a.visit_method,
             a.created_at, a.updated_at,
             p.first_name as patient_first, p.last_name as patient_last,
             u.first_name as provider_first, u.last_name as provider_last
      FROM appointments a
      LEFT JOIN patients p ON a.patient_id = p.id
      LEFT JOIN users u ON a.provider_id = u.id
      WHERE 1=1
    `;
        const params = [];
        let paramIndex = 1;

        if (patient_id) {
            query += ` AND a.patient_id = $${paramIndex++}`;
            params.push(patient_id);
        }

        if (provider_id) {
            query += ` AND a.provider_id = $${paramIndex++}`;
            params.push(provider_id);
        }

        if (date_from) {
            query += ` AND a.appointment_date >= $${paramIndex++}`;
            params.push(date_from);
        }

        if (date_to) {
            query += ` AND a.appointment_date <= $${paramIndex++}`;
            params.push(date_to);
        }

        if (status) {
            query += ` AND a.status = $${paramIndex++}`;
            params.push(status);
        }

        if (cursor) {
            try {
                const decodedCursor = Buffer.from(cursor, 'base64url').toString('utf-8');
                query += ` AND a.id > $${paramIndex++}`;
                params.push(decodedCursor);
            } catch (e) {
                return error(res, 'invalid_cursor', 'Invalid cursor format', 400);
            }
        }

        query += ` ORDER BY a.appointment_date DESC, a.appointment_time DESC, a.id ASC LIMIT $${paramIndex++}`;
        params.push(maxLimit + 1);

        const result = await pool.query(query, params);

        const hasMore = result.rows.length > maxLimit;
        const appointments = hasMore ? result.rows.slice(0, maxLimit) : result.rows;
        const nextCursor = hasMore && appointments.length > 0
            ? encodeCursor(appointments[appointments.length - 1].id)
            : null;

        const data = appointments.map(a => ({
            id: a.id,
            patient: {
                id: a.patient_id,
                name: `${a.patient_first} ${a.patient_last}`
            },
            provider: {
                id: a.provider_id,
                name: `${a.provider_first} ${a.provider_last}`
            },
            date: a.appointment_date,
            time: a.appointment_time,
            duration_minutes: a.duration,
            type: a.type,
            status: a.status,
            reason: a.reason,
            visit_method: a.visit_method,
            created_at: a.created_at,
            updated_at: a.updated_at
        }));

        return successWithPagination(res, data, { limit: maxLimit, has_more: hasMore, next_cursor: nextCursor });
    } catch (err) {
        console.error('[API v1] List appointments error:', err);
        return error(res, 'server_error', 'Failed to list appointments', 500);
    }
});

/**
 * Get single appointment
 * GET /api/v1/appointments/:id
 */
router.get('/:id', requireScopes('appointment.read'), async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT a.*, p.first_name as patient_first, p.last_name as patient_last, p.mrn,
              u.first_name as provider_first, u.last_name as provider_last
       FROM appointments a
       LEFT JOIN patients p ON a.patient_id = p.id
       LEFT JOIN users u ON a.provider_id = u.id
       WHERE a.id = $1`,
            [req.params.id]
        );

        if (result.rows.length === 0) {
            return notFound(res, 'Appointment');
        }

        const a = result.rows[0];
        return success(res, {
            id: a.id,
            patient: { id: a.patient_id, name: `${a.patient_first} ${a.patient_last}`, mrn: a.mrn },
            provider: { id: a.provider_id, name: `${a.provider_first} ${a.provider_last}` },
            date: a.appointment_date,
            time: a.appointment_time,
            duration_minutes: a.duration,
            type: a.type,
            status: a.status,
            reason: a.reason,
            notes: a.notes,
            visit_method: a.visit_method,
            created_at: a.created_at,
            updated_at: a.updated_at
        });
    } catch (err) {
        console.error('[API v1] Get appointment error:', err);
        return error(res, 'server_error', 'Failed to get appointment', 500);
    }
});

/**
 * Create appointment
 * POST /api/v1/appointments
 */
router.post('/', requireScopes('appointment.write'), async (req, res) => {
    try {
        const { patient_id, provider_id, date, time, duration_minutes = 30, type, reason, notes, visit_method = 'in_person' } = req.body;

        const errors = [];
        if (!patient_id) errors.push({ field: 'patient_id', issue: 'required' });
        if (!provider_id) errors.push({ field: 'provider_id', issue: 'required' });
        if (!date) errors.push({ field: 'date', issue: 'required' });
        if (!time) errors.push({ field: 'time', issue: 'required' });

        if (errors.length > 0) {
            return validationError(res, 'Validation failed', errors);
        }

        const result = await pool.query(
            `INSERT INTO appointments (patient_id, provider_id, appointment_date, appointment_time, duration, type, reason, notes, visit_method, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'scheduled')
       RETURNING id, appointment_date, appointment_time, status, created_at`,
            [patient_id, provider_id, date, time, duration_minutes, type, reason, notes, visit_method]
        );

        const a = result.rows[0];
        return success(res, {
            id: a.id,
            date: a.appointment_date,
            time: a.appointment_time,
            status: a.status,
            created_at: a.created_at
        }, 201);
    } catch (err) {
        console.error('[API v1] Create appointment error:', err);
        return error(res, 'server_error', 'Failed to create appointment', 500);
    }
});

/**
 * Update appointment
 * PATCH /api/v1/appointments/:id
 */
router.patch('/:id', requireScopes('appointment.write'), async (req, res) => {
    try {
        const { id } = req.params;
        const existing = await pool.query('SELECT id FROM appointments WHERE id = $1', [id]);
        if (existing.rows.length === 0) {
            return notFound(res, 'Appointment');
        }

        const fieldMapping = { date: 'appointment_date', time: 'appointment_time', duration_minutes: 'duration' };
        const allowedFields = ['provider_id', 'appointment_date', 'appointment_time', 'duration', 'type', 'status', 'reason', 'notes', 'visit_method'];

        const updates = [];
        const values = [];
        let paramIndex = 1;

        for (const [key, value] of Object.entries(req.body)) {
            const dbField = fieldMapping[key] || key;
            if (allowedFields.includes(dbField) && value !== undefined) {
                updates.push(`${dbField} = $${paramIndex++}`);
                values.push(value);
            }
        }

        if (updates.length === 0) {
            return error(res, 'invalid_request', 'No valid fields to update', 400);
        }

        updates.push('updated_at = NOW()');
        values.push(id);

        const result = await pool.query(
            `UPDATE appointments SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING id, status, updated_at`,
            values
        );

        return success(res, result.rows[0]);
    } catch (err) {
        console.error('[API v1] Update appointment error:', err);
        return error(res, 'server_error', 'Failed to update appointment', 500);
    }
});

module.exports = router;
