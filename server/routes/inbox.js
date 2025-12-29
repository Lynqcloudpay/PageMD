const express = require('express');
const pool = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');
const { preparePatientForResponse } = require('../services/patientEncryptionService');

const router = express.Router();
router.use(authenticate);

// Get lab trend history for a specific test
router.get('/lab-trend/:patientId/:testName', requireRole('clinician', 'nurse', 'admin'), async (req, res) => {
  try {
    const { patientId, testName } = req.params;

    // Get all lab orders for this patient
    const labQuery = `
      SELECT o.*, 
             o.created_at as order_date
      FROM orders o
      WHERE o.patient_id = $1 AND o.order_type = 'lab'
      ORDER BY o.created_at DESC
    `;

    const labs = await pool.query(labQuery, [patientId]);

    // Extract values for the specific test from all labs
    const trendData = [];
    labs.rows.forEach(lab => {
      const payload = typeof lab.order_payload === 'string' ? JSON.parse(lab.order_payload) : lab.order_payload;
      if (!payload?.results) return;

      // Check if this lab contains the test we're looking for
      const results = payload.results;
      let testValue = null;
      let testUnit = null;
      let isAbnormal = false;

      if (Array.isArray(results)) {
        const testResult = results.find(r => {
          const name = (r.test || r.name || '').toLowerCase();
          return name.includes(testName.toLowerCase()) || testName.toLowerCase().includes(name);
        });
        if (testResult) {
          testValue = testResult.value || testResult.result;
          testUnit = testResult.unit || '';
          isAbnormal = testResult.flag && testResult.flag.toLowerCase() !== 'normal';
        }
      } else if (typeof results === 'object') {
        // Check if testName matches any key (case-insensitive)
        const testKey = Object.keys(results).find(key => {
          const formattedKey = key.replace(/([A-Z])/g, ' $1').toLowerCase();
          return formattedKey.includes(testName.toLowerCase()) || testName.toLowerCase().includes(formattedKey);
        });

        if (testKey) {
          const testResult = results[testKey];
          const isObject = typeof testResult === 'object' && testResult !== null;
          testValue = isObject ? (testResult.value || testResult.result) : testResult;
          testUnit = isObject ? (testResult.unit || '') : '';
          isAbnormal = isObject && testResult.flag && testResult.flag.toLowerCase() !== 'normal';
        }
      }

      if (testValue !== null && testValue !== undefined && testValue !== '') {
        trendData.push({
          date: lab.order_date,
          value: parseFloat(testValue) || testValue,
          unit: testUnit,
          isAbnormal: isAbnormal || payload.normal === false || payload.critical === true,
          testName: payload?.test_name || payload?.testName || 'Lab Test'
        });
      }
    });

    // Sort by date (oldest first for trend)
    trendData.sort((a, b) => new Date(a.date) - new Date(b.date));

    res.json(trendData);
  } catch (error) {
    console.error('Error fetching lab trend:', error);
    res.status(500).json({ error: 'Failed to fetch lab trend' });
  }
});

