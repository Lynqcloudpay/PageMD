const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const pool = require('../db');
const { authenticate, requireRole, logAudit } = require('../middleware/auth');
const { requirePrivilege } = require('../middleware/authorization');

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
router.get('/patient/:patientId', requirePrivilege('document:view'), async (req, res) => {
  try {
    const { patientId } = req.params;
    const result = await pool.query(
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
router.post('/', requireRole('clinician', 'front_desk', 'nurse'), upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { patientId, visitId, docType, tags } = req.body;

    const result = await pool.query(
      `INSERT INTO documents (
        patient_id, visit_id, uploader_id, doc_type, filename, file_path, mime_type, file_size, tags
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [
        patientId,
        visitId || null,
        req.user.id,
        docType || 'other',
        req.file.originalname,
        req.file.path,
        req.file.mimetype,
        req.file.size,
        tags ? tags.split(',') : [],
      ]
    );

    await logAudit(req.user.id, 'upload_document', 'document', result.rows[0].id, { docType }, req.ip);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error uploading document:', error);
    res.status(500).json({ error: 'Failed to upload document' });
  }
});

// Get document file
router.get('/:id/file', requirePrivilege('document:view'), async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT file_path, filename, mime_type FROM documents WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const doc = result.rows[0];
    if (!fs.existsSync(doc.file_path)) {
      return res.status(404).json({ error: 'File not found' });
    }

    res.setHeader('Content-Type', doc.mime_type || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${doc.filename}"`);
    res.sendFile(path.resolve(doc.file_path));
  } catch (error) {
    console.error('Error fetching document file:', error);
    res.status(500).json({ error: 'Failed to fetch document' });
  }
});

// Update document (for comments and review status)
router.put('/:id', requireRole('clinician', 'nurse'), async (req, res) => {
  try {
    const { id } = req.params;
    const { reviewed, comment } = req.body;

    const updates = [];
    const values = [];
    let paramIndex = 1;

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
router.delete('/:id', requireRole('clinician', 'admin'), async (req, res) => {
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



