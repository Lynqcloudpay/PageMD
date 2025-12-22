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

// Get all patients (with search) - temporarily public for debugging
router.get('/', async (req, res) => {
  console.log('[PATIENTS-GET] Request received');
  try {
    const { search, limit = 100, offset = 0 } = req.query;
    console.log(`[PATIENTS-GET] Query params: search="${search}", limit=${limit}, offset=${offset}`);

    let query = 'SELECT * FROM patients';
    const params = [];
    let paramCount = 0;

    // All users can see all patients (CLINIC scope is now default for all roles)
    // Only filter by clinic_id if it exists in the user context
    query += ' WHERE 1=1';

    // Filter by clinic_id if user has one (multi-tenant support)
    if (req.user && req.user.clinic_id) {
      console.log(`[PATIENTS-GET] Filtering by clinic_id: ${req.user.clinic_id}`);
      paramCount++;
      query += ` AND clinic_id = $${paramCount}`;
      params.push(req.user.clinic_id);
    } else {
      console.log('[PATIENTS-GET] No clinic_id filtering');
    }

    // Handle search parameter - check if search is provided and not empty
    if (search && search.trim()) {
      console.log(`[PATIENTS-GET] Adding search filter: ${search}`);
      paramCount++;
      query += ` AND (first_name ILIKE $${paramCount} OR last_name ILIKE $${paramCount} OR mrn ILIKE $${paramCount})`;
      params.push(`%${search.trim()}%`);
    }

    query += ` ORDER BY last_name, first_name LIMIT $${++paramCount} OFFSET $${++paramCount}`;
    params.push(parseInt(limit), parseInt(offset));

    console.log(`[PATIENTS-GET] Executing query: ${query}`);
    console.log(`[PATIENTS-GET] Params: ${JSON.stringify(params)}`);

    const result = await pool.query(query, params);

    console.log(`[PATIENTS-GET] Query result rows: ${result.rows.length}`);

    // Decrypt PHI fields before sending response
    const decryptedPatients = await patientEncryptionService.decryptPatientsPHI(result.rows);
    console.log(`[PATIENTS-GET] Decrypted rows: ${decryptedPatients.length}`);

    // Log audit
    const requestId = req.headers['x-request-id'] || crypto.randomUUID();
    // Use try-catch for audit to prevent blocking main response
    try {
      await logAudit(
        req.user.id,
        'patient.list',
        'patient',
        null,
        { search: search ? '[REDACTED]' : null, count: decryptedPatients.length },
        req.ip,
        req.get('user-agent'),
        'success',
        requestId,
        req.sessionId
      );
    } catch (auditErr) {
      console.warn('Audit log failed', auditErr.message);
    }

    res.json(decryptedPatients);
  } catch (error) {
    console.error('[PATIENTS-GET] Error fetching patients:', error);
    console.error(error.stack);
    res.status(500).json({ error: 'Failed to fetch patients' });
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
      // Basic info
      mrn,
      firstName,
      middleName,
      lastName,
      nameSuffix,
      preferredName,
      dob,
      sex,
      gender,
      race,
      ethnicity,
      maritalStatus,

      // Contact
      phone,
      phoneSecondary,
      phoneCell,
      phoneWork,
      phonePreferred,
      email,
      emailSecondary,
      preferredLanguage,
      interpreterNeeded,
      communicationPreference,
      consentToText,
      consentToEmail,

      // Address
      addressLine1,
      addressLine2,
      city,
      state,
      zip,
      country,
      addressType,

      // Employment
      employmentStatus,
      occupation,
      employerName,

      // Emergency Contact
      emergencyContactName,
      emergencyContactPhone,
      emergencyContactRelationship,
      emergencyContactAddress,
      emergencyContact2Name,
      emergencyContact2Phone,
      emergencyContact2Relationship,

      // Insurance
      insuranceProvider,
      insuranceId,
      insuranceGroupNumber,
      insurancePlanName,
      insurancePlanType,
      insuranceSubscriberName,
      insuranceSubscriberDob,
      insuranceSubscriberRelationship,
      insuranceCopay,
      insuranceEffectiveDate,
      insuranceExpiryDate,
      insuranceNotes,

      // Pharmacy
      pharmacyName,
      pharmacyAddress,
      pharmacyPhone,
      pharmacyNpi,
      pharmacyFax,
      pharmacyPreferred,

      // Additional
      referralSource,
      smokingStatus,
      alcoholUse,
      allergiesKnown,
      notes,
      primaryCareProvider,
    } = req.body;

    // Generate MRN if not provided - 6 digit number
    const finalMRN = mrn || String(Math.floor(100000 + Math.random() * 900000));

    // Add optional fields dynamically
    const optionalFields = {
      middle_name: middleName,
      name_suffix: nameSuffix,
      preferred_name: preferredName,
      sex: sex,
      gender: gender,
      race: race,
      ethnicity: ethnicity,
      marital_status: maritalStatus,
      phone: phone,
      phone_secondary: phoneSecondary,
      phone_cell: phoneCell,
      phone_work: phoneWork,
      phone_preferred: phonePreferred,
      email: email,
      email_secondary: emailSecondary,
      preferred_language: preferredLanguage,
      interpreter_needed: interpreterNeeded,
      communication_preference: communicationPreference,
      consent_to_text: consentToText,
      consent_to_email: consentToEmail,
      address_line1: addressLine1,
      address_line2: addressLine2,
      city: city,
      state: state,
      zip: zip,
      country: country || 'United States',
      address_type: addressType || 'Home',
      employment_status: employmentStatus,
      occupation: occupation,
      employer_name: employerName,
      emergency_contact_name: emergencyContactName,
      emergency_contact_phone: emergencyContactPhone,
      emergency_contact_relationship: emergencyContactRelationship,
      emergency_contact_address: emergencyContactAddress,
      emergency_contact_2_name: emergencyContact2Name,
      emergency_contact_2_phone: emergencyContact2Phone,
      emergency_contact_2_relationship: emergencyContact2Relationship,
      insurance_provider: insuranceProvider,
      insurance_id: insuranceId,
      insurance_group_number: insuranceGroupNumber,
      insurance_plan_name: insurancePlanName,
      insurance_plan_type: insurancePlanType,
      insurance_subscriber_name: insuranceSubscriberName,
      insurance_subscriber_dob: insuranceSubscriberDob,
      insurance_subscriber_relationship: insuranceSubscriberRelationship,
      insurance_copay: insuranceCopay,
      insurance_effective_date: insuranceEffectiveDate,
      insurance_expiry_date: insuranceExpiryDate,
      insurance_notes: insuranceNotes,
      pharmacy_name: pharmacyName,
      pharmacy_address: pharmacyAddress,
      pharmacy_phone: pharmacyPhone,
      pharmacy_npi: pharmacyNpi,
      pharmacy_fax: pharmacyFax,
      pharmacy_preferred: pharmacyPreferred,
      referral_source: referralSource,
      smoking_status: smokingStatus,
      alcohol_use: alcoholUse,
      allergies_known: allergiesKnown,
      notes: notes,
      primary_care_provider: primaryCareProvider,
    };

    // Build patient object for encryption
    const patientData = {
      mrn: finalMRN,
      first_name: firstName,
      last_name: lastName,
      dob: dob,
      ...optionalFields
    };

    // Encrypt PHI fields before storing
    const encryptedPatient = await patientEncryptionService.preparePatientForStorage(patientData);

    // List of valid columns in the patients table (to prevent SQL errors)
    const validColumns = new Set([
      'id', 'mrn', 'first_name', 'last_name', 'dob', 'sex',
      'phone', 'email', 'address_line1', 'address_line2', 'city', 'state', 'zip',
      'insurance_provider', 'insurance_id', 'pharmacy_name', 'pharmacy_address', 'pharmacy_phone',
      'primary_care_provider', 'photo_url', 'created_at', 'updated_at'
    ]);

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
      if (value !== undefined && value !== null && value !== '') {
        fields.push(dbField);
        values.push(value);
        paramIndex++;
      }
    }

    // Add encryption_metadata if present
    if (encryptedPatient.encryption_metadata) {
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

    await logAudit(req.user.id, 'create_patient', 'patient', result.rows[0].id, {}, req.ip);

    res.status(201).json(decryptedPatient);
  } catch (error) {
    console.error('Error creating patient:', error);
    if (error.code === '23505') {
      return res.status(400).json({ error: 'MRN already exists' });
    }
    res.status(500).json({ error: 'Failed to create patient', details: error.message });
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

    // Track which fields are being updated
    const changedFields = {};
    const allowedFields = [
      // Basic info
      'first_name', 'middle_name', 'last_name', 'name_suffix', 'preferred_name',
      'dob', 'sex', 'gender', 'race', 'ethnicity', 'marital_status',
      // Contact
      'phone', 'phone_secondary', 'phone_cell', 'phone_work', 'phone_preferred',
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

    // Clinical decision support - OpenEMR style
    const { performClinicalChecks } = require('../middleware/clinical');
    const warnings = await performClinicalChecks(id, medicationName);

    // If high severity warnings exist, return them but don't block (clinician decision)
    if (warnings.some(w => w.severity === 'high')) {
      return res.status(400).json({
        error: 'Clinical warnings detected',
        warnings: warnings,
        message: 'Please review warnings before adding this medication'
      });
    }

    const result = await pool.query(
      `INSERT INTO medications (patient_id, medication_name, dosage, frequency, route, start_date, prescriber_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [id, medicationName, dosage, frequency, route, startDate, req.user.id]
    );

    await logAudit(req.user.id, 'add_medication', 'medication', result.rows[0].id, {
      medication: medicationName,
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
      drugUse, exerciseFrequency, diet, occupation, livingSituation, notes
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
          living_situation = $9, notes = $10, updated_at = CURRENT_TIMESTAMP
         WHERE patient_id = $11 RETURNING *`,
        [smokingStatus, sanitizedPackYears, alcoholUse, alcoholQuantity, drugUse,
          exerciseFrequency, diet, occupation, livingSituation, notes, id]
      );
      await logAudit(req.user.id, 'update_social_history', 'social_history', existing.rows[0].id, {}, req.ip);
    } else {
      // Insert new
      result = await pool.query(
        `INSERT INTO social_history (
          patient_id, smoking_status, smoking_pack_years, alcohol_use, alcohol_quantity,
          drug_use, exercise_frequency, diet, occupation, living_situation, notes
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
        [id, smokingStatus, sanitizedPackYears, alcoholUse, alcoholQuantity, drugUse,
          exerciseFrequency, diet, occupation, livingSituation, notes]
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
    const { medicationName, dosage, frequency, route, startDate, endDate, active } = req.body;

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



