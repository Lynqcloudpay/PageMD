/**
 * Documents API v1
 */

const express = require('express');
const { requireScopes } = require('../../../middleware/oauthAuth');
const { success, successWithPagination, error, notFound, validationError, encodeCursor } = require('../../../utils/apiResponse');
const pool = require('../../../db');

const router = express.Router();

/**
 * List documents
 * GET /api/v1/documents
 */
router.get('/', requireScopes('document.read'), async (req, res) => {
    try {
        const { cursor, limit = 20, patient_id, type, encounter_id } = req.query;
        const maxLimit = Math.min(parseInt(limit, 10) || 20, 100);

        let query = `
      SELECT d.id, d.patient_id, d.visit_id, d.doc_type, d.filename, d.title,
             d.description, d.mime_type, d.file_size, d.created_at, d.updated_at,
             p.first_name as patient_first, p.last_name as patient_last
      FROM documents d
      LEFT JOIN patients p ON d.patient_id = p.id
      WHERE 1=1
    `;
        const params = [];
        let paramIndex = 1;

        if (patient_id) { query += ` AND d.patient_id = $${paramIndex++}`; params.push(patient_id); }
        if (type) { query += ` AND d.doc_type = $${paramIndex++}`; params.push(type); }
        if (encounter_id) { query += ` AND d.visit_id = $${paramIndex++}`; params.push(encounter_id); }

        if (cursor) {
            try {
                const decodedCursor = Buffer.from(cursor, 'base64url').toString('utf-8');
                query += ` AND d.id > $${paramIndex++}`;
                params.push(decodedCursor);
            } catch (e) {
                return error(res, 'invalid_cursor', 'Invalid cursor format', 400);
            }
        }

        query += ` ORDER BY d.created_at DESC, d.id ASC LIMIT $${paramIndex++}`;
        params.push(maxLimit + 1);

        const result = await pool.query(query, params);

        const hasMore = result.rows.length > maxLimit;
        const documents = hasMore ? result.rows.slice(0, maxLimit) : result.rows;
        const nextCursor = hasMore && documents.length > 0 ? encodeCursor(documents[documents.length - 1].id) : null;

        const data = documents.map(d => ({
            id: d.id,
            patient: { id: d.patient_id, name: `${d.patient_first} ${d.patient_last}` },
            encounter_id: d.visit_id,
            type: d.doc_type,
            title: d.title || d.filename,
            filename: d.filename,
            description: d.description,
            mime_type: d.mime_type,
            file_size: d.file_size,
            created_at: d.created_at
        }));

        return successWithPagination(res, data, { limit: maxLimit, has_more: hasMore, next_cursor: nextCursor });
    } catch (err) {
        console.error('[API v1] List documents error:', err);
        return error(res, 'server_error', 'Failed to list documents', 500);
    }
});

/**
 * Get single document metadata
 * GET /api/v1/documents/:id
 */
router.get('/:id', requireScopes('document.read'), async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT d.*, p.first_name as patient_first, p.last_name as patient_last
       FROM documents d
       LEFT JOIN patients p ON d.patient_id = p.id
       WHERE d.id = $1`,
            [req.params.id]
        );

        if (result.rows.length === 0) {
            return notFound(res, 'Document');
        }

        const d = result.rows[0];
        return success(res, {
            id: d.id,
            patient: { id: d.patient_id, name: `${d.patient_first} ${d.patient_last}` },
            encounter_id: d.visit_id,
            type: d.doc_type,
            title: d.title || d.filename,
            filename: d.filename,
            description: d.description,
            mime_type: d.mime_type,
            file_size: d.file_size,
            file_path: d.file_path, // For internal use; consider redacting in production
            created_at: d.created_at,
            updated_at: d.updated_at
        });
    } catch (err) {
        console.error('[API v1] Get document error:', err);
        return error(res, 'server_error', 'Failed to get document', 500);
    }
});

/**
 * Create document metadata
 * POST /api/v1/documents
 * 
 * Note: This creates metadata only. File upload handled separately.
 */
router.post('/', requireScopes('document.write'), async (req, res) => {
    try {
        const { patient_id, type, title, description, filename, mime_type, file_size, encounter_id, file_path } = req.body;

        const errors = [];
        if (!patient_id) errors.push({ field: 'patient_id', issue: 'required' });
        if (!filename) errors.push({ field: 'filename', issue: 'required' });

        if (errors.length > 0) {
            return validationError(res, 'Validation failed', errors);
        }

        const uploaderId = req.oauth?.userId || req.user?.id;

        const result = await pool.query(
            `INSERT INTO documents (patient_id, visit_id, doc_type, title, filename, description, mime_type, file_size, file_path, uploader_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id, doc_type, filename, created_at`,
            [patient_id, encounter_id, type, title, filename, description, mime_type, file_size, file_path, uploaderId]
        );

        return success(res, result.rows[0], 201);
    } catch (err) {
        console.error('[API v1] Create document error:', err);
        return error(res, 'server_error', 'Failed to create document', 500);
    }
});

module.exports = router;
