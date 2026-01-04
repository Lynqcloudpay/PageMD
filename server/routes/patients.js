const express = require('express');
const pool = require('../db');
const { authenticate, logAudit } = require('../middleware/auth');
const { requirePermission, audit } = require('../services/authorization');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const patientEncryptionService = require('../services/patientEncryptionService');
const emailService = require('../services/emailService');

const router = express.Router();

// Configure multer for patient photos
const baseUploadDir = process.env.UPLOAD_DIR || './uploads';
const uploadDir = path.join(baseUploadDir, 'patient-photos');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Ensure the directory exists
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `patient-${req.params.id}-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (extname && mimetype) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// All routes require authentication
router.use(authenticate);

// Get all patients (with smart search)
router.get('/', async (req, res) => {
  console.log('[PATIENTS-GET] Smart search request received');
  try {
    const { name, dob, phone, mrn, limit = 25, offset = 0 } = req.query;
    // Legacy support
    const search = req.query.search;
    const firstName = req.query.firstName;
    const lastName = req.query.lastName;

    const clinicId = req.user?.clinic_id;
    const encryptionEnabled = process.env.ENABLE_PHI_ENCRYPTION === 'true';

    // 1. Name Parsing Logic
    let firstNameQuery = firstName || '';
    let lastNameQuery = lastName || '';
    let isSingleNameToken = false;

    if (name && name.trim()) {
      const trimmedName = name.trim();
      if (trimmedName.includes(',')) {
        const parts = trimmedName.split(',').map(p => p.trim());
        lastNameQuery = parts[0];
        firstNameQuery = parts[1] || '';
      } else if (trimmedName.includes(' ')) {
        const parts = trimmedName.split(/\s+/).map(p => p.trim());
        firstNameQuery = parts[0];
        lastNameQuery = parts.slice(1).join(' ');
      } else {
        firstNameQuery = trimmedName;
        lastNameQuery = trimmedName;
        isSingleNameToken = true;
      }
    }

    // 2. Phone Normalization (search digits only)
    const phoneDigits = phone ? phone.replace(/\D/g, '') : '';

    // If encryption is enabled, we must filter in memory for name/phone
    if (encryptionEnabled && (firstNameQuery || lastNameQuery || phoneDigits || search)) {
      console.log('[PATIENTS-GET] Encryption enabled -> In-Memory Search');

      let query = 'SELECT * FROM patients WHERE clinic_id = $1';
      const params = [clinicId];

      // We can still pre-filter by dob and mrn in SQL since they are plaintext
      if (dob) {
        query += ` AND (to_char(dob, 'MM/DD/YYYY') = $2 OR to_char(dob, 'YYYY-MM-DD') = $2 OR to_char(dob, 'YYYY') = $2)`;
        params.push(dob);
      }
      if (mrn) {
        const mrnIdx = params.length + 1;
        query += ` AND mrn ILIKE $${mrnIdx}`;
        params.push(`${mrn}%`);
      }

      const result = await pool.query(query, params);
      const decryptedAll = await patientEncryptionService.decryptPatientsPHI(result.rows);

      let filtered = decryptedAll;

      // Apply Name filter (AND logic)
      if (firstNameQuery || lastNameQuery) {
        filtered = filtered.filter(p => {
          const fn = (p.first_name || '').toLowerCase();
          const ln = (p.last_name || '').toLowerCase();
          const fq = firstNameQuery.toLowerCase();
          const lq = lastNameQuery.toLowerCase();

          if (isSingleNameToken) {
            return fn.includes(fq) || ln.includes(lq);
          }
          return fn.includes(fq) && ln.includes(lq);
        });
      }

      // Apply Phone filter
      if (phoneDigits) {
        filtered = filtered.filter(p => {
          const p1 = (p.phone || '').replace(/\D/g, '');
          const p2 = (p.phone_cell || '').replace(/\D/g, '');
          const p3 = (p.phone_secondary || '').replace(/\D/g, '');
          const p4 = (p.phone_work || '').replace(/\D/g, '');
          const pn = (p.phone_normalized || '');
          return p1.includes(phoneDigits) || p2.includes(phoneDigits) ||
            p3.includes(phoneDigits) || p4.includes(phoneDigits) ||
            pn.includes(phoneDigits);
        });
      }

      // Apply Legacy Search if present
      if (search && search.trim()) {
        const term = search.trim().toLowerCase();
        filtered = filtered.filter(p =>
          (p.first_name && p.first_name.toLowerCase().includes(term)) ||
          (p.last_name && p.last_name.toLowerCase().includes(term)) ||
          (p.mrn && p.mrn.toLowerCase().includes(term))
        );
      }

      // Sorting Logic
      filtered.sort((a, b) => {
        // 1. Exact MRN match priority
        if (mrn) {
          if (a.mrn === mrn && b.mrn !== mrn) return -1;
          if (b.mrn === mrn && a.mrn !== mrn) return 1;
        }

        // 2. Exact Phone match
        if (phoneDigits) {
          const aMatch = (a.phone_normalized || '').includes(phoneDigits);
          const bMatch = (b.phone_normalized || '').includes(phoneDigits);
          if (aMatch && !bMatch) return -1;
          if (bMatch && !aMatch) return 1;
        }

        // 3. Name match score (starts-with > contains)
        if (firstNameQuery) {
          const aStarts = (a.first_name || '').toLowerCase().startsWith(firstNameQuery.toLowerCase());
          const bStarts = (b.first_name || '').toLowerCase().startsWith(firstNameQuery.toLowerCase());
          if (aStarts && !bStarts) return -1;
          if (bStarts && !aStarts) return 1;
        }

        // 4. Recently updated
        return new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at);
      });

      return res.json(filtered.slice(offset, offset + limit));
    }

    // --- SQL SEARCH (Encryption Disabled) ---
    let query = 'SELECT * FROM patients WHERE clinic_id = $1';
    const params = [clinicId];
    let paramCount = 1;

    if (firstNameQuery || lastNameQuery) {
      if (isSingleNameToken) {
        paramCount++;
        query += ` AND (first_name ILIKE $${paramCount} OR last_name ILIKE $${paramCount})`;
        params.push(`%${firstNameQuery}%`);
      } else {
        if (firstNameQuery) {
          paramCount++;
          query += ` AND first_name ILIKE $${paramCount}`;
          params.push(`%${firstNameQuery}%`);
        }
        if (lastNameQuery) {
          paramCount++;
          query += ` AND last_name ILIKE $${paramCount}`;
          params.push(`%${lastNameQuery}%`);
        }
      }
    }

    if (dob) {
      paramCount++;
      // Exact match or year-only
      query += ` AND (to_char(dob, 'YYYY-MM-DD') = $${paramCount} OR to_char(dob, 'MM/DD/YYYY') = $${paramCount} OR to_char(dob, 'YYYY') = $${paramCount})`;
      params.push(dob);
    }

    if (phoneDigits) {
      paramCount++;
      query += ` AND phone_normalized ILIKE $${paramCount}`;
      params.push(`%${phoneDigits}%`);
    }

    if (mrn) {
      paramCount++;
      query += ` AND mrn ILIKE $${paramCount}`;
      params.push(`${mrn}%`);
    }

    if (search && search.trim()) {
      paramCount++;
      query += ` AND (first_name ILIKE $${paramCount} OR last_name ILIKE $${paramCount} OR mrn ILIKE $${paramCount})`;
      params.push(`%${search.trim()}%`);
    }

    // Advanced Sorting in SQL
    const sortConditions = [];
    if (mrn) sortConditions.push(`CASE WHEN mrn = '${mrn.replace(/'/g, "''")}' THEN 0 ELSE 1 END`);
    if (phoneDigits) sortConditions.push(`CASE WHEN phone_normalized = '${phoneDigits}' THEN 0 ELSE 1 END`);
    sortConditions.push(`updated_at DESC`);
    sortConditions.push(`last_name, first_name`);

    query += ` ORDER BY ${sortConditions.join(', ')}`;

    query += ` LIMIT $${++paramCount} OFFSET $${++paramCount}`;
    params.push(parseInt(limit), parseInt(offset));

    const result = await pool.query(query, params);
    const decryptedPatients = await patientEncryptionService.decryptPatientsPHI(result.rows);

    // Audit log
    try {
      await logAudit(req.user.id, 'patient.search', 'patient', null, { filters: req.query }, req.ip);
    } catch (e) { }

    res.json(decryptedPatients);
  } catch (error) {
    console.error('[PATIENTS-GET] Smart search error:', error);
    res.status(500).json({ error: 'Failed to search patients' });
  }
});

