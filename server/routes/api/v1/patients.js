/**
 * Patients API v1
 * 
 * RESTful patient endpoints with scope enforcement.
 */

const express = require('express');
const { requireScopes } = require('../../../middleware/oauthAuth');
const { success, successWithPagination, error, notFound, validationError, encodeCursor, parseUpdatedSince } = require('../../../utils/apiResponse');
const pool = require('../../../db');

const router = express.Router();

/**
 * List patients with cursor pagination
 * GET /api/v1/patients
 * Requires: patient.read
 */
router.get('/', requireScopes('patient.read'), async (req, res) => {
    try {
        const { cursor, limit = 20, updated_since, search } = req.query;
        const maxLimit = Math.min(parseInt(limit, 10) || 20, 100);

        let query = `
      SELECT id, mrn, first_name, last_name, dob, sex, phone, email,
             address_line1, city, state, zip, status, created_at, updated_at
      FROM patients
      WHERE 1=1
    `;
        const params = [];
        let paramIndex = 1;

        // Cursor-based pagination (using id as cursor)
        if (cursor) {
            try {
                const decodedCursor = Buffer.from(cursor, 'base64url').toString('utf-8');
                query += ` AND id > $${paramIndex++}`;
                params.push(decodedCursor);
            } catch (e) {
                return error(res, 'invalid_cursor', 'Invalid cursor format', 400);
            }
        }

        // Updated since filter
        const updatedSince = parseUpdatedSince(updated_since);
        if (updatedSince) {
            query += ` AND updated_at >= $${paramIndex++}`;
            params.push(updatedSince);
        }

        // Search filter
        if (search) {
            query += ` AND (
        first_name ILIKE $${paramIndex} OR
        last_name ILIKE $${paramIndex} OR
        mrn ILIKE $${paramIndex} OR
        phone ILIKE $${paramIndex}
      )`;
            params.push(`%${search}%`);
            paramIndex++;
        }

        query += ` ORDER BY id ASC LIMIT $${paramIndex++}`;
        params.push(maxLimit + 1); // Fetch one extra to check for more

        const result = await pool.query(query, params);

        const hasMore = result.rows.length > maxLimit;
        const patients = hasMore ? result.rows.slice(0, maxLimit) : result.rows;
        const nextCursor = hasMore && patients.length > 0
            ? encodeCursor(patients[patients.length - 1].id)
            : null;

        // Transform to API format
        const data = patients.map(p => ({
            id: p.id,
            mrn: p.mrn,
            name: {
                first: p.first_name,
                last: p.last_name,
                full: `${p.first_name} ${p.last_name}`
            },
            birth_date: p.dob,
            sex: p.sex,
            contact: {
                phone: p.phone,
                email: p.email
            },
            address: {
                line1: p.address_line1,
                city: p.city,
                state: p.state,
                postal_code: p.zip
            },
            status: p.status,
            created_at: p.created_at,
            updated_at: p.updated_at
        }));

        return successWithPagination(res, data, {
            limit: maxLimit,
            has_more: hasMore,
            next_cursor: nextCursor
        });
    } catch (err) {
        console.error('[API v1] List patients error:', err);
        return error(res, 'server_error', 'Failed to list patients', 500);
    }
});

/**
 * Get single patient
 * GET /api/v1/patients/:id
 * Requires: patient.read
 */
router.get('/:id', requireScopes('patient.read'), async (req, res) => {
    try {
        const { id } = req.params;

        const result = await pool.query(
            `SELECT * FROM patients WHERE id = $1`,
            [id]
        );

        if (result.rows.length === 0) {
            return notFound(res, 'Patient');
        }

        const p = result.rows[0];

        const data = {
            id: p.id,
            mrn: p.mrn,
            name: {
                first: p.first_name,
                last: p.last_name,
                middle: p.middle_name,
                suffix: p.suffix,
                full: [p.first_name, p.middle_name, p.last_name, p.suffix].filter(Boolean).join(' ')
            },
            birth_date: p.dob,
            sex: p.sex,
            gender_identity: p.gender_identity,
            pronouns: p.pronouns,
            contact: {
                phone: p.phone,
                phone_alt: p.phone_alt,
                email: p.email
            },
            address: {
                line1: p.address_line1,
                line2: p.address_line2,
                city: p.city,
                state: p.state,
                postal_code: p.zip,
                country: p.country || 'US'
            },
            emergency_contact: {
                name: p.emergency_contact_name,
                phone: p.emergency_contact_phone,
                relationship: p.emergency_contact_relationship
            },
            insurance: {
                primary_name: p.insurance_primary_name,
                primary_id: p.insurance_primary_id,
                primary_group: p.insurance_primary_group
            },
            preferred_language: p.preferred_language,
            preferred_pharmacy_id: p.preferred_pharmacy_id,
            status: p.status,
            created_at: p.created_at,
            updated_at: p.updated_at
        };

        return success(res, data);
    } catch (err) {
        console.error('[API v1] Get patient error:', err);
        return error(res, 'server_error', 'Failed to get patient', 500);
    }
});

