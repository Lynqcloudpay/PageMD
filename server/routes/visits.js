const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authenticate, requireRole, logAudit } = require('../middleware/auth');
const { requirePrivilege } = require('../middleware/authorization');
const { safeLogger } = require('../middleware/phiRedaction');

// All routes require authentication
router.use(authenticate);

// Get all visits (with filters)
router.get('/', requirePrivilege('visit:view'), async (req, res) => {
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
router.get('/pending', requirePrivilege('visit:view'), async (req, res) => {
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
router.post('/find-or-create', requireRole('clinician'), async (req, res) => {
  try {
    const { patientId, visitType, forceNew } = req.body;

    if (!patientId) {
      return res.status(400).json({ error: 'patientId is required' });
    }

    if (!req.user || !req.user.id) {
      console.error('User not authenticated in find-or-create');
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const providerId = req.user.id;

    // If forceNew is true, skip the search and create a new visit
    if (!forceNew) {
      // Try to find existing unsigned visit for today BY THIS USER
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const existingResult = await pool.query(
        `SELECT * FROM visits 
         WHERE patient_id = $1 
         AND visit_date >= $2 
         AND visit_date < $3
         AND provider_id = $4
         AND note_signed_at IS NULL
         ORDER BY created_at DESC
         LIMIT 1`,
        [patientId, today, tomorrow, providerId]
      );

      if (existingResult.rows.length > 0) {
        return res.json(existingResult.rows[0]);
      }
    }

    // Create new visit
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

// Helper function to check if a column exists
async function columnExists(client, tableName, columnName) {
  const r = await client.query(
    `
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = $1 AND column_name = $2
    LIMIT 1
    `,
    [tableName, columnName]
  );
  return r.rows.length > 0;
}

// Sign visit - MUST come before /:id
router.post('/:id/sign', requireRole('clinician'), async (req, res) => {
  const startTime = Date.now();
  const client = await pool.connect();

  // Hard timeout to prevent hanging forever
  const killTimeout = setTimeout(() => {
    console.error('[SIGN] ❌ HARD TIMEOUT HIT - Request hanging for 25+ seconds');
    console.error('[SIGN] Visit ID:', req.params.id);
    console.error('[SIGN] User ID:', req.user?.id);
    if (!res.headersSent) {
      res.status(500).json({
        error: 'Sign operation timed out',
        message: 'The sign operation took too long and was cancelled',
        timeout: true
      });
    }
  }, 25000);

  const step = (label) => {
    const elapsed = Date.now() - startTime;
    console.log(`[SIGN] ${label} (+${elapsed}ms)`);
  };

  try {
    step('BEGIN - Request received');
    const { id } = req.params;

    // Log request payload for debugging
    console.log('📝 SIGN NOTE REQUEST:', {
      visitId: id,
      noteDraftLength: req.body?.noteDraft?.length || req.body?.note_draft?.length || 0,
      hasVitals: !!req.body?.vitals,
      vitalsKeys: req.body?.vitals ? Object.keys(req.body.vitals) : [],
      userId: req.user?.id
    });

    // Set database timeouts to prevent hanging
    step('Setting DB timeouts');
    await client.query(`SET LOCAL statement_timeout = '10s'`);
    await client.query(`SET LOCAL lock_timeout = '5s'`);

    // Handle both noteDraft (camelCase from frontend) and note_draft (snake_case)
    const { noteDraft, note_draft, vitals } = req.body;
    const noteDraftValue = noteDraft || note_draft;

    // Allow empty noteDraft (it might be an empty note)
    const noteDraftToSave = noteDraftValue || '';

    // Get visit to find patient_id for snapshot
    const visitCheck = await pool.query('SELECT patient_id FROM visits WHERE id = $1', [id]);
    if (visitCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Visit not found' });
    }
    const patientId = visitCheck.rows[0].patient_id;

    // Capture snapshot of patient data at time of signing (for legal immutability)
    step('Starting patient snapshot capture');
    let patientSnapshot = null;
    try {
      const [allergiesRes, medicationsRes, problemsRes, familyHistoryRes, socialHistoryRes] = await Promise.all([
        client.query('SELECT * FROM allergies WHERE patient_id = $1', [patientId]).catch(() => ({ rows: [] })),
        client.query('SELECT * FROM medications WHERE patient_id = $1', [patientId]).catch(() => ({ rows: [] })),
        client.query('SELECT * FROM problems WHERE patient_id = $1', [patientId]).catch(() => ({ rows: [] })),
        client.query('SELECT * FROM family_history WHERE patient_id = $1', [patientId]).catch(() => ({ rows: [] })),
        client.query('SELECT * FROM social_history WHERE patient_id = $1', [patientId]).catch(() => ({ rows: [] }))
      ]);

      patientSnapshot = JSON.stringify({
        allergies: allergiesRes.rows || [],
        medications: medicationsRes.rows || [],
        problems: problemsRes.rows || [],
        familyHistory: familyHistoryRes.rows || [],
        socialHistory: socialHistoryRes.rows[0] || null,
        capturedAt: new Date().toISOString()
      });
      step('Patient snapshot captured');
    } catch (snapshotError) {
      step(`⚠️ Snapshot error (non-fatal): ${snapshotError.message}`);
      // Continue without snapshot - better than failing the sign operation
      patientSnapshot = null;
    }


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

    step('Starting database UPDATE');
    let result;
    try {
      // Check if patient_snapshot column exists (make it optional)
      const hasSnapshotColumn = await columnExists(client, 'visits', 'patient_snapshot');
      if (!hasSnapshotColumn && patientSnapshot) {
        console.warn('[SIGN] visits.patient_snapshot column missing; skipping snapshot write');
      }

      // If vitals are provided, include them in the update
      if (vitalsValue !== null) {
        step('Updating with vitals');
        if (hasSnapshotColumn && patientSnapshot) {
          result = await client.query(
            `UPDATE visits 
             SET note_draft = $1, 
                 vitals = $4,
                 patient_snapshot = $5,
                 note_signed_at = CURRENT_TIMESTAMP,
                 note_signed_by = $3,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $2 
             RETURNING *`,
            [noteDraftToSave, id, req.user.id, vitalsValue, patientSnapshot]
          );
        } else {
          // Skip patient_snapshot if column doesn't exist
          result = await client.query(
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
        }
      } else {
        step('Updating without vitals');
        if (hasSnapshotColumn && patientSnapshot) {
          result = await client.query(
            `UPDATE visits 
             SET note_draft = $1, 
                 patient_snapshot = $4,
                 note_signed_at = CURRENT_TIMESTAMP,
                 note_signed_by = $3,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $2 
             RETURNING *`,
            [noteDraftToSave, id, req.user.id, patientSnapshot]
          );
        } else {
          // Skip patient_snapshot if column doesn't exist
          result = await client.query(
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
      }
      step('Database UPDATE completed');
    } catch (dbError) {
      step(`Database error: ${dbError.code} - ${dbError.message}`);
      if (dbError.code === '22P02') { // Invalid UUID format
        step('Retrying with text cast');
        // Check if patient_snapshot column exists
        const hasSnapshotColumn = await columnExists(client, 'visits', 'patient_snapshot');

        if (vitalsValue !== null) {
          if (hasSnapshotColumn && patientSnapshot) {
            result = await client.query(
              `UPDATE visits 
               SET note_draft = $1, 
                   vitals = $4,
                   patient_snapshot = $5,
                   note_signed_at = CURRENT_TIMESTAMP,
                   note_signed_by = $3,
                   updated_at = CURRENT_TIMESTAMP
               WHERE id::text = $2 OR CAST(id AS TEXT) = $2
               RETURNING *`,
              [noteDraftToSave, id, req.user.id, vitalsValue, patientSnapshot]
            );
          } else {
            result = await client.query(
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
          }
        } else {
          if (hasSnapshotColumn && patientSnapshot) {
            result = await client.query(
              `UPDATE visits 
               SET note_draft = $1, 
                   patient_snapshot = $4,
                   note_signed_at = CURRENT_TIMESTAMP,
                   note_signed_by = $3,
                   updated_at = CURRENT_TIMESTAMP
               WHERE id::text = $2 OR CAST(id AS TEXT) = $2
               RETURNING *`,
              [noteDraftToSave, id, req.user.id, patientSnapshot]
            );
          } else {
            result = await client.query(
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
        }
      } else {
        throw dbError;
      }
    }

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Visit not found' });
    }

    // Auto-add assessments to problems list when note is signed
    try {
      // Parse assessment section from note draft
      const assessmentMatch = noteDraftToSave.match(/Assessment:\s*([\s\S]*?)(?=\n\nPlan:|$)/i);
      if (assessmentMatch && assessmentMatch[1]) {
        const assessmentText = assessmentMatch[1].trim();
        const assessmentLines = assessmentText.split('\n').filter(line => line.trim());

        for (const line of assessmentLines) {
          const trimmedLine = line.trim();
          if (!trimmedLine) continue;

          // Parse ICD-10 format: "Code - Description" or just "Description"
          const codeMatch = trimmedLine.match(/^([A-Z]\d{2}(?:\.\d+)?)\s*-\s*(.+)$/);
          let icd10Code = null;
          let problemName = trimmedLine;

          if (codeMatch) {
            icd10Code = codeMatch[1].trim();
            problemName = codeMatch[2].trim();
          } else {
            // Try to extract code from beginning if present
            const codeAtStart = trimmedLine.match(/^([A-Z]\d{2}(?:\.\d+)?)\s+(.+)$/);
            if (codeAtStart) {
              icd10Code = codeAtStart[1].trim();
              problemName = codeAtStart[2].trim();
            }
          }

          // Check if problem already exists for this patient (by code or name)
          const existingProblem = await client.query(
            `SELECT id FROM problems 
             WHERE patient_id = $1 
             AND (
               (icd10_code IS NOT NULL AND icd10_code = $2) 
               OR (problem_name = $3 AND icd10_code IS NULL)
             )
             AND status = 'active'`,
            [patientId, icd10Code || '', problemName]
          );

          if (existingProblem.rows.length === 0 && problemName) {
            // Add new problem
            try {
              await client.query(
                `INSERT INTO problems (patient_id, problem_name, icd10_code, status, onset_date)
                 VALUES ($1, $2, $3, 'active', CURRENT_DATE)`,
                [patientId, problemName, icd10Code || null]
              );
            } catch (insertError) {
              // Ignore duplicate key errors (problem already exists)
              if (insertError.code !== '23505') {
                console.warn('Error inserting problem:', insertError.message);
              }
            }
          }
        }
      }
    } catch (problemError) {
      // Log error but don't fail the sign operation
      console.error('Error auto-adding assessments to problems (non-fatal):', problemError);
    }

    step('Preparing response');

    // Non-blocking audit log (fire and forget - don't wait for it)
    logAudit(req.user.id, 'sign_visit', 'visit', id, {}, req.ip).catch(err => {
      console.warn('⚠️ Audit log error (non-fatal):', err.message);
    });

    const duration = Date.now() - startTime;
    step(`RESPOND 200 - Total time: ${duration}ms`);

    clearTimeout(killTimeout);
    res.json(result.rows[0]);
  } catch (error) {
    const duration = Date.now() - startTime;
    step(`ERROR: ${error.message} (code: ${error.code})`);
    console.error('❌ ERROR signing visit:', {
      visitId: req.params.id,
      duration: `${duration}ms`,
      message: error.message,
      code: error.code,
      detail: error.detail,
      constraint: error.constraint,
      table: error.table,
      column: error.column,
      stack: error.stack
    });
    safeLogger.error('Error signing visit', {
      message: error.message,
      code: error.code,
      visitId: req.params.id,
      requestBody: req.bodyForLogging || req.body,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
    clearTimeout(killTimeout);
    if (!res.headersSent) {
      res.status(500).json({
        error: 'Failed to sign visit',
        message: error.message,
        code: error.code,
        details: process.env.NODE_ENV === 'development' ? {
          code: error.code,
          detail: error.detail,
          constraint: error.constraint,
          table: error.table,
          column: error.column,
          duration: `${duration}ms`
        } : undefined
      });
    }
  } finally {
    client.release();
    step('Client released');
  }
});

// Generate AI summary for a visit - MUST come before /:id
router.post('/:id/summary', requireRole('clinician'), async (req, res) => {
  try {
    const { id } = req.params;

    // Check if note is signed - prevent editing note_draft after signing
    const noteDraftValue = req.body.note_draft !== undefined ? req.body.note_draft : req.body.noteDraft;
    if (noteDraftValue !== undefined) {
      const existingVisit = await pool.query('SELECT note_signed_at FROM visits WHERE id = $1', [id]);
      if (existingVisit.rows.length > 0 && existingVisit.rows[0].note_signed_at) {
        return res.status(403).json({
          error: 'Cannot edit signed notes. Once a note is signed, it cannot be modified.'
        });
      }
    }

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
router.get('/:id', requirePrivilege('visit:view'), async (req, res) => {
  try {
    const { id } = req.params;

    // Check if note is signed - prevent editing note_draft after signing
    const noteDraftValue = req.body.note_draft !== undefined ? req.body.note_draft : req.body.noteDraft;
    if (noteDraftValue !== undefined) {
      const existingVisit = await pool.query('SELECT note_signed_at FROM visits WHERE id = $1', [id]);
      if (existingVisit.rows.length > 0 && existingVisit.rows[0].note_signed_at) {
        return res.status(403).json({
          error: 'Cannot edit signed notes. Once a note is signed, it cannot be modified.'
        });
      }
    }


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
router.post('/', requireRole('clinician'), async (req, res) => {
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
router.put('/:id', requireRole('clinician'), async (req, res) => {
  try {
    const { id } = req.params;

    // Check if note is signed - prevent editing note_draft after signing
    const noteDraftValue = req.body.note_draft !== undefined ? req.body.note_draft : req.body.noteDraft;
    if (noteDraftValue !== undefined) {
      const existingVisit = await pool.query('SELECT note_signed_at FROM visits WHERE id = $1', [id]);
      if (existingVisit.rows.length > 0 && existingVisit.rows[0].note_signed_at) {
        return res.status(403).json({
          error: 'Cannot edit signed notes. Once a note is signed, it cannot be modified.'
        });
      }
    }


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
router.post('/:id/addendum', requireRole('clinician'), async (req, res) => {
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
    let existingAddendums = [];
    if (visit.addendums) {
      try {
        if (Array.isArray(visit.addendums)) {
          existingAddendums = visit.addendums;
        } else if (typeof visit.addendums === 'string') {
          existingAddendums = JSON.parse(visit.addendums);
        }
      } catch (parseError) {
        console.error('Error parsing existing addendums:', parseError);
        // If parsing fails, start with empty array
        existingAddendums = [];
      }
    }

    // Add new addendum with timestamp and user (initially unsigned)
    const userName = req.user ?
      `${req.user.first_name || ''} ${req.user.last_name || ''}`.trim() || 'Provider' :
      'Provider';

    const newAddendum = {
      text: addendumText.trim(),
      addedBy: req.user ? req.user.id : null,
      addedByName: userName,
      addedAt: new Date().toISOString(),
      signed: false,
      signedBy: null,
      signedByName: null,
      signedAt: null
    };

    existingAddendums.push(newAddendum);

    // Update visit with addendums
    // PostgreSQL JSONB accepts JavaScript objects directly - pg will handle conversion
    console.log('Adding addendum. Existing addendums count:', existingAddendums.length);
    console.log('New addendum:', JSON.stringify(newAddendum, null, 2));

    const result = await pool.query(
      `UPDATE visits 
       SET addendums = $1::jsonb, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2 
       RETURNING *`,
      [JSON.stringify(existingAddendums), id]
    );

    if (result.rows.length === 0) {
      console.error('Visit not found after update. Visit ID:', id);
      return res.status(404).json({ error: 'Visit not found after update' });
    }

    // Parse addendums back from JSONB if needed
    const updatedVisit = result.rows[0];
    if (updatedVisit.addendums && typeof updatedVisit.addendums === 'string') {
      try {
        updatedVisit.addendums = JSON.parse(updatedVisit.addendums);
      } catch (parseErr) {
        console.error('Error parsing addendums from response:', parseErr);
      }
    }

    console.log('Addendum added successfully. Total addendums:', updatedVisit.addendums?.length || 0);

    // Log audit (non-blocking - don't fail if audit fails)
    try {
      if (req.user && req.user.id) {
        await logAudit(req.user.id, 'add_addendum', 'visit', id, { addendumCount: existingAddendums.length }, req.ip);
      }
    } catch (auditError) {
      console.error('Error logging audit for addendum (non-fatal):', auditError);
      // Continue even if audit fails
    }

    res.json(updatedVisit);
  } catch (error) {
    console.error('Error adding addendum:', error);
    console.error('Error stack:', error.stack);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      detail: error.detail,
      hint: error.hint
    });
    res.status(500).json({
      error: 'Failed to add addendum',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Sign addendum (makes it immutable - cannot be edited after signing)
router.post('/:id/addendum/:addendumIndex/sign', requireRole('clinician'), async (req, res) => {
  try {
    const { id, addendumIndex } = req.params;
    const index = parseInt(addendumIndex);

    if (isNaN(index) || index < 0) {
      return res.status(400).json({ error: 'Invalid addendum index' });
    }

    // Check if visit exists and is signed
    const visitResult = await pool.query('SELECT * FROM visits WHERE id = $1', [id]);
    if (visitResult.rows.length === 0) {
      return res.status(404).json({ error: 'Visit not found' });
    }

    const visit = visitResult.rows[0];
    if (!visit.note_signed_at && !visit.locked) {
      return res.status(400).json({ error: 'Can only sign addendums for signed notes' });
    }

    // Get existing addendums
    let existingAddendums = [];
    if (visit.addendums) {
      try {
        if (Array.isArray(visit.addendums)) {
          existingAddendums = visit.addendums;
        } else if (typeof visit.addendums === 'string') {
          existingAddendums = JSON.parse(visit.addendums);
        }
      } catch (parseError) {
        console.error('Error parsing existing addendums:', parseError);
        return res.status(400).json({ error: 'Invalid addendums data' });
      }
    }

    if (index >= existingAddendums.length) {
      return res.status(404).json({ error: 'Addendum not found' });
    }

    // Check if addendum is already signed
    if (existingAddendums[index].signed) {
      return res.status(400).json({ error: 'Addendum is already signed and cannot be modified' });
    }

    // Sign the addendum (make it immutable)
    const userName = (req.user && (req.user.first_name || req.user.last_name))
      ? `${req.user.first_name || ''} ${req.user.last_name || ''}`.trim()
      : 'Provider';

    existingAddendums[index] = {
      ...existingAddendums[index],
      signed: true,
      signedBy: req.user ? req.user.id : null,
      signedByName: userName,
      signedAt: new Date().toISOString()
    };

    // Update visit with signed addendum
    console.log('Signing addendum. Index:', index, 'Total addendums:', existingAddendums.length);
    console.log('Updated addendum:', JSON.stringify(existingAddendums[index], null, 2));

    // Ensure addendums is properly formatted as JSONB
    const addendumsJson = JSON.stringify(existingAddendums);
    console.log('Addendums JSON length:', addendumsJson.length);

    const result = await pool.query(
      `UPDATE visits 
       SET addendums = $1::jsonb, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2 
       RETURNING *`,
      [addendumsJson, id]
    );

    if (result.rows.length === 0) {
      console.error('Visit not found after update. Visit ID:', id);
      return res.status(404).json({ error: 'Visit not found after update' });
    }

    // Parse addendums back from JSONB if needed
    const updatedVisit = result.rows[0];
    if (updatedVisit.addendums && typeof updatedVisit.addendums === 'string') {
      try {
        updatedVisit.addendums = JSON.parse(updatedVisit.addendums);
      } catch (parseErr) {
        console.error('Error parsing addendums from response:', parseErr);
      }
    }

    console.log('Addendum signed successfully. Total addendums:', updatedVisit.addendums?.length || 0);

    // Log audit (non-blocking)
    try {
      if (req.user && req.user.id) {
        await logAudit(req.user.id, 'sign_addendum', 'visit', id, { addendumIndex: index }, req.ip);
      }
    } catch (auditError) {
      console.error('Error logging audit for addendum sign (non-fatal):', auditError);
    }

    res.json(updatedVisit);
  } catch (error) {
    console.error('Error signing addendum:', error);
    res.status(500).json({
      error: 'Failed to sign addendum',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Delete visit
router.delete('/:id', requireRole('clinician'), async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const { id } = req.params;

    // Check if visit exists and if it's signed
    const existingVisit = await client.query(
      'SELECT id, note_signed_at, patient_id FROM visits WHERE id = $1',
      [id]
    );

    if (existingVisit.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Visit not found' });
    }

    const visit = existingVisit.rows[0];

    // Prevent deletion of signed visits
    if (visit.note_signed_at) {
      await client.query('ROLLBACK');
      return res.status(403).json({
        error: 'Cannot delete signed visits. Once a visit is signed, it cannot be deleted.'
      });
    }

    // Delete associated records first (they're just draft records for unsigned visits)
    // IMPORTANT: Check if tables exist before deleting to avoid transaction abort

    // Helper function to check if a table exists
    const tableExists = async (tableName) => {
      const result = await client.query(
        `SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = $1)`,
        [tableName]
      );
      return result.rows[0].exists;
    };

    let orderCount = 0;
    let referralCount = 0;
    let documentCount = 0;

    // 1. Delete order_diagnoses for orders first (if table exists)
    if (await tableExists('order_diagnoses') && await tableExists('orders')) {
      await client.query(`
        DELETE FROM order_diagnoses 
        WHERE order_id IN (SELECT id FROM orders WHERE visit_id = $1)
      `, [id]);
    }

    // 2. Delete order_diagnoses for referrals (if tables exist)
    if (await tableExists('order_diagnoses') && await tableExists('referrals')) {
      await client.query(`
        DELETE FROM order_diagnoses 
        WHERE order_id IN (SELECT id FROM referrals WHERE visit_id = $1)
      `, [id]);
    }

    // 3. Delete orders (if table exists)
    if (await tableExists('orders')) {
      const ordersDeleteResult = await client.query('DELETE FROM orders WHERE visit_id = $1 RETURNING id', [id]);
      orderCount = ordersDeleteResult.rowCount || 0;
    }

    // 4. Delete referrals (if table exists)
    if (await tableExists('referrals')) {
      const referralsDeleteResult = await client.query('DELETE FROM referrals WHERE visit_id = $1 RETURNING id', [id]);
      referralCount = referralsDeleteResult.rowCount || 0;
    }

    // 5. Delete documents (if table exists)
    if (await tableExists('documents')) {
      const documentsDeleteResult = await client.query('DELETE FROM documents WHERE visit_id = $1 RETURNING id', [id]);
      documentCount = documentsDeleteResult.rowCount || 0;
    }

    // Now delete the visit
    const result = await client.query('DELETE FROM visits WHERE id = $1 RETURNING *', [id]);

    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Visit not found' });
    }

    await client.query('COMMIT');

    // Log audit
    try {
      await logAudit(req.user.id, 'delete_visit', 'visit', id, {
        patientId: visit.patient_id,
        ordersDeleted: orderCount,
        referralsDeleted: referralCount
      }, req.ip);
    } catch (auditError) {
      console.warn('Failed to log audit:', auditError.message);
      // Don't fail the deletion if audit logging fails
    }

    res.json({
      message: 'Visit deleted successfully',
      ordersDeleted: orderCount,
      referralsDeleted: referralCount,
      documentsDeleted: documentCount
    });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => { });
    console.error('Error deleting visit:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({
      error: 'Failed to delete visit',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    client.release();
  }
});

module.exports = router;
