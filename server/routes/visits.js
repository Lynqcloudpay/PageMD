const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authenticate, requireRole, logAudit } = require('../middleware/auth');
const { requirePermission } = require('../services/authorization');
const { safeLogger } = require('../middleware/phiRedaction');

// All routes require authentication
router.use(authenticate);

// Get all visits (with filters)
router.get('/', requirePermission('notes:view'), async (req, res) => {
  try {
    const { patientId, limit = 50, offset = 0 } = req.query;
    let query = `
      SELECT v.*, 
        u.first_name as provider_first_name, 
        u.last_name as provider_last_name,
        p.first_name as patient_first_name,
        p.last_name as patient_last_name,
        signed_by_user.first_name as signed_by_first_name,
        signed_by_user.last_name as signed_by_last_name
      FROM visits v
      LEFT JOIN users u ON v.provider_id = u.id
      LEFT JOIN patients p ON v.patient_id = p.id
      LEFT JOIN users signed_by_user ON v.note_signed_by = signed_by_user.id
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    if (patientId) {
      query += ` AND v.patient_id = $${paramIndex}`;
      params.push(patientId);
      paramIndex++;
    }

    query += ` ORDER BY v.visit_date DESC, v.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(parseInt(limit), parseInt(offset));

    // Debug logging in development
    if (process.env.NODE_ENV === 'development') {
      console.log('Visits query:', query);
      console.log('Query params:', params);
    }
    
    const result = await pool.query(query, params);
    
    if (process.env.NODE_ENV === 'development') {
      console.log('Visits query result count:', result.rows.length);
      if (result.rows.length > 0) {
        console.log('First visit ID:', result.rows[0].id);
      }
    }
    
    // Ensure all IDs are strings (UUIDs)
    const formattedRows = result.rows.map(row => ({
      ...row,
      id: String(row.id) // Ensure ID is always a string
    }));
    
    res.json(formattedRows);
  } catch (error) {
    console.error('Error fetching visits:', error);
    console.error('Error message:', error.message);
    console.error('Error code:', error.code);
    console.error('Error stack:', error.stack);
    res.status(500).json({ 
      error: 'Failed to fetch visits',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Get pending notes (unsigned/incomplete visits) - MUST come before /:id
router.get('/pending', requirePermission('notes:view'), async (req, res) => {
  try {
    const { providerId } = req.query;
    const currentUserId = req.user?.id;
    
    // Debug logging
    if (process.env.NODE_ENV === 'development') {
      console.log('Pending visits request - user:', req.user?.id, 'providerId:', providerId);
    }
    
    let query = `
      SELECT v.*, 
        u.first_name as provider_first_name, 
        u.last_name as provider_last_name,
        p.first_name as patient_first_name,
        p.last_name as patient_last_name,
        p.mrn as patient_mrn,
        signed_by_user.first_name as signed_by_first_name,
        signed_by_user.last_name as signed_by_last_name
      FROM visits v
      LEFT JOIN users u ON v.provider_id = u.id
      INNER JOIN patients p ON v.patient_id = p.id
      LEFT JOIN users signed_by_user ON v.note_signed_by = signed_by_user.id
      WHERE v.note_signed_at IS NULL 
        AND (v.note_draft IS NOT NULL AND v.note_draft != '')
    `;
    const params = [];
    let paramIndex = 1;

    if (providerId || currentUserId) {
      query += ` AND v.provider_id = $${paramIndex}`;
      params.push(providerId || currentUserId);
      paramIndex++;
    }

    query += ` ORDER BY v.visit_date DESC, v.created_at DESC`;

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching pending visits:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ 
      error: 'Failed to fetch pending visits',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Find or create visit - MUST come before /:id
router.post('/find-or-create', requirePermission('notes:create'), async (req, res) => {
  try {
    const { patientId, visitType } = req.body;
    
    if (!patientId) {
      return res.status(400).json({ error: 'patientId is required' });
    }

    if (!req.user || !req.user.id) {
      console.error('User not authenticated in find-or-create');
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Try to find existing unsigned visit for today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const existingResult = await pool.query(
      `SELECT * FROM visits 
       WHERE patient_id = $1 
       AND visit_date >= $2 
       AND visit_date < $3
       AND (note_signed_at IS NULL OR note_draft IS NULL OR note_draft = '')
       ORDER BY created_at DESC
       LIMIT 1`,
      [patientId, today, tomorrow]
    );

    if (existingResult.rows.length > 0) {
      return res.json(existingResult.rows[0]);
    }

    // Create new visit (created_by column doesn't exist, removed it)
    const providerId = req.user.id;
    if (!providerId) {
      console.error('Provider ID is missing:', req.user);
      return res.status(400).json({ error: 'Provider ID is missing' });
    }

    if (process.env.NODE_ENV === 'development') {
      console.log('Creating visit with:', { patientId, visitType, providerId });
    }

    // Validate UUIDs
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(patientId)) {
      console.error('Invalid patientId format:', patientId);
      return res.status(400).json({ error: 'Invalid patient ID format' });
    }
    if (!uuidRegex.test(providerId)) {
      console.error('Invalid providerId format:', providerId);
      return res.status(400).json({ error: 'Invalid provider ID format' });
    }

    const result = await pool.query(
      `INSERT INTO visits (patient_id, visit_date, visit_type, provider_id)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [patientId, new Date(), visitType || 'Office Visit', providerId]
    );

    // Try to log audit, but don't fail if it doesn't work
    try {
      await logAudit(req.user.id, 'create_visit', 'visit', result.rows[0].id, req.body, req.ip);
    } catch (auditError) {
      console.error('Failed to log audit (non-fatal):', auditError.message);
    }

    res.status(201).json(result.rows[0]);
  } catch (error) {
    safeLogger.error('Error finding or creating visit', {
      message: error.message,
      code: error.code,
      detail: error.detail,
      constraint: error.constraint,
      table: error.table,
      requestBody: req.bodyForLogging || req.body,
      userId: req.user?.id,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
    res.status(500).json({ 
      error: 'Failed to find or create visit',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Sign visit - MUST come before /:id
router.post('/:id/sign', requirePermission('notes:sign'), async (req, res) => {
  try {
    const { id } = req.params;
    // Handle both noteDraft (camelCase from frontend) and note_draft (snake_case)
    const { noteDraft, note_draft, vitals } = req.body;
    const noteDraftValue = noteDraft || note_draft;

    // Allow empty noteDraft (it might be an empty note)
    const noteDraftToSave = noteDraftValue || '';

    // Handle vitals - preserve them when signing
    let vitalsValue = null;
    if (vitals !== undefined && vitals !== null) {
      // Check if vitals object has any actual values (excluding unit fields if they're the only ones)
      if (typeof vitals === 'object') {
        const vitalsToCheck = { ...vitals };
        // Remove unit fields for the check
        delete vitalsToCheck.weightUnit;
        delete vitalsToCheck.heightUnit;
        const hasVitalsData = Object.values(vitalsToCheck).some(val => val !== null && val !== '' && val !== undefined);
        if (hasVitalsData) {
          vitalsValue = JSON.stringify(vitals);
        }
      } else if (typeof vitals === 'string' && vitals.trim() !== '') {
        vitalsValue = vitals;
      }
    }

    if (process.env.NODE_ENV === 'development') {
      console.log('Signing visit:', { 
        id, 
        noteDraftLength: noteDraftToSave.length, 
        hasVitals: !!vitals,
        vitalsData: vitals,
        vitalsValue: vitalsValue ? (typeof vitalsValue === 'string' ? vitalsValue.substring(0, 100) : 'object') : null
      });
    }

    let result;
    try {
      // If vitals are provided, include them in the update
      if (vitalsValue !== null) {
        result = await pool.query(
          `UPDATE visits 
           SET note_draft = $1, 
               vitals = $4,
               note_signed_at = CURRENT_TIMESTAMP,
               note_signed_by = $3,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $2 
           RETURNING *`,
          [noteDraftToSave, id, req.user.id, vitalsValue]
        );
      } else {
        result = await pool.query(
          `UPDATE visits 
           SET note_draft = $1, 
               note_signed_at = CURRENT_TIMESTAMP,
               note_signed_by = $3,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $2 
           RETURNING *`,
          [noteDraftToSave, id, req.user.id]
        );
      }
    } catch (dbError) {
      if (dbError.code === '22P02') { // Invalid UUID format
        if (vitalsValue !== null) {
          result = await pool.query(
            `UPDATE visits 
             SET note_draft = $1, 
                 vitals = $4,
                 note_signed_at = CURRENT_TIMESTAMP,
                 note_signed_by = $3,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id::text = $2 OR CAST(id AS TEXT) = $2
             RETURNING *`,
            [noteDraftToSave, id, req.user.id, vitalsValue]
          );
        } else {
          result = await pool.query(
            `UPDATE visits 
             SET note_draft = $1, 
                 note_signed_at = CURRENT_TIMESTAMP,
                 note_signed_by = $3,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id::text = $2 OR CAST(id AS TEXT) = $2
             RETURNING *`,
            [noteDraftToSave, id, req.user.id]
          );
        }
      } else {
        throw dbError;
      }
    }

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Visit not found' });
    }

    await logAudit(req.user.id, 'sign_visit', 'visit', id, {}, req.ip);

    res.json(result.rows[0]);
  } catch (error) {
    safeLogger.error('Error signing visit', {
      message: error.message,
      code: error.code,
      visitId: id,
      requestBody: req.bodyForLogging || req.body,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
    res.status(500).json({ error: 'Failed to sign visit', details: process.env.NODE_ENV === 'development' ? error.message : undefined });
  }
});

// Generate AI summary for a visit - MUST come before /:id
router.post('/:id/summary', requirePermission('notes:create'), async (req, res) => {
  try {
    const { id } = req.params;
    const visitResult = await pool.query('SELECT * FROM visits WHERE id = $1', [id]);
    
    if (visitResult.rows.length === 0) {
      return res.status(404).json({ error: 'Visit not found' });
    }

    const visit = visitResult.rows[0];
    const noteText = visit.note_draft || '';
    
    // Simple AI summary generation (you can replace this with OpenAI API call)
    // For now, we'll create a structured summary from the note
    const summary = generateSummary(noteText, visit);
    
    await logAudit(req.user.id, 'generate_summary', 'visit', id, {}, req.ip);
    
    res.json({ summary });
  } catch (error) {
    console.error('Error generating summary:', error);
    res.status(500).json({ error: 'Failed to generate summary' });
  }
});

// Helper function to generate summary from note text
function generateSummary(noteText, visit) {
  if (!noteText || !noteText.trim()) {
    return 'No note content available for summary.';
  }

  // Parse the note sections
  const sections = {
    cc: extractSection(noteText, /(?:Chief Complaint|CC):\s*(.+?)(?:\n\n|\n(?:HPI|History|ROS|Review|PE|Physical|Assessment|Plan):)/is),
    hpi: extractSection(noteText, /(?:HPI|History of Present Illness):\s*(.+?)(?:\n\n|\n(?:ROS|Review|PE|Physical|Assessment|Plan):)/is),
    ros: extractSection(noteText, /(?:ROS|Review of Systems):\s*(.+?)(?:\n\n|\n(?:PE|Physical|Assessment|Plan):)/is),
    pe: extractSection(noteText, /(?:PE|Physical Exam):\s*(.+?)(?:\n\n|\n(?:Assessment|Plan):)/is),
    assessment: extractSection(noteText, /(?:Assessment|A):\s*(.+?)(?:\n\n|\n(?:Plan|P):)/is),
    plan: extractSection(noteText, /(?:Plan|P):\s*(.+?)(?:\n\n|$)/is)
  };

  // Extract key information
  const chiefComplaint = sections.cc || 'Not specified';
  const keyFindings = extractKeyFindings(sections.hpi, sections.pe);
  const assessment = sections.assessment || 'No assessment documented';
  const plan = sections.plan || 'No plan documented';

  // Build summary
  let summary = `Chief Complaint: ${chiefComplaint}. `;
  
  if (keyFindings.positive.length > 0) {
    summary += `Pertinent Positives: ${keyFindings.positive.join('; ')}. `;
  }
  
  if (keyFindings.negative.length > 0) {
    summary += `Pertinent Negatives: ${keyFindings.negative.join('; ')}. `;
  }
  
  summary += `Assessment: ${assessment}. `;
  summary += `Plan: ${plan}.`;

  return summary;
}

function extractSection(text, regex) {
  const match = text.match(regex);
  return match ? match[1].trim() : null;
}

function extractKeyFindings(hpi, pe) {
  const positive = [];
  const negative = [];
  
  const text = `${hpi || ''} ${pe || ''}`.toLowerCase();
  
  // Look for positive findings (symptoms, abnormalities)
  const positivePatterns = [
    /\b(pain|painful|tender|swollen|red|fever|chills|cough|shortness of breath|dyspnea|nausea|vomiting|diarrhea|constipation|rash|lesion|mass|abnormal|decreased|increased|elevated|reduced)\b/gi,
    /\b(positive|present|abnormal|irregular|enlarged|distended)\b/gi
  ];
  
  // Look for negative findings (normal, no symptoms)
  const negativePatterns = [
    /\b(no\s+(pain|fever|chills|cough|shortness|dyspnea|nausea|vomiting|diarrhea|rash|lesion|mass|abnormal))\b/gi,
    /\b(normal|negative|clear|intact|unremarkable|within normal limits)\b/gi
  ];
  
  // Simple extraction - in production, use proper NLP or AI
  if (hpi) {
    const hpiLower = hpi.toLowerCase();
    if (hpiLower.includes('pain') || hpiLower.includes('fever') || hpiLower.includes('cough')) {
      positive.push('Symptoms documented in HPI');
    }
    if (hpiLower.includes('no ') && (hpiLower.includes('pain') || hpiLower.includes('fever'))) {
      negative.push('Denies significant symptoms');
    }
  }
  
  if (pe) {
    const peLower = pe.toLowerCase();
    if (peLower.includes('tender') || peLower.includes('abnormal') || peLower.includes('irregular')) {
      positive.push('Abnormal findings on exam');
    }
    if (peLower.includes('normal') || peLower.includes('clear') || peLower.includes('unremarkable')) {
      negative.push('Normal physical examination');
    }
  }
  
  return { positive, negative };
}

// Get visit by ID - MUST come after all specific routes
router.get('/:id', requirePermission('notes:view'), async (req, res) => {
  try {
    const { id } = req.params;
    
    // Handle both UUID and numeric IDs
    let result;
    try {
      result = await pool.query(
        `SELECT v.*, 
          u.first_name as provider_first_name, 
          u.last_name as provider_last_name,
          signed_by_user.first_name as signed_by_first_name,
          signed_by_user.last_name as signed_by_last_name
        FROM visits v
        LEFT JOIN users u ON v.provider_id = u.id
        LEFT JOIN users signed_by_user ON v.note_signed_by = signed_by_user.id
        WHERE v.id = $1`,
        [id]
      );
    } catch (dbError) {
      // If UUID format fails, try as integer (for legacy data)
      if (dbError.code === '22P02') { // Invalid UUID format
        result = await pool.query(
          `SELECT v.*, 
            u.first_name as provider_first_name, 
            u.last_name as provider_last_name,
            signed_by_user.first_name as signed_by_first_name,
            signed_by_user.last_name as signed_by_last_name
          FROM visits v
          LEFT JOIN users u ON v.provider_id = u.id
          LEFT JOIN users signed_by_user ON v.note_signed_by = signed_by_user.id
          WHERE v.id::text = $1 OR CAST(v.id AS TEXT) = $1`,
          [id]
        );
      } else {
        throw dbError;
      }
    }

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Visit not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching visit:', error);
    console.error('Error details:', error.message, error.stack);
    res.status(500).json({ error: 'Failed to fetch visit', details: process.env.NODE_ENV === 'development' ? error.message : undefined });
  }
});

// Create visit
router.post('/', requirePermission('notes:create'), async (req, res) => {
  try {
    const { patient_id, visit_date, visit_type, provider_id } = req.body;
    
    const result = await pool.query(
      `INSERT INTO visits (patient_id, visit_date, visit_type, provider_id)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [patient_id, visit_date || new Date(), visit_type || 'Office Visit', provider_id || req.user.id]
    );

    await logAudit(req.user.id, 'create_visit', 'visit', result.rows[0].id, req.body, req.ip);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating visit:', error);
    res.status(500).json({ error: 'Failed to create visit' });
  }
});

// Update visit
router.put('/:id', requirePermission('notes:edit'), async (req, res) => {
  try {
    const { id } = req.params;
    const { visit_date, visit_type, vitals, note_draft, note_signed_at, provider_id } = req.body;
    
    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (visit_date !== undefined) {
      updates.push(`visit_date = $${paramIndex++}`);
      values.push(visit_date);
    }
    if (visit_type !== undefined) {
      updates.push(`visit_type = $${paramIndex++}`);
      values.push(visit_type);
    }
    if (vitals !== undefined) {
      updates.push(`vitals = $${paramIndex++}`);
      values.push(typeof vitals === 'string' ? vitals : JSON.stringify(vitals));
    }
    // Handle both note_draft and noteDraft (camelCase from frontend)
    // Always save noteDraft if it's in the request, even if it's an empty string
    const noteDraftValue = req.body.note_draft !== undefined ? req.body.note_draft : req.body.noteDraft;
    if (noteDraftValue !== undefined) {
      updates.push(`note_draft = $${paramIndex++}`);
      values.push(noteDraftValue || ''); // Save empty string if null/undefined
      if (process.env.NODE_ENV === 'development') {
        console.log('Saving note_draft, length:', (noteDraftValue || '').length, 'characters');
      }
    } else {
      if (process.env.NODE_ENV === 'development') {
        safeLogger.debug('NoteDraft not in request body', { availableKeys: Object.keys(req.bodyForLogging || req.body) });
      }
    }
    if (note_signed_at !== undefined) {
      updates.push(`note_signed_at = $${paramIndex++}`);
      values.push(note_signed_at);
    }
    if (provider_id !== undefined) {
      updates.push(`provider_id = $${paramIndex++}`);
      values.push(provider_id);
    }

    // Ensure note_draft is included if it was already added above, or add it if missing
    // (This is a safety check - note_draft should already be handled above)

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);

    if (process.env.NODE_ENV === 'development') {
      console.log('Update visit query:', `UPDATE visits SET ${updates.join(', ')} WHERE id = $${paramIndex}`);
      console.log('Update values count:', values.length);
      console.log('Note draft in update:', noteDraftValue !== undefined ? 'YES' : 'NO');
    }

    const result = await pool.query(
      `UPDATE visits SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Visit not found' });
    }

    if (process.env.NODE_ENV === 'development') {
      console.log('Visit updated successfully. Saved note_draft length:', (result.rows[0].note_draft || '').length);
    }

    // Try to log audit, but don't fail if it doesn't work
    try {
      await logAudit(req.user.id, 'update_visit', 'visit', id, req.body, req.ip);
    } catch (auditError) {
      console.error('Failed to log audit (non-fatal):', auditError.message);
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating visit:', error);
    safeLogger.error('Error updating visit', {
      message: error.message,
      code: error.code,
      visitId: req.params.id,
      requestBody: req.bodyForLogging || req.body,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
    res.status(500).json({ error: 'Failed to update visit', details: process.env.NODE_ENV === 'development' ? error.message : undefined });
  }
});

// Add addendum to signed visit
router.post('/:id/addendum', requirePermission('notes:edit'), async (req, res) => {
  try {
    const { id } = req.params;
    const { addendumText } = req.body;
    
    if (!addendumText || !addendumText.trim()) {
      return res.status(400).json({ error: 'Addendum text is required' });
    }

    // Check if visit exists and is signed
    const visitResult = await pool.query('SELECT * FROM visits WHERE id = $1', [id]);
    if (visitResult.rows.length === 0) {
      return res.status(404).json({ error: 'Visit not found' });
    }

    const visit = visitResult.rows[0];
    if (!visit.note_signed_at && !visit.locked) {
      return res.status(400).json({ error: 'Can only add addendums to signed notes' });
    }

    // Get existing addendums or initialize
    const existingAddendums = visit.addendums ? (Array.isArray(visit.addendums) ? visit.addendums : JSON.parse(visit.addendums)) : [];
    
    // Add new addendum with timestamp and user
    const newAddendum = {
      text: addendumText.trim(),
      addedBy: req.user.id,
      addedByName: `${req.user.first_name || ''} ${req.user.last_name || ''}`.trim() || 'Provider',
      addedAt: new Date().toISOString()
    };
    
    existingAddendums.push(newAddendum);

    // Update visit with addendums
    const result = await pool.query(
      `UPDATE visits 
       SET addendums = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2 
       RETURNING *`,
      [JSON.stringify(existingAddendums), id]
    );

    await logAudit(req.user.id, 'add_addendum', 'visit', id, { addendumCount: existingAddendums.length }, req.ip);

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error adding addendum:', error);
    res.status(500).json({ error: 'Failed to add addendum' });
  }
});

// Delete visit
router.delete('/:id', requirePermission('notes:edit'), async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query('DELETE FROM visits WHERE id = $1 RETURNING *', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Visit not found' });
    }

    await logAudit(req.user.id, 'delete_visit', 'visit', id, {}, req.ip);

    res.json({ message: 'Visit deleted successfully' });
  } catch (error) {
    console.error('Error deleting visit:', error);
    res.status(500).json({ error: 'Failed to delete visit' });
  }
});

module.exports = router;