/**
 * Create patient
 * POST /api/v1/patients
 * Requires: patient.write
 */
router.post('/', requireScopes('patient.write'), async (req, res) => {
    try {
        const {
            mrn, first_name, last_name, middle_name, suffix,
            birth_date, sex, gender_identity, pronouns,
            phone, phone_alt, email,
            address_line1, address_line2, city, state, postal_code, country,
            emergency_contact_name, emergency_contact_phone, emergency_contact_relationship,
            preferred_language, preferred_pharmacy_id
        } = req.body;

        // Validation
        const errors = [];
        if (!first_name) errors.push({ field: 'first_name', issue: 'required' });
        if (!last_name) errors.push({ field: 'last_name', issue: 'required' });
        if (!birth_date) errors.push({ field: 'birth_date', issue: 'required' });

        if (errors.length > 0) {
            return validationError(res, 'Validation failed', errors);
        }

        // Generate MRN if not provided
        const patientMrn = mrn || `PMD${Date.now().toString(36).toUpperCase()}`;

        const result = await pool.query(
            `INSERT INTO patients (
        mrn, first_name, last_name, middle_name, suffix,
        dob, sex, gender_identity, pronouns,
        phone, phone_alt, email,
        address_line1, address_line2, city, state, zip, country,
        emergency_contact_name, emergency_contact_phone, emergency_contact_relationship,
        preferred_language, preferred_pharmacy_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23)
      RETURNING id, mrn, first_name, last_name, dob, created_at`,
            [
                patientMrn, first_name, last_name, middle_name, suffix,
                birth_date, sex, gender_identity, pronouns,
                phone, phone_alt, email,
                address_line1, address_line2, city, state, postal_code, country || 'US',
                emergency_contact_name, emergency_contact_phone, emergency_contact_relationship,
                preferred_language, preferred_pharmacy_id
            ]
        );

        const p = result.rows[0];
        return success(res, {
            id: p.id,
            mrn: p.mrn,
            name: {
                first: p.first_name,
                last: p.last_name
            },
            birth_date: p.dob,
            created_at: p.created_at
        }, 201);
    } catch (err) {
        console.error('[API v1] Create patient error:', err);
        if (err.code === '23505') { // Unique violation
            return error(res, 'duplicate', 'Patient with this MRN already exists', 409);
        }
        return error(res, 'server_error', 'Failed to create patient', 500);
    }
});

/**
 * Update patient
 * PATCH /api/v1/patients/:id
 * Requires: patient.write
 */
router.patch('/:id', requireScopes('patient.write'), async (req, res) => {
    try {
        const { id } = req.params;

        // Check patient exists
        const existing = await pool.query('SELECT id FROM patients WHERE id = $1', [id]);
        if (existing.rows.length === 0) {
            return notFound(res, 'Patient');
        }

        // Build dynamic update
        const allowedFields = [
            'first_name', 'last_name', 'middle_name', 'suffix',
            'sex', 'gender_identity', 'pronouns',
            'phone', 'phone_alt', 'email',
            'address_line1', 'address_line2', 'city', 'state', 'country',
            'emergency_contact_name', 'emergency_contact_phone', 'emergency_contact_relationship',
            'preferred_language', 'preferred_pharmacy_id', 'status'
        ];

        // Map API field names to DB field names
        const fieldMapping = {
            birth_date: 'dob',
            postal_code: 'zip'
        };

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

        // Handle mapped fields
        if (req.body.birth_date !== undefined) {
            updates.push(`dob = $${paramIndex++}`);
            values.push(req.body.birth_date);
        }
        if (req.body.postal_code !== undefined) {
            updates.push(`zip = $${paramIndex++}`);
            values.push(req.body.postal_code);
        }

        if (updates.length === 0) {
            return error(res, 'invalid_request', 'No valid fields to update', 400);
        }

        updates.push('updated_at = NOW()');
        values.push(id);

        const result = await pool.query(
            `UPDATE patients SET ${updates.join(', ')} WHERE id = $${paramIndex}
       RETURNING id, mrn, first_name, last_name, updated_at`,
            values
        );

        const p = result.rows[0];
        return success(res, {
            id: p.id,
            mrn: p.mrn,
            name: {
                first: p.first_name,
                last: p.last_name
            },
            updated_at: p.updated_at
        });
    } catch (err) {
        console.error('[API v1] Update patient error:', err);
        return error(res, 'server_error', 'Failed to update patient', 500);
    }
});

module.exports = router;