// Get all inbox items (labs, documents, imaging) for the current user
router.get('/', requireRole('clinician', 'nurse', 'admin'), async (req, res) => {
  try {
    const { type, status, limit = 100 } = req.query;

    const allItems = [];

    // Get all labs (from orders where order_type = 'lab')
    let labQuery = `
      SELECT o.*, 
             o.comments as comments,
             p.first_name as patient_first_name,
             p.last_name as patient_last_name,
             p.encryption_metadata as patient_encryption_metadata,
             p.mrn as patient_mrn,
             p.id as patient_id,
             u.first_name as ordered_by_first_name,
             u.last_name as ordered_by_last_name
      FROM orders o
      JOIN patients p ON o.patient_id = p.id
      LEFT JOIN users u ON o.ordered_by = u.id
      WHERE o.order_type = 'lab'
      AND (o.status NOT IN ('pending', 'ordered', 'sent') OR o.result_value IS NOT NULL)
    `;

    if (status === 'unreviewed') {
      labQuery += ` AND (o.reviewed IS NULL OR o.reviewed = false)`;
    } else if (status === 'reviewed') {
      labQuery += ` AND o.reviewed = true`;
    }

    labQuery += ` ORDER BY o.created_at DESC LIMIT $1`;

    const labs = await pool.query(labQuery, [parseInt(limit)]);

    // Process labs with decryption
    for (const lab of labs.rows) {
      const payload = typeof lab.order_payload === 'string' ? JSON.parse(lab.order_payload) : lab.order_payload;

      // Decrypt patient name
      const patientData = {
        first_name: lab.patient_first_name,
        last_name: lab.patient_last_name,
        encryption_metadata: lab.patient_encryption_metadata
      };
      const decryptedPatient = await preparePatientForResponse(patientData);

      allItems.push({
        id: lab.id,
        type: 'lab',
        patientId: lab.patient_id,
        patientName: `${decryptedPatient.first_name} ${decryptedPatient.last_name}`,
        mrn: lab.patient_mrn,
        visitId: lab.visit_id,
        title: payload?.test_name || payload?.testName || 'Lab Order',
        description: payload?.description || '',
        status: lab.status,
        reviewed: lab.reviewed || false,
        reviewedAt: lab.reviewed_at,
        reviewedBy: lab.reviewed_by,
        comment: lab.comment || '',
        comments: (() => {
          try {
            if (lab.comments) {
              const parsed = typeof lab.comments === 'string' ? JSON.parse(lab.comments) : lab.comments;
              // Ensure it's an array and return all comments
              return Array.isArray(parsed) ? parsed : [];
            }
            // If no comments array but legacy comment exists, include it
            if (lab.comment) {
              return [{
                comment: lab.comment,
                timestamp: lab.reviewed_at || lab.created_at,
                userId: lab.reviewed_by,
                userName: ''
              }];
            }
            return [];
          } catch (e) {
            console.error('Error parsing comments for lab:', lab.id, e);
            // Fallback to legacy comment if parsing fails
            return lab.comment ? [{
              comment: lab.comment,
              timestamp: lab.reviewed_at || lab.created_at,
              userId: lab.reviewed_by,
              userName: ''
            }] : [];
          }
        })(),
        createdAt: lab.created_at,
        orderedBy: lab.ordered_by_first_name && lab.ordered_by_last_name
          ? `${lab.ordered_by_first_name} ${lab.ordered_by_last_name}`
          : 'Unknown',
        orderData: payload
      });
    }

    // Get all imaging orders
    let imagingQuery = `
      SELECT o.*, 
             p.first_name as patient_first_name,
             p.last_name as patient_last_name,
             p.encryption_metadata as patient_encryption_metadata,
             p.mrn as patient_mrn,
             p.id as patient_id,
             u.first_name as ordered_by_first_name,
             u.last_name as ordered_by_last_name
      FROM orders o
      JOIN patients p ON o.patient_id = p.id
      LEFT JOIN users u ON o.ordered_by = u.id
      WHERE o.order_type = 'imaging'
      AND (o.status NOT IN ('pending', 'ordered', 'sent') OR o.result_value IS NOT NULL)
    `;

    if (status === 'unreviewed') {
      imagingQuery += ` AND (o.reviewed IS NULL OR o.reviewed = false)`;
    } else if (status === 'reviewed') {
      imagingQuery += ` AND o.reviewed = true`;
    }

    imagingQuery += ` ORDER BY o.created_at DESC LIMIT $1`;

    const imaging = await pool.query(imagingQuery, [parseInt(limit)]);
    for (const img of imaging.rows) {
      const payload = typeof img.order_payload === 'string' ? JSON.parse(img.order_payload) : img.order_payload;

      // Decrypt patient name
      const patientData = {
        first_name: img.patient_first_name,
        last_name: img.patient_last_name,
        encryption_metadata: img.patient_encryption_metadata
      };
      const decryptedPatient = await preparePatientForResponse(patientData);

      allItems.push({
        id: img.id,
        type: 'imaging',
        patientId: img.patient_id,
        patientName: `${decryptedPatient.first_name} ${decryptedPatient.last_name}`,
        mrn: img.patient_mrn,
        visitId: img.visit_id,
        title: payload?.study_name || payload?.studyName || 'Imaging Study',
        description: payload?.description || '',
        status: img.status,
        reviewed: img.reviewed || false,
        reviewedAt: img.reviewed_at,
        reviewedBy: img.reviewed_by,
        comment: img.comment || '',
        comments: (() => {
          try {
            if (img.comments) {
              const parsed = typeof img.comments === 'string' ? JSON.parse(img.comments) : img.comments;
              // Ensure it's an array and return all comments
              return Array.isArray(parsed) ? parsed : [];
            }
            // If no comments array but legacy comment exists, include it
            if (img.comment) {
              return [{
                comment: img.comment,
                timestamp: img.reviewed_at || img.created_at,
                userId: img.reviewed_by,
                userName: ''
              }];
            }
            return [];
          } catch (e) {
            console.error('Error parsing comments for imaging:', img.id, e);
            // Fallback to legacy comment if parsing fails
            return img.comment ? [{
              comment: img.comment,
              timestamp: img.reviewed_at || img.created_at,
              userId: img.reviewed_by,
              userName: ''
            }] : [];
          }
        })(),
        createdAt: img.created_at,
        orderedBy: img.ordered_by_first_name && img.ordered_by_last_name
          ? `${img.ordered_by_first_name} ${img.ordered_by_last_name}`
          : 'Unknown',
        orderData: payload
      });
    }

    // Get all documents
    let docQuery = `
      SELECT d.*, 
             p.first_name as patient_first_name,
             p.last_name as patient_last_name,
             p.encryption_metadata as patient_encryption_metadata,
             p.mrn as patient_mrn,
             p.id as patient_id,
             u.first_name as uploader_first_name,
             u.last_name as uploader_last_name
      FROM documents d
      JOIN patients p ON d.patient_id = p.id
      LEFT JOIN users u ON d.uploader_id = u.id
      WHERE 1=1
    `;

    if (type === 'imaging') {
      docQuery += ` AND d.doc_type = 'imaging'`;
    } else if (type === 'document') {
      docQuery += ` AND d.doc_type != 'imaging'`;
    }

    if (status === 'unreviewed') {
      docQuery += ` AND (d.reviewed IS NULL OR d.reviewed = false)`;
    } else if (status === 'reviewed') {
      docQuery += ` AND d.reviewed = true`;
    }

    docQuery += ` ORDER BY d.created_at DESC LIMIT $1`;

    const documents = await pool.query(docQuery, [parseInt(limit)]);
    for (const doc of documents.rows) {
      // Decrypt patient name
      const patientData = {
        first_name: doc.patient_first_name,
        last_name: doc.patient_last_name,
        encryption_metadata: doc.patient_encryption_metadata
      };
      const decryptedPatient = await preparePatientForResponse(patientData);

      allItems.push({
        id: doc.id,
        type: doc.doc_type === 'imaging' ? 'imaging' : 'document',
        patientId: doc.patient_id,
        patientName: `${decryptedPatient.first_name} ${decryptedPatient.last_name}`,
        mrn: doc.patient_mrn,
        title: doc.filename,
        description: doc.doc_type || 'Document',
        status: 'completed',
        reviewed: doc.reviewed || false,
        reviewedAt: doc.reviewed_at,
        reviewedBy: doc.reviewed_by,
        comment: doc.comment || '',
        comments: (() => {
          try {
            if (doc.comments) {
              const parsed = typeof doc.comments === 'string' ? JSON.parse(doc.comments) : doc.comments;
              // Ensure it's an array and return all comments
              return Array.isArray(parsed) ? parsed : [];
            }
            // If no comments array but legacy comment exists, include it
            if (doc.comment) {
              return [{
                comment: doc.comment,
                timestamp: doc.reviewed_at || doc.created_at,
                userId: doc.reviewed_by,
                userName: ''
              }];
            }
            return [];
          } catch (e) {
            console.error('Error parsing comments for document:', doc.id, e);
            // Fallback to legacy comment if parsing fails
            return doc.comment ? [{
              comment: doc.comment,
              timestamp: doc.reviewed_at || doc.created_at,
              userId: doc.reviewed_by,
              userName: ''
            }] : [];
          }
        })(),
        createdAt: doc.created_at,
        uploader: doc.uploader_first_name && doc.uploader_last_name
          ? `${doc.uploader_first_name} ${doc.uploader_last_name}`
          : 'Unknown',
        docData: doc
      });
    }

    // Sort all items by date (newest first)
    allItems.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    // Apply type filter if specified
    let filteredItems = allItems;
    if (type && type !== 'all') {
      filteredItems = allItems.filter(item => {
        if (type === 'lab') return item.type === 'lab';
        if (type === 'imaging') return item.type === 'imaging';
        if (type === 'document') return item.type === 'document';
        return true;
      });
    }

    res.json(filteredItems);
  } catch (error) {
    console.error('Error fetching inbox items:', error);
    res.status(500).json({ error: 'Failed to fetch inbox items' });
  }
});

