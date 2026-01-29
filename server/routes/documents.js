const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const pool = require('../db');
const { authenticate, requireRole, logAudit } = require('../middleware/auth');
const { requirePermission } = require('../services/authorization');

const router = express.Router();
router.use(authenticate);

const uploadDir = process.env.UPLOAD_DIR || './uploads';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
});

// Get documents for patient
router.get('/patient/:patientId', requirePermission('patients:view_chart'), async (req, res) => {
  const dbClient = req.dbClient || pool;
  try {
    const { patientId } = req.params;
    const result = await dbClient.query(
      `SELECT d.*, 
              COALESCE(u.first_name, 'Unknown') as uploader_first_name, 
              COALESCE(u.last_name, 'User') as uploader_last_name
       FROM documents d
       LEFT JOIN users u ON d.uploader_id = u.id
       WHERE d.patient_id = $1
       ORDER BY d.created_at DESC`,
      [patientId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching documents:', error);
    res.status(500).json({ error: 'Failed to fetch documents' });
  }
});

// Upload document
router.post('/', requirePermission('patients:view_chart'), upload.single('file'), async (req, res) => {
  const requestId = req.headers['x-request-id'] || Math.random().toString(36).substring(7);
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    let { patientId, visitId, docType, tags } = req.body;

    // Validation
    if (!patientId) {
      console.error(`[DOC-UPLOAD][${requestId}] Validation failed: Missing patientId`);
      return res.status(400).json({
        error: 'Missing patientId',
        receivedBody: req.body // Help debug if fields are arriving after the file
      });
    }

    // Safety: Trim IDs to prevent potential FK issues with whitespace
    patientId = patientId.trim();
    if (visitId) visitId = visitId.trim();

    console.log(`[DOC-UPLOAD][${requestId}] Request: patientId=${patientId}, visitId=${visitId}, docType=${docType}, file=${req.file.originalname}`);

    // Determine query executor (prefer transactional client)
    const dbClient = req.dbClient || pool._currentClient || pool;
    if (!req.dbClient && !pool._currentClient) {
      console.warn(`[DOC-UPLOAD][${requestId}] WARNING: No transactional client found. Falling back to global pool.`);
    }

    // Sanitize docType to match DB CHECK constraint: ('imaging', 'consult', 'lab', 'other')
    const validDocTypes = ['imaging', 'consult', 'lab', 'other'];
    if (!docType) {
      docType = 'other';
    } else {
      docType = docType.toLowerCase().trim();
      // Map common subtypes to valid categories
      const imagingTypes = ['echo', 'ekg', 'stress', 'stress_test', 'stress-test', 'cardiac_cath', 'cardiac-cath', 'cath'];
      if (imagingTypes.includes(docType)) {
        docType = 'imaging';
      }
      // If still not valid category, check if it's one of the allowed ones
      if (!validDocTypes.includes(docType)) {
        docType = 'other';
      }
    }

    // Store URL path as /uploads/ (API base URL already includes /api prefix)
    const urlPath = `/uploads/${req.file.filename}`;

    // Execute query
    const result = await dbClient.query(
      `INSERT INTO documents (
        patient_id, visit_id, uploader_id, doc_type, filename, file_path, mime_type, file_size, tags
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [
        patientId,
        visitId || null,
        req.user.id,
        docType,
        req.file.originalname,
        urlPath,
        req.file.mimetype,
        req.file.size,
        tags && typeof tags === 'string' ? tags.split(',') : (Array.isArray(tags) ? tags : []),
      ]
    );

    try {
      await logAudit(req.user.id, 'upload_document', 'document', result.rows[0].id, { docType }, req.ip);
    } catch (auditError) {
      console.error(`[DOC-UPLOAD][${requestId}] Audit log failed:`, auditError.message);
    }

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error(`[DOC-UPLOAD][${requestId}] Error uploading document:`, error);
    console.error(`[DOC-UPLOAD][${requestId}] Error details:`, {
      message: error.message,
      code: error.code,
      detail: error.detail,
      constraint: error.constraint,
      table: error.table,
      body: req.body // Log body to see if fields arrived
    });
    res.status(500).json({
      error: 'Failed to upload document',
      message: error.message,
      detail: error.detail,
      code: error.code
    });
  }
});

// Get document file
router.get('/:id/file', requirePermission('patients:view_chart'), async (req, res) => {
  const dbClient = req.dbClient || pool;
  const requestId = Math.random().toString(36).substring(7);
  try {
    const { id } = req.params;
    console.log(`[DOC-FILE][${requestId}] Fetching file for document ID: ${id}`);

    const result = await dbClient.query('SELECT file_path, filename, mime_type FROM documents WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      console.warn(`[DOC-FILE][${requestId}] Document not found in DB: ${id}`);
      return res.status(404).json({ error: 'Document not found' });
    }

    const doc = result.rows[0];
    console.log(`[DOC-FILE][${requestId}] Found document: ${doc.filename}, path: ${doc.file_path}`);

    // Handle three possible path formats:
    // 1. New format: /uploads/filename (preferred)
    // 2. Old API format: /api/uploads/filename  
    // 3. Legacy filesystem path: ./uploads/filename
    let actualPath;
    if (doc.file_path.startsWith('/uploads/') || doc.file_path.startsWith('/api/uploads/')) {
      // URL path format - preserve subdirectory structure relative to uploads folder
      const relativePath = doc.file_path.replace(/^\/api/, '').replace(/^\/uploads\//, '');
      actualPath = path.join(uploadDir, relativePath);
    } else {
      // Legacy filesystem path
      actualPath = doc.file_path;
    }

    const resolvedPath = path.resolve(actualPath);
    console.log(`[DOC-FILE][${requestId}] Resolved absolute path: ${resolvedPath}`);

    if (!fs.existsSync(resolvedPath)) {
      console.error(`[DOC-FILE][${requestId}] File not found on disk: ${resolvedPath}`);
      return res.status(404).json({ error: 'File not found on disk' });
    }

    res.setHeader('Content-Type', doc.mime_type || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${doc.filename}"`);
    res.sendFile(resolvedPath);
  } catch (error) {
    console.error(`[DOC-FILE][${requestId}] Error fetching document file:`, error);
    res.status(500).json({ error: 'Failed to fetch document', message: error.message });
  }
});

// Update document (for comments and review status)
router.put('/:id', requirePermission('patients:view_chart'), async (req, res) => {
  try {
    const { id } = req.params;
    const { reviewed, comment } = req.body;

    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (req.body.visit_id !== undefined) {
      updates.push(`visit_id = $${paramIndex}`);
      values.push(req.body.visit_id); // Can be null to unlink
      paramIndex++;
    }

    if (reviewed !== undefined) {
      updates.push(`reviewed = $${paramIndex}`);
      values.push(reviewed);
      paramIndex++;

      if (reviewed) {
        updates.push(`reviewed_at = CURRENT_TIMESTAMP`);
        updates.push(`reviewed_by = $${paramIndex}`);
        values.push(req.user.id);
        paramIndex++;
      }
    }

    if (comment !== undefined) {
      // If comment is provided, add it to the comments array with timestamp
      // IMPORTANT: Always preserve all previous comments for legal record keeping
      const currentDoc = await pool.query('SELECT comments FROM documents WHERE id = $1', [id]);
      let existingComments = currentDoc.rows[0]?.comments || [];

      // Parse existing comments if they're stored as a string
      if (typeof existingComments === 'string') {
        try {
          existingComments = JSON.parse(existingComments);
        } catch (e) {
          // If parsing fails, start with empty array
          existingComments = [];
        }
      }

      // Ensure existingComments is an array
      if (!Array.isArray(existingComments)) {
        existingComments = [];
      }

      const newComment = {
        comment: comment.trim(),
        timestamp: new Date().toISOString(),
        userId: req.user.id,
        userName: `${req.user.first_name} ${req.user.last_name}` || 'Unknown'
      };

      // Append new comment to existing comments (never delete previous comments)
      const updatedComments = [...existingComments, newComment];

      updates.push(`comments = $${paramIndex}`);
      values.push(JSON.stringify(updatedComments));
      paramIndex++;

      // Also update the legacy comment field for backward compatibility (keep most recent)
      updates.push(`comment = $${paramIndex}`);
      values.push(comment.trim());
      paramIndex++;
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(id);

    const result = await pool.query(
      `UPDATE documents SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Document not found' });
    }

    await logAudit(req.user.id, 'update_document', 'document', id, { reviewed }, req.ip);

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating document:', error);
    res.status(500).json({ error: 'Failed to update document' });
  }
});

// Delete document
router.delete('/:id', requirePermission('patients:view_chart'), async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT file_path FROM documents WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const filePath = result.rows[0].file_path;
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    await pool.query('DELETE FROM documents WHERE id = $1', [id]);

    await logAudit(req.user.id, 'delete_document', 'document', id, {}, req.ip);

    res.json({ message: 'Document deleted' });
  } catch (error) {
    console.error('Error deleting document:', error);
    res.status(500).json({ error: 'Failed to delete document' });
  }
});

module.exports = router;