// Get patient snapshot (front page data) - MUST come before /:id route
// Requires patient:view permission
router.get('/:id/snapshot', requirePermission('patients:view_chart'), async (req, res) => {
  try {
    const { id } = req.params;

    // Get patient
    let patient;
    try {
      patient = await pool.query('SELECT * FROM patients WHERE id = $1', [id]);
      if (patient.rows.length === 0) {
        return res.status(404).json({ error: 'Patient not found' });
      }
      // Decrypt PHI fields
      patient.rows[0] = await patientEncryptionService.decryptPatientPHI(patient.rows[0]);
    } catch (error) {
      console.error('Error fetching patient:', error);
      throw new Error(`Failed to fetch patient: ${error.message}`);
    }

    // Get allergies
    let allergies = { rows: [] };
    try {
      allergies = await pool.query(
        'SELECT * FROM allergies WHERE patient_id = $1 AND active = true ORDER BY created_at DESC',
        [id]
      );
    } catch (error) {
      console.warn('Error fetching allergies (continuing):', error.message);
    }

    // Get current medications
    let medications = { rows: [] };
    try {
      medications = await pool.query(
        'SELECT * FROM medications WHERE patient_id = $1 AND active = true ORDER BY created_at DESC',
        [id]
      );
    } catch (error) {
      console.warn('Error fetching medications (continuing):', error.message);
    }

    // Get problems
    let problems = { rows: [] };
    try {
      problems = await pool.query(
        'SELECT * FROM problems WHERE patient_id = $1 AND status = $2 ORDER BY created_at DESC',
        [id, 'active']
      );
    } catch (error) {
      console.warn('Error fetching problems (continuing):', error.message);
    }

    // Get last 3 visits
    let visits = { rows: [] };
    try {
      visits = await pool.query(
        `SELECT v.*, 
              COALESCE(u.first_name, 'Unknown') as provider_first_name, 
              COALESCE(u.last_name, 'Provider') as provider_last_name
       FROM visits v
       LEFT JOIN users u ON v.provider_id = u.id
       WHERE v.patient_id = $1
       ORDER BY v.visit_date DESC
       LIMIT 3`,
        [id]
      );
    } catch (error) {
      console.warn('Error fetching visits (continuing):', error.message);
    }

    // Run clinical rules and create alerts (non-blocking, don't wait for it)
    // Use setTimeout to ensure it doesn't block the response
    setTimeout(async () => {
      try {
        // Try to load clinical rules if it exists
        try {
          const { autoCreateAlerts } = require('../middleware/clinical-rules');
          if (autoCreateAlerts && typeof autoCreateAlerts === 'function') {
            await autoCreateAlerts(id);
          }
        } catch (requireError) {
          // Module doesn't exist or function not available - that's OK
          console.debug('Clinical rules not available:', requireError.message);
        }
      } catch (error) {
        // Silently fail - don't log to avoid noise
        console.debug('Error in clinical rules:', error.message);
      }
    }, 0);

    // Get last vitals
    let lastVisit = { rows: [] };
    try {
      lastVisit = await pool.query(
        `SELECT vitals FROM visits WHERE patient_id = $1 AND vitals IS NOT NULL
       ORDER BY visit_date DESC LIMIT 1`,
        [id]
      );
    } catch (error) {
      console.warn('Error fetching last vitals (continuing):', error.message);
    }

    // Log audit (non-blocking, don't fail if it errors)
    if (req.user && req.user.id) {
      try {
        const requestId = req.headers['x-request-id'] || crypto.randomUUID();
        await logAudit(
          req.user.id,
          'patient.snapshot.viewed',
          'patient',
          id,
          {},
          req.ip,
          req.get('user-agent'),
          'success',
          requestId,
          req.sessionId
        );
      } catch (auditError) {
        console.warn('Failed to log audit for snapshot view:', auditError);
      }
    }

    res.json({
      patient: patient.rows[0],
      allergies: allergies.rows,
      medications: medications.rows,
      problems: problems.rows,
      recentVisits: visits.rows,
      lastVitals: lastVisit.rows[0]?.vitals || null,
    });
  } catch (error) {
    console.error('Error fetching snapshot:', error);
    console.error('Error details:', error.message, error.stack);
    console.error('Error code:', error.code);
    console.error('Error detail:', error.detail);
    console.error('Full error object:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
    res.status(500).json({
      error: 'Failed to fetch snapshot',
      message: error.message,
      details: process.env.NODE_ENV === 'development' ? {
        message: error.message,
        code: error.code,
        detail: error.detail,
        stack: error.stack
      } : undefined
    });
  }
});

// Get patient by ID - MUST come after /:id/snapshot route
router.get('/:id', requirePermission('patients:view_chart'), async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM patients WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    // Decrypt PHI fields before sending response
    const decryptedPatient = await patientEncryptionService.decryptPatientPHI(result.rows[0]);

    // Log audit
    const requestId = req.headers['x-request-id'] || crypto.randomUUID();
    await logAudit(
      req.user.id,
      'patient.viewed',
      'patient',
      id,
      {},
      req.ip,
      req.get('user-agent'),
      'success',
      requestId,
      req.sessionId
    );

    res.json(decryptedPatient);
  } catch (error) {
    console.error('Error fetching patient:', error);

    // Log failed audit
    await logAudit(
      req.user?.id,
      'patient.viewed',
      'patient',
      req.params.id,
      { error: error.message },
      req.ip,
      req.get('user-agent'),
      'failure',
      req.requestId,
      req.sessionId
    );

    res.status(500).json({
      error: 'Failed to fetch patient',
      details: process.env.NODE_ENV === 'development' ? {
        message: error.message,
        code: error.code,
        detail: error.detail
      } : undefined
    });
  }
});

