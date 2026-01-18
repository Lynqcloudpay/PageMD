const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const pool = require('../db');
const { authenticate, requireRole, logAudit } = require('../middleware/auth');
const { requirePermission } = require('../services/authorization');
const DocumentStoreService = require('../mother/DocumentStoreService');
const TenantDb = require('../mother/TenantDb');

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
        receivedBody: req.body
      });
    }

    // Safety: Trim IDs
    patientId = patientId.trim();
    if (visitId) visitId = visitId.trim();

    // Sanitize docType
    const validDocTypes = ['imaging', 'consult', 'lab', 'other'];
    if (!docType) {
      docType = 'other';
    } else {
      docType = docType.toLowerCase().trim();
      const imagingTypes = ['echo', 'ekg', 'stress', 'stress_test', 'stress-test', 'cardiac_cath', 'cardiac-cath', 'cath'];
      if (imagingTypes.includes(docType)) docType = 'imaging';
      if (!validDocTypes.includes(docType)) docType = 'other';
    }

    const urlPath = `/uploads/${req.file.filename}`;

    const dbClient = req.dbClient || pool._currentClient || pool;

    const storedDoc = await DocumentStoreService.storeDocument(dbClient, {
      clinicId: req.user.clinic_id,
      patientId,
      encounterId: visitId,
      docType,
      title: req.file.originalname,
      filePath: urlPath,
      mimeType: req.file.mimetype,
      fileSize: req.file.size,
      status: 'unreviewed',
      authorUserId: req.user.id,
      tags: tags && typeof tags === 'string' ? tags.split(',') : (Array.isArray(tags) ? tags : []),
    });

    try {
      await logAudit(req.user.id, 'upload_document', 'document', storedDoc.legacyId, { docType }, req.ip);
    } catch (auditErr) {
      console.error(`[DOC-UPLOAD][${requestId}] Audit logging failed:`, auditErr.message);
    }

    res.status(201).json(storedDoc);
  } catch (error) {
    console.error(`[DOC-UPLOAD][${requestId}] Error uploading document:`, error);
    res.status(500).json({ error: 'Failed to upload document' });
  }
});

// Get document file
router.get('/:id/file', requirePermission('patients:view_chart'), async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT file_path, filename, mime_type FROM documents WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const doc = result.rows[0];
    let actualPath;
    if (doc.file_path.startsWith('/uploads/') || doc.file_path.startsWith('/api/uploads/')) {
      const relativePath = doc.file_path.replace(/^\/api/, '').replace(/^\/uploads\//, '');
      actualPath = path.join(uploadDir, relativePath);
    } else {
      actualPath = doc.file_path;
    }

    if (!fs.existsSync(actualPath)) {
      return res.status(404).json({ error: 'File not found on disk' });
    }

    res.setHeader('Content-Type', doc.mime_type || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${doc.filename}"`);
    res.sendFile(path.resolve(actualPath));
  } catch (error) {
    console.error('Error fetching document file:', error);
    res.status(500).json({ error: 'Failed to fetch document' });
  }
});

// Update document (for comments and review status)
router.put('/:id', requirePermission('patients:view_chart'), async (req, res) => {
  try {
    const { id } = req.params;
    const { reviewed, comment, visit_id } = req.body;

    const updatesObj = {};
    if (visit_id !== undefined) updatesObj.visit_id = visit_id;
    if (reviewed !== undefined) {
      updatesObj.reviewed = reviewed;
      if (reviewed) {
        updatesObj.reviewed_at = new Date().toISOString();
        updatesObj.reviewed_by = req.user.id;
      }
    }

    if (comment !== undefined) {
      const currentDoc = await pool.query('SELECT comments FROM documents WHERE id = $1', [id]);
      if (currentDoc.rows.length === 0) return res.status(404).json({ error: 'Document not found' });

      let existingComments = currentDoc.rows[0].comments || [];
      if (typeof existingComments === 'string') {
        try { existingComments = JSON.parse(existingComments); } catch (e) { existingComments = []; }
      }
      if (!Array.isArray(existingComments)) existingComments = [];

      const newComment = {
        comment: comment.trim(),
        timestamp: new Date().toISOString(),
        userId: req.user.id,
        userName: `${req.user.first_name} ${req.user.last_name}` || 'Unknown'
      };

      updatesObj.comments = JSON.stringify([...existingComments, newComment]);
      updatesObj.comment = comment.trim();
    }

    if (Object.keys(updatesObj).length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    const result = await DocumentStoreService.updateDocument(pool, id, updatesObj, req.user.id);

    if (!result) {
      return res.status(404).json({ error: 'Document not found' });
    }

    await logAudit(req.user.id, 'update_document', 'document', id, { reviewed }, req.ip);
    res.json(result);
  } catch (error) {
    console.error('Error updating document:', error);
    res.status(500).json({ error: 'Failed to update document' });
  }
});

// Delete document
router.delete('/:id', requirePermission('patients:view_chart'), async (req, res) => {
  try {
    const { id } = req.params;
    const result = await DocumentStoreService.deleteDocument(pool, id, req.user.id, true);

    if (!result) {
      return res.status(404).json({ error: 'Document not found' });
    }

    await logAudit(req.user.id, 'delete_document', 'document', id, {}, req.ip);
    res.json({ message: 'Document deleted' });
  } catch (error) {
    console.error('Error deleting document:', error);
    res.status(500).json({ error: 'Failed to delete document' });
  }
});

module.exports = router;