// Mark item as reviewed
router.put('/:type/:id/reviewed', requireRole('clinician', 'nurse', 'admin'), async (req, res) => {
  try {
    const { type, id } = req.params;
    const { comment } = req.body;

    let result;

    // First, try to find if this is an order or document
    const orderCheck = await pool.query('SELECT id FROM orders WHERE id = $1', [id]);
    const isOrder = orderCheck.rows.length > 0;

    if (isOrder) {
      // Handling for orders (labs, imaging orders)
      const currentOrder = await pool.query('SELECT comments FROM orders WHERE id = $1', [id]);
      let existingComments = currentOrder.rows[0]?.comments || [];
      if (typeof existingComments === 'string') {
        try { existingComments = JSON.parse(existingComments); } catch (e) { existingComments = []; }
      }

      const newComment = {
        comment: comment?.trim() || 'Reviewed',
        timestamp: new Date().toISOString(),
        userId: req.user.id,
        userName: `${req.user.first_name} ${req.user.last_name}`
      };

      const updatedComments = [...existingComments, newComment];

      result = await pool.query(
        `UPDATE orders 
         SET reviewed = true, 
             reviewed_at = CURRENT_TIMESTAMP, 
             reviewed_by = $1,
             comments = $2,
             status = 'reviewed'
         WHERE id = $3 RETURNING *`,
        [req.user.id, JSON.stringify(updatedComments), id]
      );
    } else {
      // Handling for documents (uploaded imaging reports, etc.)
      const currentDoc = await pool.query('SELECT comments FROM documents WHERE id = $1', [id]);

      if (currentDoc.rows.length === 0) {
        return res.status(404).json({ error: 'Item not found in orders or documents' });
      }

      let existingComments = currentDoc.rows[0]?.comments || [];
      if (typeof existingComments === 'string') {
        try { existingComments = JSON.parse(existingComments); } catch (e) { existingComments = []; }
      }

      const newComment = {
        comment: comment?.trim() || 'Reviewed',
        timestamp: new Date().toISOString(),
        userId: req.user.id,
        userName: `${req.user.first_name} ${req.user.last_name}`
      };

      const updatedComments = [...existingComments, newComment];

      result = await pool.query(
        `UPDATE documents 
         SET reviewed = true, 
             reviewed_at = CURRENT_TIMESTAMP, 
             reviewed_by = $1,
             comments = $2
         WHERE id = $3 RETURNING *`,
        [req.user.id, JSON.stringify(updatedComments), id]
      );
    }

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Failed to update item' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error marking as reviewed:', error);
    res.status(500).json({ error: 'Failed to mark as reviewed' });
  }
});