/**
 * Invite patient to Portal
 * POST /api/patients/:id/portal-invite
 */
router.post('/:id/portal-invite', requirePermission('patients:edit_demographics'), async (req, res) => {
  try {
    const { id } = req.params;
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required for portal invitation' });
    }

    // 1. Check if account already exists
    const existing = await pool.query('SELECT id FROM patient_portal_accounts WHERE patient_id = $1 OR email = $2', [id, email]);
    if (existing.rows.length > 0) {
      return res.status(400).json({
        error: 'A portal account already exists for this patient or email',
        code: 'PORTAL_ACCOUNT_EXISTS'
      });
    }

    // 2. Generate invitation token (hashed)
    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 72); // 72 hour expiry

    // 3. Store invitation
    await pool.query(`
      INSERT INTO patient_portal_invites (patient_id, email, token_hash, expires_at, created_by_user_id)
      VALUES ($1, $2, $3, $4, $5)
    `, [id, email, tokenHash, expiresAt, req.user.id]);

    // 4. Update global lookup (to support global login recognition)
    // IMPORTANT: This happens in the control DB context
    await pool.controlPool.query(`
      INSERT INTO platform_patient_lookup (email, clinic_id, schema_name)
      VALUES ($1, $2, $3)
      ON CONFLICT (email) DO UPDATE SET 
          clinic_id = EXCLUDED.clinic_id,
          schema_name = EXCLUDED.schema_name
    `, [email, req.clinic.id, req.clinic.schema_name]);

    // 5. Audit
    await logAudit(req.user.id, 'patient_portal_invited', 'patient', id, { email }, req.ip);

    // 6. Send invitation email and return link
    const portalUrl = process.env.PORTAL_URL || 'https://pagemdemr.com/portal';
    const inviteLink = `${portalUrl}/register?token=${token}&clinic=${req.clinic.slug}`;

    try {
      const patientResult = await pool.query('SELECT first_name, last_name FROM patients WHERE id = $1', [id]);
      const patientName = patientResult.rows[0] ? `${patientResult.rows[0].first_name} ${patientResult.rows[0].last_name}` : 'Valued Patient';

      await emailService.sendPortalInvite(email, patientName, inviteLink);
    } catch (emailErr) {
      console.warn('[Portal Invite] Failed to send email:', emailErr.message);
    }

    res.json({
      success: true,
      inviteLink,
      expiresAt,
      message: 'Invitation generated and sent successfully.'
    });

  } catch (error) {
    console.error('Portal invitation error:', error);
    res.status(500).json({ error: 'Failed to generate portal invitation' });
  }
});

