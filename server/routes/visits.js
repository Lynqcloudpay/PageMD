const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const pool = require('../db');
const { authenticate, requireRole, logAudit } = require('../middleware/auth');
const { requirePermission } = require('../services/authorization');

const { safeLogger } = require('../middleware/phiRedaction');
const { getTodayDateString } = require('../utils/timezone');
const { preparePatientForResponse } = require('../services/patientEncryptionService');

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
        p.encryption_metadata as patient_encryption_metadata,
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

    // Ensure all IDs are strings (UUIDs) and decrypt patient names
    const formattedRows = await Promise.all(result.rows.map(async row => {
      // Decrypt patient name
      const patientData = {
        first_name: row.patient_first_name,
        last_name: row.patient_last_name,
        encryption_metadata: row.patient_encryption_metadata
      };
      const decryptedPatient = await preparePatientForResponse(patientData);

      return {
        ...row,
        id: String(row.id), // Ensure ID is always a string
        patient_first_name: decryptedPatient.first_name,
        patient_last_name: decryptedPatient.last_name
      };
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
        p.encryption_metadata as patient_encryption_metadata,
        p.mrn as mrn,
        signed_by_user.first_name as signed_by_first_name,
        signed_by_user.last_name as signed_by_last_name
      FROM visits v
      LEFT JOIN users u ON v.provider_id = u.id
      INNER JOIN patients p ON v.patient_id = p.id
      LEFT JOIN users signed_by_user ON v.note_signed_by = signed_by_user.id
      WHERE v.note_signed_at IS NULL 
        AND (v.status = 'draft' OR v.status IS NULL)
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

    // Decrypt patient names
    const formattedRows = await Promise.all(result.rows.map(async row => {
      // Decrypt patient name
      const patientData = {
        first_name: row.patient_first_name,
        last_name: row.patient_last_name,
        encryption_metadata: row.patient_encryption_metadata
      };
      const decryptedPatient = await preparePatientForResponse(patientData);

      return {
        ...row,
        patient_first_name: decryptedPatient.first_name,
        patient_last_name: decryptedPatient.last_name
      };
    }));

    res.json(formattedRows);
  } catch (error) {
    console.error('Error fetching pending visits:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({
      error: 'Failed to fetch pending visits',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Get today's draft visit for a patient - MUST come before /:id
// Get today's draft note (single source of truth)
// GET /api/visits/today-draft/:patientId?providerId=...
router.get('/today-draft/:patientId', requirePermission('notes:view'), async (req, res) => {
  try {
    const { patientId } = req.params;
    const { providerId } = req.query;

    if (!patientId) {
      return res.status(400).json({ error: 'patientId is required' });
    }

    // Get today's date in clinic timezone (America/New_York)
    const todayDate = getTodayDateString();

    let query = `
      SELECT * FROM visits 
      WHERE patient_id = $1 
      AND (status = 'draft' OR status IS NULL)
      AND encounter_date = $2
      AND note_signed_at IS NULL
    `;
    const params = [patientId, todayDate];
    let paramIndex = 3;

    // Optional provider filter
    if (providerId) {
      query += ` AND provider_id = $${paramIndex}`;
      params.push(providerId);
      paramIndex++;
    }

    query += ` ORDER BY updated_at DESC LIMIT 1`;

    const result = await pool.query(query, params);

    if (result.rows.length > 0) {
      return res.json({ note: result.rows[0] });
    }

    return res.json({ note: null });
  } catch (error) {
    safeLogger.error('Error fetching today\'s draft visit', {
      message: error.message,
      code: error.code,
      patientId: req.params.patientId,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
    res.status(500).json({
      error: 'Failed to fetch today\'s draft visit',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Create or open today's draft note (idempotent)
// POST /api/visits/open-today/:patientId
router.post('/open-today/:patientId', requirePermission('notes:create'), async (req, res) => {
  const client = await pool.connect();

  try {
    const { patientId } = req.params;
    const { noteType = 'office_visit', providerId } = req.body;

    if (!patientId) {
      return res.status(400).json({ error: 'patientId is required' });
    }

    const actualProviderId = providerId || req.user.id;
    if (!actualProviderId) {
      return res.status(400).json({ error: 'providerId is required' });
    }

    // Get today's date in clinic timezone
    const todayDate = getTodayDateString();
    const now = new Date();

    await client.query('BEGIN');

    // Try to find today's draft (must be unsigned)
    // Allow any provider to open an existing draft (remove provider_id filter)
    const findQuery = `
      SELECT * FROM visits 
      WHERE patient_id = $1 
      AND status = 'draft'
      AND encounter_date = $2
      AND note_type = $3
      AND note_signed_at IS NULL
      ORDER BY updated_at DESC
      LIMIT 1
    `;

    const findResult = await client.query(findQuery, [
      patientId,
      todayDate,
      noteType
    ]);

    // If exists, return it
    if (findResult.rows.length > 0) {
      await client.query('COMMIT');
      return res.json({ note: findResult.rows[0] });
    }

    // Create new draft note
    // Note: The unique index will prevent duplicates if there's a race condition
    const insertQuery = `
      INSERT INTO visits (
        patient_id, 
        provider_id, 
        status, 
        note_type, 
        encounter_date,
        visit_date,
        created_at, 
        updated_at,
        clinic_id
      )
      VALUES ($1, $2, 'draft', $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;

    const insertResult = await client.query(insertQuery, [
      patientId,
      actualProviderId,
      noteType,
      todayDate,
      now,
      now,
      now,
      req.user?.clinic_id
    ]);

    await client.query('COMMIT');

    // Log audit
    req.logAuditEvent({
      action: 'NOTE_CREATED',
      entityType: 'Note',
      entityId: insertResult.rows[0].id,
      patientId,
      details: { noteType }
    });

    res.status(201).json({ note: insertResult.rows[0] });
  } catch (error) {
    await client.query('ROLLBACK');

    // Handle unique constraint violation (race condition)
    if (error.code === '23505' && error.constraint === 'idx_visits_unique_today_draft') {
      // Retry: fetch the existing note
      try {
        const todayDate = getTodayDateString();
        const retryResult = await pool.query(
          `SELECT * FROM visits 
           WHERE patient_id = $1 
           AND (status = 'draft' OR status IS NULL)
           AND encounter_date = $2
           AND provider_id = $3
           AND note_type = $4
           ORDER BY updated_at DESC
           LIMIT 1`,
          [req.params.patientId, todayDate, req.body.providerId || req.user.id, req.body.noteType || 'office_visit']
        );

        if (retryResult.rows.length > 0) {
          return res.json({ note: retryResult.rows[0] });
        }
      } catch (retryError) {
        // Fall through to error handling
      }
    }

    safeLogger.error('Error opening today\'s draft visit', {
      message: error.message,
      code: error.code,
      constraint: error.constraint,
      patientId: req.params.patientId,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });

    res.status(500).json({
      error: 'Failed to open today\'s draft visit',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    client.release();
  }
});

// Find or create visit - DEPRECATED: Use /open-today instead
// This endpoint is kept for backward compatibility but now uses the new schema
router.post('/find-or-create', requirePermission('notes:create'), async (req, res) => {
  const client = await pool.connect();

  try {
    const { patientId, visitType, forceNew } = req.body;
    const providerId = req.user?.id;

    // Validate inputs
    if (!patientId) {
      return res.status(400).json({ error: 'patientId is required' });
    }
    if (!providerId) {
      console.error('User not authenticated in find-or-create:', req.user);
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // Map old visitType to new note_type
    const noteTypeMap = {
      'Office Visit': 'office_visit',
      'Telephone': 'telephone',
      'Portal': 'portal',
      'Refill': 'refill',
      'Lab Only': 'lab_only',
      'Nurse Visit': 'nurse_visit'
    };
    const noteType = noteTypeMap[visitType] || 'office_visit';

    // Debug logging
    console.log('find-or-create debug', {
      patientId: req.body?.patientId,
      visitType: req.body?.visitType,
      forceNew: req.body?.forceNew,
      user: req.user ? { id: req.user.id, email: req.user.email } : null,
      providerId
    });

    // Get today's date in clinic timezone
    const todayDate = getTodayDateString();
    const now = new Date();

    await client.query('BEGIN');

    // If forceNew = false: try to find today's DRAFT for this patient
    if (!forceNew) {
      console.log('Searching for existing draft:', { patientId, todayDate, noteType });
      const existingResult = await client.query(
        `SELECT * FROM visits 
         WHERE patient_id = $1 
         AND (status = 'draft' OR status IS NULL)
         AND encounter_date = $2
         AND note_type = $3
         AND note_signed_at IS NULL
         ORDER BY updated_at DESC
         LIMIT 1`,
        [patientId, todayDate, noteType]
      );

      console.log('Existing draft query result:', { count: existingResult.rows.length, found: existingResult.rows[0]?.id });

      if (existingResult.rows.length > 0) {
        await client.query('COMMIT');
        console.log('Returning existing draft:', existingResult.rows[0].id);
        return res.json(existingResult.rows[0]);
      }
    }

    // Create new visit with new schema
    console.log('Creating new visit:', { patientId, providerId, noteType, todayDate, visitType: visitType || 'Office Visit' });
    const insertResult = await client.query(
      `INSERT INTO visits (
        patient_id, 
        visit_date, 
        visit_type, 
        provider_id,
        status,
        note_type,
        encounter_date,
        created_at,
        updated_at,
        clinic_id
      )
      VALUES ($1, $2, $3, $4, 'draft', $5, $6, $7, $8, $9) RETURNING *`,
      [patientId, now, visitType || 'Office Visit', providerId, noteType, todayDate, now, now, req.user?.clinic_id]
    );
    console.log('Created visit:', insertResult.rows[0]?.id);

    await client.query('COMMIT');

    // Try to log audit, but don't fail if it doesn't work
    req.logAuditEvent({
      action: 'NOTE_CREATED',
      entityType: 'Note',
      entityId: insertResult.rows[0].id,
      patientId,
      details: { noteType, legacy: true }
    });

    res.status(201).json(insertResult.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');

    // Handle unique constraint violation (race condition)
    if (error.code === '23505' && error.constraint === 'idx_visits_unique_today_draft') {
      // Retry: fetch the existing note
      try {
        const todayDate = getTodayDateString();
        const noteTypeMap = {
          'Office Visit': 'office_visit',
          'Telephone': 'telephone',
          'Portal': 'portal',
          'Refill': 'refill',
          'Lab Only': 'lab_only',
          'Nurse Visit': 'nurse_visit'
        };
        const noteType = noteTypeMap[req.body.visitType] || 'office_visit';

        const retryResult = await pool.query(
          `SELECT * FROM visits 
           WHERE patient_id = $1 
           AND (status = 'draft' OR status IS NULL)
           AND encounter_date = $2
           AND note_type = $3
           AND note_signed_at IS NULL
           ORDER BY updated_at DESC
           LIMIT 1`,
          [req.body.patientId, todayDate, noteType]
        );

        if (retryResult.rows.length > 0) {
          return res.json(retryResult.rows[0]);
        }
      } catch (retryError) {
        console.error('Retry failed:', retryError);
      }
    }

    // Log the REAL error with full details
    console.error('find-or-create visit error:', {
      message: error.message,
      code: error.code,
      detail: error.detail,
      constraint: error.constraint,
      table: error.table,
      where: error.where,
      stack: error.stack,
      patientId: req.body.patientId,
      providerId: req.user?.id,
      visitType: req.body.visitType,
      forceNew: req.body.forceNew
    });

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

    // Return error code and hint for debugging (temporarily)
    res.status(500).json({
      error: 'Failed to find or create visit',
      code: error.code || 'UNKNOWN_DB_ERROR',
      hint: error.hint || error.detail || error.message,
      constraint: error.constraint,
      table: error.table,
      column: error.column
    });
  } finally {
    client.release();
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

    // First, get the visit to find the patient_id
    const visitCheck = await pool.query('SELECT patient_id FROM visits WHERE id = $1', [id]);
    if (visitCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Visit not found' });
    }
    const patientId = visitCheck.rows[0].patient_id;

    // ============================================================
    // CLINICAL SNAPSHOT: Capture complete patient state at signing
    // This is frozen and cannot be changed after signing
    // ============================================================
    const patientEncryptionService = require('../services/patientEncryptionService');

    // Fetch all patient data for the snapshot
    const [
      patientRes,
      allergiesRes,
      medicationsRes,
      problemsRes,
      familyHistoryRes,
      socialHistoryRes,
      visitDocumentsRes
    ] = await Promise.all([
      pool.query('SELECT * FROM patients WHERE id = $1', [patientId]),
      pool.query('SELECT * FROM allergies WHERE patient_id = $1 AND active = true ORDER BY created_at DESC', [patientId]),
      pool.query('SELECT * FROM medications WHERE patient_id = $1 AND active = true ORDER BY created_at DESC', [patientId]),
      pool.query('SELECT * FROM problems WHERE patient_id = $1 AND status = $2 ORDER BY created_at DESC', [patientId, 'active']),
      pool.query('SELECT * FROM family_history WHERE patient_id = $1 ORDER BY created_at DESC', [patientId]),
      pool.query('SELECT * FROM social_history WHERE patient_id = $1 LIMIT 1', [patientId]),
      pool.query('SELECT id, filename, doc_type, tags, created_at, comment FROM documents WHERE visit_id = $1', [id])
    ]);

    // Decrypt patient PHI for the snapshot
    let patientData = patientRes.rows[0] || {};
    try {
      patientData = await patientEncryptionService.decryptPatientPHI(patientData);
    } catch (e) {
      console.warn('Failed to decrypt patient for snapshot, using raw data:', e.message);
    }

    // Build the clinical snapshot
    const clinicalSnapshot = {
      captured_at: new Date().toISOString(),
      captured_by: req.user.id,
      captured_by_name: `${req.user.first_name || ''} ${req.user.last_name || ''}`.trim(),

      // Patient Demographics (frozen at sign time)
      demographics: {
        first_name: patientData.first_name,
        last_name: patientData.last_name,
        middle_name: patientData.middle_name,
        dob: patientData.dob,
        sex: patientData.sex,
        mrn: patientData.mrn,
        phone: patientData.phone,
        email: patientData.email,
        address_line1: patientData.address_line1,
        address_line2: patientData.address_line2,
        city: patientData.city,
        state: patientData.state,
        zip: patientData.zip,
        insurance_provider: patientData.insurance_provider,
        insurance_id: patientData.insurance_id,
        pharmacy_name: patientData.pharmacy_name,
        pharmacy_phone: patientData.pharmacy_phone,
        emergency_contact_name: patientData.emergency_contact_name,
        emergency_contact_phone: patientData.emergency_contact_phone,
        emergency_contact_relationship: patientData.emergency_contact_relationship
      },

      // Allergies (frozen)
      allergies: (allergiesRes.rows || []).map(a => ({
        id: a.id, allergen: a.allergen, reaction: a.reaction, severity: a.severity, onset_date: a.onset_date
      })),

      // Medications (frozen)
      medications: (medicationsRes.rows || []).map(m => ({
        id: m.id, medication_name: m.medication_name, dosage: m.dosage, frequency: m.frequency, route: m.route, start_date: m.start_date
      })),

      // Problems (frozen)
      problems: (problemsRes.rows || []).map(p => ({
        id: p.id, problem_name: p.problem_name, icd_code: p.icd_code, onset_date: p.onset_date, status: p.status
      })),

      // Family History (frozen)
      family_history: (familyHistoryRes.rows || []).map(f => ({
        id: f.id, condition: f.condition, relationship: f.relationship, age_of_onset: f.age_of_onset
      })),

      // Social History (frozen)
      social_history: socialHistoryRes.rows[0] ? {
        smoking_status: socialHistoryRes.rows[0].smoking_status,
        alcohol_use: socialHistoryRes.rows[0].alcohol_use,
        occupation: socialHistoryRes.rows[0].occupation,
        exercise_frequency: socialHistoryRes.rows[0].exercise_frequency
      } : null,

      // Documents/Labs linked to this visit (frozen metadata)
      documents: (visitDocumentsRes.rows || []).map(d => ({
        id: d.id, filename: d.filename, doc_type: d.doc_type, tags: d.tags, created_at: d.created_at
      }))
    };

    // ============================================================
    // INTEGRITY HASH: Create a digital fingerprint of the signed content
    // ============================================================
    const snapshotJson = JSON.stringify(clinicalSnapshot);
    const hashPayload = `${id}|${patientId}|${noteDraftToSave}|${vitalsValue || ''}|${snapshotJson}|${req.user.id}`;
    const contentHash = crypto.createHash('sha256').update(hashPayload).digest('hex');

    let result;
    try {
      // If vitals are provided, include them in the update
      if (vitalsValue !== null) {
        result = await pool.query(
          `UPDATE visits 
           SET note_draft = $1, 
               vitals = $4,
               status = 'signed',
               note_signed_at = CURRENT_TIMESTAMP,
               note_signed_by = $3,
               clinical_snapshot = $5,
               content_hash = $6,
               content_integrity_verified = TRUE,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $2 
           RETURNING *`,
          [noteDraftToSave, id, req.user.id, vitalsValue, snapshotJson, contentHash]
        );
      } else {
        result = await pool.query(
          `UPDATE visits 
           SET note_draft = $1, 
               status = 'signed',
               note_signed_at = CURRENT_TIMESTAMP,
               note_signed_by = $3,
               clinical_snapshot = $4,
               content_hash = $5,
               content_integrity_verified = TRUE,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $2 
           RETURNING *`,
          [noteDraftToSave, id, req.user.id, snapshotJson, contentHash]
        );
      }
    } catch (dbError) {
      if (dbError.code === '22P02') { // Invalid UUID format
        if (vitalsValue !== null) {
          result = await pool.query(
            `UPDATE visits 
             SET note_draft = $1, 
                 vitals = $4,
                 status = 'signed',
                 note_signed_at = CURRENT_TIMESTAMP,
                 note_signed_by = $3,
                 clinical_snapshot = $5,
                 content_hash = $6,
                 content_integrity_verified = TRUE,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id::text = $2 OR CAST(id AS TEXT) = $2
             RETURNING *`,
            [noteDraftToSave, id, req.user.id, vitalsValue, JSON.stringify(clinicalSnapshot), contentHash]
          );
        } else {
          result = await pool.query(
            `UPDATE visits 
             SET note_draft = $1, 
                 status = 'signed',
                 note_signed_at = CURRENT_TIMESTAMP,
                 note_signed_by = $3,
                 clinical_snapshot = $4,
                 content_hash = $5,
                 content_integrity_verified = TRUE,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id::text = $2 OR CAST(id AS TEXT) = $2
             RETURNING *`,
            [noteDraftToSave, id, req.user.id, JSON.stringify(clinicalSnapshot), contentHash]
          );
        }
      } else {
        throw dbError;
      }
    }

    const visit = result.rows[0];

    // Commercial-Grade Audit Logging
    if (req.logAuditEvent) {
      req.logAuditEvent({
        action: 'NOTE_SIGNED',
        entityType: 'Note',
        entityId: id,
        patientId: visit.patient_id,
        encounterId: id,
        details: {
          note_type: visit.visit_type,
          signed_at: visit.note_signed_at
        }
      });
    }

    res.json(visit);
  } catch (error) {
    safeLogger.error('Error signing visit', {
      message: error.message,
      code: error.code,
      visitId: req.params.id,
      requestBody: req.bodyForLogging || req.body,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
    res.status(500).json({ error: 'Failed to sign visit', details: process.env.NODE_ENV === 'development' ? error.message : undefined });
  }
});

/**
 * Commercial-Grade Note Retraction (Entered-in-Error)
 * Signed notes cannot be truly deleted. They are retracted/voided.
 */
router.post('/:id/retract', requirePermission('notes:edit'), async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { reason_code, reason_text } = req.body;

    if (!reason_code || !reason_text) {
      return res.status(400).json({ error: 'Reason code and explanation text are required for retraction' });
    }

    await client.query('BEGIN');

    // 1. Get the visit and verify it can be retracted
    const visitRes = await client.query('SELECT status, note_signed_at, patient_id, clinic_id FROM visits WHERE id = $1', [id]);
    if (visitRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Visit not found' });
    }

    const visit = visitRes.rows[0];

    // Safety check: Only signed notes should use the retraction workflow
    // Unsigned notes can be hard-deleted or cancelled normally
    if (visit.status !== 'signed' && !visit.note_signed_at) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Note must be signed before it can be retracted. For drafts, use the delete action.' });
    }

    if (visit.status === 'retracted') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Note is already retracted' });
    }

    // 2. Perform Retraction
    // Status changes to RETRACTED. We also CLEAR the vitals JSON column to remove it from "live" data.
    // We preserve note_draft and clinical_snapshot for audit purposes.
    await client.query(
      `UPDATE visits 
       SET status = 'retracted', 
           vitals = NULL,
           updated_at = CURRENT_TIMESTAMP 
       WHERE id = $1`,
      [id]
    );

    // 2.1 Remove derived clinical data (Vitals) to prevent pollution of analytics
    // We delete from the vitals table where this visit is the source (checking both visit_id and encounter_id)
    await client.query('DELETE FROM vitals WHERE visit_id = $1 OR encounter_id = $1', [id]);

    // 2.2 Remove link to documents? (Optional, but documents might be relevant to keep for audit)
    // For now, we only strictly remove structured data that affects graphs/trends.

    // 3. Create Retraction Record (Tenant Aware)
    await client.query(
      `INSERT INTO note_retractions (
         note_id, tenant_id, retracted_by_user_id, reason_code, reason_text
       ) VALUES ($1, $2, $3, $4, $5)`,
      [id, visit.clinic_id, req.user.id, reason_code, reason_text]
    );

    // 4. Write Audit Event (Old System)
    await logAudit(
      req.user.id,
      'note_retracted',
      'visit',
      id,
      {
        reason_code,
        reason_text,
        action: 'ENTERED_IN_ERROR'
      },
      req.ip
    );

    // 5. Write Commercial-Grade Audit Event
    if (req.logAuditEvent) {
      req.logAuditEvent({
        action: 'NOTE_RETRACTED',
        entityType: 'Note',
        entityId: id,
        patientId: visit.patient_id,
        encounterId: id,
        details: {
          reason_code,
          reason_text,
          action: 'ENTERED_IN_ERROR'
        }
      });
    }

    await client.query('COMMIT');
    res.json({ success: true, message: 'Note has been retracted and marked Entered-in-Error' });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Retraction error:', error);
    res.status(500).json({ error: 'Failed to retract note', details: error.message });
  } finally {
    client.release();
  }
});

// Get retraction details
router.get('/:id/retraction', requirePermission('notes:view'), async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT nr.*, u.first_name || ' ' || u.last_name as retracted_by_name
       FROM note_retractions nr
       JOIN users u ON nr.retracted_by_user_id = u.id
       WHERE nr.note_id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Retraction details not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching retraction details:', error);
    res.status(500).json({ error: 'Failed to fetch retraction details' });
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

    req.logAuditEvent({
      action: 'SUMMARY_GENERATED',
      entityType: 'Note',
      entityId: id,
      patientId: visit.patient_id
    });

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

    const visit = result.rows[0];

    // Log audit
    req.logAuditEvent({
      action: 'NOTE_VIEWED',
      entityType: 'Note',
      entityId: id,
      patientId: visit.patient_id
    });

    // Integrity Verification for Signed Notes
    if (visit.note_signed_at && visit.content_hash) {
      const snapshot = typeof visit.clinical_snapshot === 'string' ? visit.clinical_snapshot : JSON.stringify(visit.clinical_snapshot);
      const hashPayload = `${visit.id}|${visit.patient_id}|${visit.note_draft || ''}|${visit.vitals || ''}|${snapshot}|${visit.note_signed_by}`;
      const computedHash = crypto.createHash('sha256').update(hashPayload).digest('hex');

      visit.content_integrity_verified = (computedHash === visit.content_hash);

      if (!visit.content_integrity_verified) {
        console.warn(`[SECURITY] Integrity check failed for note ${id}. Content may have been tampered with.`);
        req.logAuditEvent({
          action: 'INTEGRITY_CHECK_FAILED',
          entityType: 'Note',
          entityId: id,
          patientId: visit.patient_id,
          details: { expected: visit.content_hash, computed: computedHash }
        });
      }
    }

    res.json(visit);
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
      `INSERT INTO visits (patient_id, visit_date, visit_type, provider_id, clinic_id)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [patient_id, visit_date || new Date(), visit_type || 'Office Visit', provider_id || req.user.id, req.user?.clinic_id]
    );

    const visit = result.rows[0];
    req.logAuditEvent({
      action: 'NOTE_CREATED',
      entityType: 'Note',
      entityId: visit.id,
      patientId: visit.patient_id,
      details: { visit_type: visit.visit_type }
    });

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

    // IMMUTABILITY CHECK: Prevent editing signed or retracted notes
    const checkRes = await pool.query('SELECT status, note_signed_at FROM visits WHERE id = $1', [id]);
    if (checkRes.rows.length > 0) {
      const v = checkRes.rows[0];
      if ((v.status === 'signed' || v.note_signed_at) && !req.user.is_admin) {
        return res.status(403).json({
          error: 'Signed notes cannot be edited. Please use the addendum or retraction workflow.',
          code: 'NOTE_LOCKED'
        });
      }
      if (v.status === 'retracted') {
        return res.status(403).json({ error: 'Retracted notes are immutable.' });
      }
    }

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
    req.logAuditEvent({
      action: 'NOTE_UPDATED_DRAFT',
      entityType: 'Note',
      entityId: id,
      patientId: result.rows[0].patient_id
    });

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

    req.logAuditEvent({
      action: 'ADDENDUM_ADDED',
      entityType: 'Note',
      entityId: id,
      patientId: visit.patient_id,
      details: { addendumCount: existingAddendums.length }
    });

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error adding addendum:', error);
    res.status(500).json({ error: 'Failed to add addendum' });
  }
});

// Delete visit
// Delete visit
router.delete('/:id', requirePermission('notes:edit'), async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;

    // IMMUTABILITY CHECK: Prevent deleting signed notes
    const checkRes = await client.query('SELECT status, note_signed_at FROM visits WHERE id = $1', [id]);
    if (checkRes.rows.length > 0) {
      const v = checkRes.rows[0];
      if (v.status === 'signed' || v.status === 'retracted' || v.note_signed_at) {
        client.release();
        return res.status(403).json({
          error: 'Signed or retracted clinical notes cannot be hard-deleted from the system for compliance reasons. Use the retraction workflow instead.',
          code: 'NOTE_DELETE_FORBIDDEN'
        });
      }
    }

    await client.query('BEGIN');

    // 1. Unlink any documents associated with this visit (avoid FK violation)
    await client.query('UPDATE documents SET visit_id = NULL WHERE visit_id = $1', [id]);

    // 2. Delete the visit
    const result = await client.query('DELETE FROM visits WHERE id = $1 RETURNING *', [id]);

    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Visit not found' });
    }

    await client.query('COMMIT');

    req.logAuditEvent({
      action: 'NOTE_DELETED',
      entityType: 'Note',
      entityId: id,
      patientId: result.rows[0].patient_id
    });

    res.json({ message: 'Visit deleted successfully' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error deleting visit:', error);
    res.status(500).json({ error: 'Failed to delete visit', details: error.message });
  } finally {
    client.release();
  }
});

module.exports = router;