// Save comment only (without marking as reviewed)
router.put('/:type/:id/comment', requireRole('clinician', 'nurse', 'admin'), async (req, res) => {
  try {
    const { type, id } = req.params;
    const { comment } = req.body;

    let result;

    // First, try to find if this is an order or document
    const orderCheck = await pool.query('SELECT id FROM orders WHERE id = $1', [id]);
    const isOrder = orderCheck.rows.length > 0;

    if (isOrder) {
      // Handling for orders
      const currentOrder = await pool.query('SELECT comments FROM orders WHERE id = $1', [id]);
      let existingComments = currentOrder.rows[0]?.comments || [];
      if (typeof existingComments === 'string') {
        try { existingComments = JSON.parse(existingComments); } catch (e) { existingComments = []; }
      }

      const newComment = {
        comment: comment?.trim() || 'Note saved',
        timestamp: new Date().toISOString(),
        userId: req.user.id,
        userName: `${req.user.first_name} ${req.user.last_name}`
      };

      const updatedComments = [...existingComments, newComment];

      result = await pool.query(
        `UPDATE orders 
         SET comments = $1
         WHERE id = $2 RETURNING *`,
        [JSON.stringify(updatedComments), id]
      );
    } else {
      // Handling for documents
      const currentDoc = await pool.query('SELECT comments FROM documents WHERE id = $1', [id]);

      if (currentDoc.rows.length === 0) {
        return res.status(404).json({ error: 'Item not found in orders or documents' });
      }

      let existingComments = currentDoc.rows[0]?.comments || [];
      if (typeof existingComments === 'string') {
        try { existingComments = JSON.parse(existingComments); } catch (e) { existingComments = []; }
      }

      const newComment = {
        comment: comment?.trim() || 'Note saved',
        timestamp: new Date().toISOString(),
        userId: req.user.id,
        userName: `${req.user.first_name} ${req.user.last_name}`
      };

      const updatedComments = [...existingComments, newComment];

      result = await pool.query(
        `UPDATE documents 
         SET comments = $1
         WHERE id = $2 RETURNING *`,
        [JSON.stringify(updatedComments), id]
      );
    }

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Failed to update item' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error saving comment:', error);
    res.status(500).json({ error: 'Failed to save comment' });
  }
});

module.exports = router;