// Get patient photo securely - Standard EMR pattern
router.get('/:id/photo', requirePermission('patients:view_chart'), async (req, res) => {
  try {
    const { id } = req.params;

    // 1. Get photo URL from DB
    const result = await pool.query('SELECT photo_url FROM patients WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    const photoUrl = result.rows[0].photo_url;

    if (!photoUrl) {
      return res.status(404).json({ error: 'No photo set' });
    }

    // 2. Resolve file path
    // photoUrl is like "/api/uploads/patient-photos/filename.jpg"
    const filename = path.basename(photoUrl);
    const filepath = path.join(process.env.UPLOAD_DIR || './uploads', 'patient-photos', filename);

    console.log(`[PHOTO-GET] Serving photo for patient ${id}: ${filepath}`);

    // 3. Verify existence
    if (!fs.existsSync(filepath)) {
      console.error(`[PHOTO-GET] File missing on disk: ${filepath}`);
      return res.status(404).json({ error: 'Photo file not found on server' });
    }

    // 4. Serve file
    res.sendFile(path.resolve(filepath));
  } catch (error) {
    console.error('[PHOTO-GET] Error serving photo:', error);
    res.status(500).json({ error: 'Failed to serve photo' });
  }
});

// Create patient - requires patient:create permission
router.post('/', requirePermission('patients:edit_demographics'), async (req, res) => {
  try {
    const {
      // Basic info - accept both camelCase (old) and snake_case (new)
      mrn,
      firstName, first_name,
      middleName, middle_name,
      lastName, last_name,
      nameSuffix, name_suffix,
      preferredName, preferred_name,
      dob,
      sex,
      gender,
      race,
      ethnicity,
      maritalStatus, marital_status,

      // Contact
      phone,
      phoneSecondary, phone_secondary,
      phoneCell, phone_cell,
      phoneWork, phone_work,
      phonePreferred, phone_preferred,
      email,
      emailSecondary, email_secondary,
      preferredLanguage, preferred_language,
      interpreterNeeded, interpreter_needed,
      communicationPreference, communication_preference,
      consentToText, consent_to_text,
      consentToEmail, consent_to_email,

      // Address
      addressLine1, address_line1,
      addressLine2, address_line2,
      city,
      state,
      zip,
      country,
      addressType, address_type,

      // Employment
      employmentStatus, employment_status,
      occupation,
      employerName, employer_name,

      // Emergency Contact
      emergencyContactName, emergency_contact_name,
      emergencyContactPhone, emergency_contact_phone,
      emergencyContactRelationship, emergency_contact_relationship,
      emergencyContactAddress, emergency_contact_address,
      emergencyContact2Name, emergency_contact2_name,
      emergencyContact2Phone, emergency_contact2_phone,
      emergencyContact2Relationship, emergency_contact2_relationship,

      // Insurance
      insuranceProvider, insurance_provider,
      insuranceId, insurance_id,
      insuranceGroupNumber, insurance_group_number,
      insurancePlanName, insurance_plan_name,
      insurancePlanType, insurance_plan_type,
      insuranceSubscriberName, insurance_subscriber_name,
      insuranceSubscriberDob, insurance_subscriber_dob,
      insuranceSubscriberRelationship, insurance_subscriber_relationship,
      insuranceCopay, insurance_copay,
      insuranceEffectiveDate, insurance_effective_date,
      insuranceExpiryDate, insurance_expiry_date,
      insuranceNotes, insurance_notes,

      // Pharmacy
      pharmacyName, pharmacy_name,
      pharmacyAddress, pharmacy_address,
      pharmacyPhone, pharmacy_phone,
      pharmacyNpi, pharmacy_npi,
      pharmacyFax, pharmacy_fax,
      pharmacyPreferred, pharmacy_preferred,

      // Additional
      referralSource, referral_source,
      smokingStatus, smoking_status,
      alcoholUse, alcohol_use,
      allergiesKnown, allergies_known,
      notes,
      primaryCareProvider, primary_care_provider,
    } = req.body;

    // 1. Validate required fields to prevent DB null constraint violations
    const final_first_name = first_name || firstName;
    const final_last_name = last_name || lastName;

    if (!final_first_name || !final_last_name || !dob) {
      console.warn('[Patient Create] Missing required fields:', {
        firstName: !!final_first_name,
        lastName: !!final_last_name,
        dob: !!dob
      });
      return res.status(400).json({
        error: 'Missing required fields',
        details: 'First name, Last name, and Date of Birth are mandatory.'
      });
    }

    // 2. Extract clinic_id from user context for multi-tenancy
    // Check multiple sources: req.user.clinic_id, req.user.clinicId, or req.clinic.id (from tenant middleware)
    const userClinicId = req.user?.clinic_id || req.user?.clinicId || req.clinic?.id || null;

    // Generate MRN if not provided - 6 digit number
    const finalMRN = mrn || String(Math.floor(100000 + Math.random() * 900000));

    // Add optional fields dynamically - prefer snake_case, fallback to camelCase
    const optionalFields = {
      middle_name: middle_name || middleName,
      name_suffix: name_suffix || nameSuffix,
      preferred_name: preferred_name || preferredName,
      gender: gender,
      race: race,
      ethnicity: ethnicity,
      marital_status: marital_status || maritalStatus,
      sex: sex,
      phone: phone,
      phone_secondary: phone_secondary || phoneSecondary,
      phone_cell: phone_cell || phoneCell,
      phone_work: phone_work || phoneWork,
      phone_preferred: phone_preferred || phonePreferred,
      email: email,
      email_secondary: email_secondary || emailSecondary,
      preferred_language: preferred_language || preferredLanguage,
      interpreter_needed: interpreter_needed || interpreterNeeded,
      communication_preference: communication_preference || communicationPreference,
      consent_to_text: consent_to_text || consentToText,
      consent_to_email: consent_to_email || consentToEmail,
      address_line1: address_line1 || addressLine1,
      address_line2: address_line2 || addressLine2,
      city: city,
      state: state,
      zip: zip,
      country: country || 'United States',
      address_type: address_type || addressType || 'Home',
      employment_status: employment_status || employmentStatus,
      occupation: occupation,
      employer_name: employer_name || employerName,
      emergency_contact_name: emergency_contact_name || emergencyContactName,
      emergency_contact_phone: emergency_contact_phone || emergencyContactPhone,
      emergency_contact_relationship: emergency_contact_relationship || emergencyContactRelationship,
      emergency_contact_address: emergency_contact_address || emergencyContactAddress,
      emergency_contact_2_name: emergency_contact2_name || emergencyContact2Name,
      emergency_contact_2_phone: emergency_contact2_phone || emergencyContact2Phone,
      emergency_contact_2_relationship: emergency_contact2_relationship || emergencyContact2Relationship,
      insurance_provider: insurance_provider || insuranceProvider,
      insurance_id: insurance_id || insuranceId,
      insurance_group_number: insurance_group_number || insuranceGroupNumber,
      insurance_plan_name: insurance_plan_name || insurancePlanName,
      insurance_plan_type: insurance_plan_type || insurancePlanType,
      insurance_subscriber_name: insurance_subscriber_name || insuranceSubscriberName,
      insurance_subscriber_dob: insurance_subscriber_dob || insuranceSubscriberDob,
      insurance_subscriber_relationship: insurance_subscriber_relationship || insuranceSubscriberRelationship,
      insurance_copay: insurance_copay || insuranceCopay,
      insurance_effective_date: insurance_effective_date || insuranceEffectiveDate,
      insurance_expiry_date: insurance_expiry_date || insuranceExpiryDate,
      insurance_notes: insurance_notes || insuranceNotes,
      pharmacy_name: pharmacy_name || pharmacyName,
      pharmacy_address: pharmacy_address || pharmacyAddress,
      pharmacy_phone: pharmacy_phone || pharmacyPhone,
      pharmacy_npi: pharmacy_npi || pharmacyNpi,
      pharmacy_fax: pharmacy_fax || pharmacyFax,
      pharmacy_preferred: pharmacy_preferred || pharmacyPreferred,
      referral_source: referral_source || referralSource,
      smoking_status: smoking_status || smokingStatus,
      alcohol_use: alcohol_use || alcoholUse,
      allergies_known: allergies_known || allergiesKnown,
      notes: notes,
      primary_care_provider: primary_care_provider || primaryCareProvider,
      clinic_id: userClinicId,
    };

    // Extract digits for phone_normalized
    const allPhones = [phone, phone_cell, phoneCell, phone_secondary, phoneSecondary, phone_work, phoneWork].filter(Boolean).join('');
    const phone_normalized = allPhones.replace(/\D/g, '');

    // Build patient object for encryption
    const patientData = {
      mrn: finalMRN,
      first_name: final_first_name,
      last_name: final_last_name,
      dob: dob,
      clinic_id: userClinicId,
      phone_normalized: phone_normalized,
      ...optionalFields
    };

    // Encrypt PHI fields before storing
    const encryptedPatient = await patientEncryptionService.preparePatientForStorage(patientData);

    // List of valid columns in the patients table (to prevent SQL errors)
    const validColumns = new Set([
      'id', 'mrn', 'first_name', 'last_name', 'dob', 'sex', 'gender',
      'middle_name', 'name_suffix', 'preferred_name', 'race', 'ethnicity', 'marital_status',
      'phone', 'phone_secondary', 'phone_cell', 'phone_work', 'phone_preferred',
      'phone_normalized',
      'email', 'email_secondary',
      'address_line1', 'address_line2', 'city', 'state', 'zip', 'country', 'address_type',
      'preferred_language', 'interpreter_needed', 'communication_preference', 'consent_to_text', 'consent_to_email',
      'employment_status', 'occupation', 'employer_name',
      'emergency_contact_name', 'emergency_contact_phone', 'emergency_contact_relationship', 'emergency_contact_address',
      'emergency_contact_2_name', 'emergency_contact_2_phone', 'emergency_contact_2_relationship',
      'insurance_provider', 'insurance_id', 'insurance_group_number', 'insurance_plan_name', 'insurance_plan_type',
      'insurance_subscriber_name', 'insurance_subscriber_dob', 'insurance_subscriber_relationship',
      'insurance_copay', 'insurance_effective_date', 'insurance_expiry_date', 'insurance_notes',
      'pharmacy_name', 'pharmacy_address', 'pharmacy_phone', 'pharmacy_npi', 'pharmacy_fax', 'pharmacy_preferred',
      'referral_source', 'smoking_status', 'alcohol_use', 'allergies_known', 'notes',
      'primary_care_provider', 'photo_url', 'clinic_id', 'created_at', 'updated_at',
      'deceased', 'deceased_date', 'clinic_id'
    ]);

    // Debug log to trace missing fields
    if (process.env.DEBUG_AUTH === 'true' || process.env.NODE_ENV !== 'production') {
      console.log('[Patient Create] FULL Request Body:', JSON.stringify(req.body, null, 2));
      console.log('[Patient Create] Extracted Names:', { final_first_name, final_last_name, dob });
    }

    // Build INSERT query with encrypted data
    const fields = ['mrn'];
    const values = [encryptedPatient.mrn];
    let paramIndex = 2;

    // Add all fields (encrypted PHI fields will have encrypted values)
    // Only include fields that exist in the database
    for (const [dbField, value] of Object.entries(encryptedPatient)) {
      if (dbField === 'mrn') continue; // Already added
      if (dbField === 'encryption_metadata') continue; // Handled separately
      if (!validColumns.has(dbField)) {
        console.warn(`Skipping field ${dbField} - column does not exist in patients table`);
        continue;
      }
      // CRITICAL: Include empty strings if they are provide to satisfy NOT NULL constraints
      // Only skip if explicitly undefined or null
      if (value !== undefined && value !== null) {
        fields.push(dbField);
        values.push(value);
        paramIndex++;
      }
    }

    // Explicitly add clinic_id if present in user context and not in fields
    if (req.user?.clinic_id && !fields.includes('clinic_id')) {
      fields.push('clinic_id');
      values.push(req.user.clinic_id);
      paramIndex++;
    }

    // Add encryption_metadata if present and not already in fields
    if (encryptedPatient.encryption_metadata && !fields.includes('encryption_metadata')) {
      fields.push('encryption_metadata');
      values.push(JSON.stringify(encryptedPatient.encryption_metadata));
    }

    const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');

    const result = await pool.query(
      `INSERT INTO patients (${fields.join(', ')})
       VALUES (${placeholders})
       RETURNING *`,
      values
    );

    // Decrypt for response
    const decryptedPatient = await patientEncryptionService.decryptPatientPHI(result.rows[0]);

    // Log audit with full correlation metadata
    const requestId = req.headers['x-request-id'] || req.requestId || uuidv4();
    await logAudit(
      req.user.id,
      'create_patient',
      'patient',
      result.rows[0].id,
      {},
      req.ip,
      req.get('user-agent'),
      'success',
      requestId,
      req.sessionId
    );

    res.status(201).json(decryptedPatient);
  } catch (error) {
    console.error('Error creating patient:', error);
    if (error.code === '23505') {
      return res.status(400).json({ error: 'MRN already exists' });
    }
    res.status(500).json({
      error: 'Failed to create patient',
      message: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Update patient
router.put('/:id', requirePermission('patients:edit_demographics'), async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Get existing patient to merge with updates
    const existingResult = await pool.query('SELECT * FROM patients WHERE id = $1', [id]);
    if (existingResult.rows.length === 0) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    // Decrypt existing patient data
    const existingPatient = await patientEncryptionService.decryptPatientPHI(existingResult.rows[0]);

    // Handle phone_normalized update if any phone field changes
    const phoneFields = ['phone', 'phone_cell', 'phone_secondary', 'phone_work'];
    let phoneChanged = false;
    for (const f of phoneFields) {
      if (updates[f] !== undefined || updates[f.replace(/_([a-z])/g, (g) => g[1].toUpperCase())] !== undefined) {
        phoneChanged = true;
        break;
      }
    }

    if (phoneChanged) {
      const p = updates.phone || existingPatient.phone || '';
      const c = updates.phoneCell || updates.phone_cell || existingPatient.phone_cell || '';
      const s = updates.phoneSecondary || updates.phone_secondary || existingPatient.phone_secondary || '';
      const w = updates.phoneWork || updates.phone_work || existingPatient.phone_work || '';
      const combined = (p + c + s + w).replace(/\D/g, '');
      updates.phone_normalized = combined;
    }

    // Track which fields are being updated
    const changedFields = {};
    const allowedFields = [
      // Basic info
      'first_name', 'middle_name', 'last_name', 'name_suffix', 'preferred_name',
      'dob', 'sex', 'gender', 'race', 'ethnicity', 'marital_status',
      // Contact
      'phone', 'phone_secondary', 'phone_cell', 'phone_work', 'phone_preferred',
      'phone_normalized',
      'email', 'email_secondary', 'preferred_language', 'interpreter_needed',
      'communication_preference', 'consent_to_text', 'consent_to_email',
      // Address
      'address_line1', 'address_line2', 'city', 'state', 'zip', 'country', 'address_type',
      // Employment
      'employment_status', 'occupation', 'employer_name',
      // Emergency Contact
      'emergency_contact_name', 'emergency_contact_phone', 'emergency_contact_relationship',
      'emergency_contact_address', 'emergency_contact_2_name', 'emergency_contact_2_phone',
      'emergency_contact_2_relationship',
      // Insurance
      'insurance_provider', 'insurance_id', 'insurance_group_number', 'insurance_plan_name',
      'insurance_plan_type', 'insurance_subscriber_name', 'insurance_subscriber_dob',
      'insurance_subscriber_relationship', 'insurance_copay', 'insurance_effective_date',
      'insurance_expiry_date', 'insurance_notes',
      // Pharmacy
      'pharmacy_name', 'pharmacy_address', 'pharmacy_phone', 'pharmacy_npi', 'pharmacy_fax',
      'pharmacy_preferred',
      // Additional
      'primary_care_provider', 'referral_source', 'smoking_status', 'alcohol_use',
      'allergies_known', 'photo_url', 'notes', 'deceased', 'deceased_date',
    ];

    // Only collect fields that are actually being updated
    for (const field of allowedFields) {
      const camelField = field.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
      if (updates[camelField] !== undefined) {
        // Convert empty strings to null to prevent DB errors (especially for dates/enums)
        changedFields[field] = updates[camelField] === '' ? null : updates[camelField];
      }
    }

    if (Object.keys(changedFields).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    // Only encrypt the fields that are being changed
    const encryptedChanges = await patientEncryptionService.preparePatientForStorage(changedFields);

    // Build UPDATE query with only changed fields
    const setClause = [];
    const values = [];
    let paramIndex = 1;

    for (const field of allowedFields) {
      if (encryptedChanges[field] !== undefined) {
        setClause.push(`${field} = $${paramIndex}`);
        values.push(encryptedChanges[field]);
        paramIndex++;
      }
    }

    // Update encryption_metadata if PHI fields changed
    if (encryptedChanges.encryption_metadata) {
      setClause.push(`encryption_metadata = $${paramIndex}`);
      values.push(JSON.stringify(encryptedChanges.encryption_metadata));
      paramIndex++;
    }


    setClause.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);

    const result = await pool.query(
      `UPDATE patients SET ${setClause.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    // Decrypt for response
    const decryptedPatient = await patientEncryptionService.decryptPatientPHI(result.rows[0]);

    // Log audit (non-blocking, don't fail if it errors)
    if (req.user && req.user.id) {
      try {
        await logAudit(req.user.id, 'update_patient', 'patient', id, { fields: Object.keys(updates) }, req.ip);
      } catch (auditError) {
        console.warn('Failed to log audit for patient update:', auditError);
      }
    }

    res.json(decryptedPatient);
  } catch (error) {
    console.error('Error updating patient:', error);
    console.error('Error details:', error.message, error.stack);
    res.status(500).json({ error: 'Failed to update patient', message: error.message });
  }
});

// Add allergy
router.post('/:id/allergies', requirePermission('patients:view_chart'), async (req, res) => {
  try {
    const { id } = req.params;
    const { allergen, reaction, severity, onsetDate } = req.body;

    const result = await pool.query(
      `INSERT INTO allergies (patient_id, allergen, reaction, severity, onset_date)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [id, allergen, reaction, severity, onsetDate]
    );

    await logAudit(req.user.id, 'add_allergy', 'allergy', result.rows[0].id, {}, req.ip);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error adding allergy:', error);
    res.status(500).json({ error: 'Failed to add allergy' });
  }
});

// Add medication with clinical decision support
router.post('/:id/medications', requirePermission('meds:prescribe'), async (req, res) => {
  try {
    const { id } = req.params;
    const { medicationName, dosage, frequency, route, startDate } = req.body;

    console.log(`[API] Adding medication for patient ${id}:`, medicationName);

    // Clinical decision support - OpenEMR style
    const { performClinicalChecks } = require('../middleware/clinical');
    const warnings = await performClinicalChecks(id, medicationName);

    // If high severity warnings exist, log them but don't block
    if (warnings.some(w => w.severity === 'high')) {
      console.warn(`[CLINICAL] High severity warnings for ${medicationName}:`, warnings);
    }

    const result = await pool.query(
      `INSERT INTO medications (patient_id, medication_name, dosage, frequency, route, start_date, prescriber_id, active, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [id, medicationName, dosage, frequency, route, startDate || new Date().toISOString(), req.user.id, true, 'active']
    );

    await logAudit(req.user.id, 'add_medication', 'medication', result.rows[0].id, {
      medication: medicationName,
      status: 'active',
      warnings: warnings.length > 0 ? warnings : null
    }, req.ip);

    res.status(201).json({
      ...result.rows[0],
      warnings: warnings.length > 0 ? warnings : undefined
    });
  } catch (error) {
    console.error('Error adding medication:', error);
    res.status(500).json({ error: 'Failed to add medication' });
  }
});

// Add problem
router.post('/:id/problems', requirePermission('notes:create'), async (req, res) => {
  try {
    const { id } = req.params;
    const { problemName, icd10Code, onsetDate } = req.body;

    const result = await pool.query(
      `INSERT INTO problems (patient_id, problem_name, icd10_code, onset_date)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [id, problemName, icd10Code, onsetDate]
    );

    await logAudit(req.user.id, 'add_problem', 'problem', result.rows[0].id, {}, req.ip);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error adding problem:', error);
    res.status(500).json({ error: 'Failed to add problem' });
  }
});

// Update problem
router.put('/problems/:problemId', requirePermission('notes:edit'), async (req, res) => {
  try {
    const { problemId } = req.params;
    const { problemName, icd10Code, onsetDate, status } = req.body;

    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (problemName !== undefined) {
      updates.push(`problem_name = $${paramIndex}`);
      values.push(problemName);
      paramIndex++;
    }
    if (icd10Code !== undefined) {
      updates.push(`icd10_code = $${paramIndex}`);
      values.push(icd10Code);
      paramIndex++;
    }
    if (onsetDate !== undefined) {
      updates.push(`onset_date = $${paramIndex}`);
      values.push(onsetDate);
      paramIndex++;
    }
    if (status !== undefined) {
      updates.push(`status = $${paramIndex}`);
      values.push(status);
      paramIndex++;
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(problemId);

    const result = await pool.query(
      `UPDATE problems SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Problem not found' });
    }

    await logAudit(req.user.id, 'update_problem', 'problem', problemId, {}, req.ip);
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating problem:', error);
    res.status(500).json({ error: 'Failed to update problem' });
  }
});

// Delete problem
router.delete('/problems/:problemId', requirePermission('notes:edit'), async (req, res) => {
  try {
    const { problemId } = req.params;

    const result = await pool.query('DELETE FROM problems WHERE id = $1 RETURNING *', [problemId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Problem not found' });
    }

    await logAudit(req.user.id, 'delete_problem', 'problem', problemId, {}, req.ip);
    res.json({ message: 'Problem deleted' });
  } catch (error) {
    console.error('Error deleting problem:', error);
    res.status(500).json({ error: 'Failed to delete problem' });
  }
});

// Get family history
router.get('/:id/family-history', requirePermission('patients:view_chart'), async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'SELECT * FROM family_history WHERE patient_id = $1 ORDER BY created_at DESC',
      [id]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching family history:', error);
    res.status(500).json({ error: 'Failed to fetch family history' });
  }
});

// Add family history
router.post('/:id/family-history', requirePermission('notes:create'), async (req, res) => {
  try {
    const { id } = req.params;
    const { condition, relationship, ageAtDiagnosis, ageAtDeath, notes } = req.body;

    const sanitizedAgeDiagnosis = (ageAtDiagnosis === '' || ageAtDiagnosis === null || ageAtDiagnosis === undefined) ? null : ageAtDiagnosis;
    const sanitizedAgeDeath = (ageAtDeath === '' || ageAtDeath === null || ageAtDeath === undefined) ? null : ageAtDeath;

    const result = await pool.query(
      `INSERT INTO family_history (patient_id, condition, relationship, age_at_diagnosis, age_at_death, notes)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [id, condition, relationship, sanitizedAgeDiagnosis, sanitizedAgeDeath, notes]
    );

    await logAudit(req.user.id, 'add_family_history', 'family_history', result.rows[0].id, {}, req.ip);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error adding family history:', error);
    res.status(500).json({ error: 'Failed to add family history' });
  }
});

// Update family history
router.put('/family-history/:historyId', requirePermission('notes:edit'), async (req, res) => {
  try {
    const { historyId } = req.params;
    const { condition, relationship, ageAtDiagnosis, ageAtDeath, notes } = req.body;

    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (condition !== undefined) {
      updates.push(`condition = $${paramIndex}`);
      values.push(condition);
      paramIndex++;
    }
    if (relationship !== undefined) {
      updates.push(`relationship = $${paramIndex}`);
      values.push(relationship);
      paramIndex++;
    }
    if (ageAtDiagnosis !== undefined) {
      updates.push(`age_at_diagnosis = $${paramIndex}`);
      values.push((ageAtDiagnosis === '' || ageAtDiagnosis === null) ? null : ageAtDiagnosis);
      paramIndex++;
    }
    if (ageAtDeath !== undefined) {
      updates.push(`age_at_death = $${paramIndex}`);
      values.push((ageAtDeath === '' || ageAtDeath === null) ? null : ageAtDeath);
      paramIndex++;
    }
    if (notes !== undefined) {
      updates.push(`notes = $${paramIndex}`);
      values.push(notes);
      paramIndex++;
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(historyId);

    const result = await pool.query(
      `UPDATE family_history SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Family history not found' });
    }

    await logAudit(req.user.id, 'update_family_history', 'family_history', historyId, {}, req.ip);
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating family history:', error);
    res.status(500).json({ error: 'Failed to update family history' });
  }
});

// Delete family history
router.delete('/family-history/:historyId', requirePermission('notes:edit'), async (req, res) => {
  try {
    const { historyId } = req.params;
    const result = await pool.query('DELETE FROM family_history WHERE id = $1 RETURNING *', [historyId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Family history not found' });
    }

    await logAudit(req.user.id, 'delete_family_history', 'family_history', historyId, {}, req.ip);
    res.json({ message: 'Family history deleted' });
  } catch (error) {
    console.error('Error deleting family history:', error);
    res.status(500).json({ error: 'Failed to delete family history' });
  }
});

// Get social history
router.get('/:id/social-history', requirePermission('patients:view_chart'), async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'SELECT * FROM social_history WHERE patient_id = $1 ORDER BY created_at DESC LIMIT 1',
      [id]
    );
    res.json(result.rows[0] || null);
  } catch (error) {
    console.error('Error fetching social history:', error);
    res.status(500).json({ error: 'Failed to fetch social history' });
  }
});

// Add or update social history
router.post('/:id/social-history', requirePermission('notes:create'), async (req, res) => {
  try {
    const { id } = req.params;
    const {
      smokingStatus, smokingPackYears, alcoholUse, alcoholQuantity,
      drugUse, exerciseFrequency, diet, occupation, livingSituation, maritalStatus, notes
    } = req.body;

    // Sanitize numeric values
    const sanitizedPackYears = (smokingPackYears === '' || smokingPackYears === null || smokingPackYears === undefined) ? null : smokingPackYears;

    // Check if social history exists
    const existing = await pool.query(
      'SELECT id FROM social_history WHERE patient_id = $1',
      [id]
    );

    let result;
    if (existing.rows.length > 0) {
      // Update existing
      result = await pool.query(
        `UPDATE social_history SET
          smoking_status = $1, smoking_pack_years = $2, alcohol_use = $3, alcohol_quantity = $4,
          drug_use = $5, exercise_frequency = $6, diet = $7, occupation = $8,
          living_situation = $9, marital_status = $10, notes = $11, updated_at = CURRENT_TIMESTAMP
         WHERE patient_id = $12 RETURNING *`,
        [smokingStatus, sanitizedPackYears, alcoholUse, alcoholQuantity, drugUse,
          exerciseFrequency, diet, occupation, livingSituation, maritalStatus, notes, id]
      );
      await logAudit(req.user.id, 'update_social_history', 'social_history', existing.rows[0].id, {}, req.ip);
    } else {
      // Insert new
      result = await pool.query(
        `INSERT INTO social_history (
          patient_id, smoking_status, smoking_pack_years, alcohol_use, alcohol_quantity,
          drug_use, exercise_frequency, diet, occupation, living_situation, marital_status, notes
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *`,
        [id, smokingStatus, sanitizedPackYears, alcoholUse, alcoholQuantity, drugUse,
          exerciseFrequency, diet, occupation, livingSituation, maritalStatus, notes]
      );
      await logAudit(req.user.id, 'add_social_history', 'social_history', result.rows[0].id, {}, req.ip);
    }

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error saving social history:', error);
    res.status(500).json({ error: 'Failed to save social history' });
  }
});

// Get all problems for patient
router.get('/:id/problems', requirePermission('patients:view_chart'), async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'SELECT * FROM problems WHERE patient_id = $1 ORDER BY created_at DESC',
      [id]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching problems:', error);
    res.status(500).json({ error: 'Failed to fetch problems' });
  }
});

// Get all allergies for patient
router.get('/:id/allergies', requirePermission('patients:view_chart'), async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'SELECT * FROM allergies WHERE patient_id = $1 ORDER BY created_at DESC',
      [id]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching allergies:', error);
    res.status(500).json({ error: 'Failed to fetch allergies' });
  }
});

// Get all medications for patient
router.get('/:id/medications', requirePermission('patients:view_chart'), async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'SELECT * FROM medications WHERE patient_id = $1 ORDER BY created_at DESC',
      [id]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching medications:', error);
    res.status(500).json({ error: 'Failed to fetch medications' });
  }
});

// Update allergy
router.put('/allergies/:allergyId', requirePermission('patients:view_chart'), async (req, res) => {
  try {
    const { allergyId } = req.params;
    const { allergen, reaction, severity, onsetDate, active } = req.body;

    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (allergen !== undefined) {
      updates.push(`allergen = $${paramIndex}`);
      values.push(allergen);
      paramIndex++;
    }
    if (reaction !== undefined) {
      updates.push(`reaction = $${paramIndex}`);
      values.push(reaction);
      paramIndex++;
    }
    if (severity !== undefined) {
      updates.push(`severity = $${paramIndex}`);
      values.push(severity);
      paramIndex++;
    }
    if (onsetDate !== undefined) {
      updates.push(`onset_date = $${paramIndex}`);
      values.push(onsetDate);
      paramIndex++;
    }
    if (active !== undefined) {
      updates.push(`active = $${paramIndex}`);
      values.push(active);
      paramIndex++;
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(allergyId);

    const result = await pool.query(
      `UPDATE allergies SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Allergy not found' });
    }

    await logAudit(req.user.id, 'update_allergy', 'allergy', allergyId, {}, req.ip);
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating allergy:', error);
    res.status(500).json({ error: 'Failed to update allergy' });
  }
});

// Delete allergy
router.delete('/allergies/:allergyId', requirePermission('patients:view_chart'), async (req, res) => {
  try {
    const { allergyId } = req.params;
    const result = await pool.query('DELETE FROM allergies WHERE id = $1 RETURNING *', [allergyId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Allergy not found' });
    }

    await logAudit(req.user.id, 'delete_allergy', 'allergy', allergyId, {}, req.ip);
    res.json({ message: 'Allergy deleted' });
  } catch (error) {
    console.error('Error deleting allergy:', error);
    res.status(500).json({ error: 'Failed to delete allergy' });
  }
});

// Update medication
router.put('/medications/:medicationId', requirePermission('meds:prescribe'), async (req, res) => {
  try {
    const { medicationId } = req.params;
    const { medicationName, dosage, frequency, route, startDate, endDate, active, status } = req.body;

    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (medicationName !== undefined) {
      updates.push(`medication_name = $${paramIndex}`);
      values.push(medicationName);
      paramIndex++;
    }
    if (dosage !== undefined) {
      updates.push(`dosage = $${paramIndex}`);
      values.push(dosage);
      paramIndex++;
    }
    if (frequency !== undefined) {
      updates.push(`frequency = $${paramIndex}`);
      values.push(frequency);
      paramIndex++;
    }
    if (route !== undefined) {
      updates.push(`route = $${paramIndex}`);
      values.push(route);
      paramIndex++;
    }
    if (startDate !== undefined) {
      updates.push(`start_date = $${paramIndex}`);
      values.push(startDate);
      paramIndex++;
    }
    if (endDate !== undefined) {
      updates.push(`end_date = $${paramIndex}`);
      values.push(endDate);
      paramIndex++;
    }
    if (active !== undefined) {
      updates.push(`active = $${paramIndex}`);
      values.push(active);
      paramIndex++;
    }
    if (status !== undefined) {
      updates.push(`status = $${paramIndex}`);
      values.push(status);
      paramIndex++;
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(medicationId);

    const result = await pool.query(
      `UPDATE medications SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Medication not found' });
    }

    await logAudit(req.user.id, 'update_medication', 'medication', medicationId, {}, req.ip);
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating medication:', error);
    res.status(500).json({ error: 'Failed to update medication' });
  }
});

// Delete medication
router.delete('/medications/:medicationId', requirePermission('meds:prescribe'), async (req, res) => {
  try {
    const { medicationId } = req.params;
    const result = await pool.query('DELETE FROM medications WHERE id = $1 RETURNING *', [medicationId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Medication not found' });
    }

    await logAudit(req.user.id, 'delete_medication', 'medication', medicationId, {}, req.ip);
    res.json({ message: 'Medication deleted' });
  } catch (error) {
    console.error('Error deleting medication:', error);
    res.status(500).json({ error: 'Failed to delete medication' });
  }
});

// Upload patient photo
router.post('/:id/photo', requirePermission('patients:edit_demographics'), upload.single('photo'), async (req, res) => {
  try {
    const { id } = req.params;

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Construct photo URL (relative path that can be served statically)
    const photoUrl = `/api/uploads/patient-photos/${req.file.filename}`;

    // Update patient record with photo URL
    const result = await pool.query(
      'UPDATE patients SET photo_url = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
      [photoUrl, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    await logAudit(req.user.id, 'upload_patient_photo', 'patient', id, {}, req.ip);

    res.json({ photoUrl, patient: result.rows[0] });
  } catch (error) {
    console.error('Error uploading patient photo:', error);
    res.status(500).json({ error: 'Failed to upload patient photo' });
  }
});

// Update patient photo (base64 from webcam)
router.post('/:id/photo/base64', requirePermission('patients:edit_demographics'), async (req, res) => {
  try {
    const { id } = req.params;
    const { photoData } = req.body; // base64 string

    if (!photoData) {
      return res.status(400).json({ error: 'No photo data provided' });
    }

    // Convert base64 to buffer
    const base64Data = photoData.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    // Determine file extension from data URL
    const match = photoData.match(/^data:image\/(\w+);base64,/);
    const extension = match ? match[1] : 'jpg';

    // Generate filename
    const filename = `patient-${id}-${Date.now()}-${Math.round(Math.random() * 1E9)}.${extension}`;
    // Ensure uploadDir exists and is correct
    const patientPhotosDir = path.join(process.env.UPLOAD_DIR || './uploads', 'patient-photos');
    if (!fs.existsSync(patientPhotosDir)) {
      fs.mkdirSync(patientPhotosDir, { recursive: true });
    }
    const filepath = path.join(patientPhotosDir, filename);

    // Save file
    fs.writeFileSync(filepath, buffer);
    console.log('Photo saved to:', filepath);

    // Construct photo URL
    const photoUrl = `/api/uploads/patient-photos/${filename}`;

    // Update patient record
    const result = await pool.query(
      'UPDATE patients SET photo_url = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
      [photoUrl, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    await logAudit(req.user.id, 'upload_patient_photo', 'patient', id, {}, req.ip);

    res.json({ photoUrl, patient: result.rows[0] });
  } catch (error) {
    console.error('Error uploading patient photo:', error);
    res.status(500).json({ error: 'Failed to upload patient photo' });
  }
});

module.exports = router;



