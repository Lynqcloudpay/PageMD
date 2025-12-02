const express = require('express');
const pool = require('../db');
const { authenticate, requireRole, logAudit } = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

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

// Get all patients (with search)
router.get('/', async (req, res) => {
  try {
    const { search, limit = 100, offset = 0 } = req.query;
    let query = 'SELECT * FROM patients';
    const params = [];
    
    // Handle search parameter - check if search is provided and not empty
    if (search && search.trim()) {
      query += ` WHERE first_name ILIKE $1 OR last_name ILIKE $1 OR mrn ILIKE $1`;
      params.push(`%${search.trim()}%`);
      query += ` ORDER BY last_name, first_name LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
      params.push(parseInt(limit), parseInt(offset));
    } else {
      query += ` ORDER BY last_name, first_name LIMIT $1 OFFSET $2`;
      params.push(parseInt(limit), parseInt(offset));
    }

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching patients:', error);
    res.status(500).json({ error: 'Failed to fetch patients' });
  }
});

// Get patient snapshot (front page data) - MUST come before /:id route
router.get('/:id/snapshot', async (req, res) => {
  try {
    const { id } = req.params;

    // Get patient
    let patient;
    try {
      patient = await pool.query('SELECT * FROM patients WHERE id = $1', [id]);
      if (patient.rows.length === 0) {
      return res.status(404).json({ error: 'Patient not found' });
    }
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
    await logAudit(req.user.id, 'view_patient_snapshot', 'patient', id, {}, req.ip);
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
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM patients WHERE id = $1', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching patient:', error);
    console.error('Error details:', error.message, error.stack);
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

// Get patient by ID - MUST come after /:id/snapshot route
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM patients WHERE id = $1', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching patient:', error);
    console.error('Error details:', error.message, error.stack);
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

// Create patient
router.post('/', requireRole('clinician', 'front_desk', 'admin'), async (req, res) => {
  try {
    const {
      mrn,
      firstName,
      lastName,
      dob,
      sex,
      phone,
      email,
      addressLine1,
      addressLine2,
      city,
      state,
      zip,
      insuranceProvider,
      insuranceId,
    } = req.body;

    // Generate MRN if not provided - 6 digit number
    const finalMRN = mrn || String(Math.floor(100000 + Math.random() * 900000));

    const result = await pool.query(
      `INSERT INTO patients (
        mrn, first_name, last_name, dob, sex, phone, email,
        address_line1, address_line2, city, state, zip,
        insurance_provider, insurance_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *`,
      [
        finalMRN, firstName, lastName, dob, sex, phone, email,
        addressLine1, addressLine2, city, state, zip,
        insuranceProvider, insuranceId,
      ]
    );

    await logAudit(req.user.id, 'create_patient', 'patient', result.rows[0].id, {}, req.ip);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating patient:', error);
    if (error.code === '23505') {
      return res.status(400).json({ error: 'MRN already exists' });
    }
    res.status(500).json({ error: 'Failed to create patient' });
  }
});

// Update patient
router.put('/:id', requireRole('clinician', 'front_desk', 'admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const allowedFields = [
      'first_name', 'last_name', 'dob', 'sex', 'phone', 'email',
      'address_line1', 'address_line2', 'city', 'state', 'zip',
      'insurance_provider', 'insurance_id', 'primary_care_provider',
      'pharmacy_name', 'pharmacy_address', 'pharmacy_phone', 'photo_url',
      'emergency_contact_name', 'emergency_contact_phone', 'emergency_contact_relationship',
    ];

    const setClause = [];
    const values = [];
    let paramIndex = 1;

    for (const field of allowedFields) {
      const camelField = field.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
      if (updates[camelField] !== undefined) {
        setClause.push(`${field} = $${paramIndex}`);
        values.push(updates[camelField]);
        paramIndex++;
      }
    }

    if (setClause.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
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

    // Log audit (non-blocking, don't fail if it errors)
    if (req.user && req.user.id) {
      try {
    await logAudit(req.user.id, 'update_patient', 'patient', id, { fields: Object.keys(updates) }, req.ip);
      } catch (auditError) {
        console.warn('Failed to log audit for patient update:', auditError);
      }
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating patient:', error);
    console.error('Error details:', error.message, error.stack);
    res.status(500).json({ error: 'Failed to update patient', message: error.message });
  }
});

// Add allergy
router.post('/:id/allergies', requireRole('clinician', 'nurse'), async (req, res) => {
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
router.post('/:id/medications', requireRole('clinician'), async (req, res) => {
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
router.post('/:id/problems', requireRole('clinician'), async (req, res) => {
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
router.put('/problems/:problemId', requireRole('clinician'), async (req, res) => {
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
router.delete('/problems/:problemId', requireRole('clinician'), async (req, res) => {
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
router.get('/:id/family-history', authenticate, async (req, res) => {
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
router.post('/:id/family-history', requireRole('clinician'), async (req, res) => {
  try {
    const { id } = req.params;
    const { condition, relationship, ageAtDiagnosis, ageAtDeath, notes } = req.body;

    const result = await pool.query(
      `INSERT INTO family_history (patient_id, condition, relationship, age_at_diagnosis, age_at_death, notes)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [id, condition, relationship, ageAtDiagnosis, ageAtDeath, notes]
    );

    await logAudit(req.user.id, 'add_family_history', 'family_history', result.rows[0].id, {}, req.ip);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error adding family history:', error);
    res.status(500).json({ error: 'Failed to add family history' });
  }
});

// Update family history
router.put('/family-history/:historyId', requireRole('clinician'), async (req, res) => {
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
      values.push(ageAtDiagnosis);
      paramIndex++;
    }
    if (ageAtDeath !== undefined) {
      updates.push(`age_at_death = $${paramIndex}`);
      values.push(ageAtDeath);
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
router.delete('/family-history/:historyId', requireRole('clinician'), async (req, res) => {
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
router.get('/:id/social-history', authenticate, async (req, res) => {
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
router.post('/:id/social-history', requireRole('clinician'), async (req, res) => {
  try {
    const { id } = req.params;
    const {
      smokingStatus, smokingPackYears, alcoholUse, alcoholQuantity,
      drugUse, exerciseFrequency, diet, occupation, livingSituation, notes
    } = req.body;

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
        [smokingStatus, smokingPackYears, alcoholUse, alcoholQuantity, drugUse,
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
        [id, smokingStatus, smokingPackYears, alcoholUse, alcoholQuantity, drugUse,
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
router.get('/:id/problems', authenticate, async (req, res) => {
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
router.get('/:id/allergies', authenticate, async (req, res) => {
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
router.get('/:id/medications', authenticate, async (req, res) => {
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
router.put('/allergies/:allergyId', requireRole('clinician', 'nurse'), async (req, res) => {
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
router.delete('/allergies/:allergyId', requireRole('clinician', 'nurse'), async (req, res) => {
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
router.put('/medications/:medicationId', requireRole('clinician'), async (req, res) => {
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
router.delete('/medications/:medicationId', requireRole('clinician'), async (req, res) => {
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
router.post('/:id/photo', requireRole('clinician', 'front_desk', 'admin'), upload.single('photo'), async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Construct photo URL (relative path that can be served statically)
    const photoUrl = `/uploads/patient-photos/${req.file.filename}`;

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
router.post('/:id/photo/base64', requireRole('clinician', 'front_desk', 'admin'), async (req, res) => {
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
    const photoUrl = `/uploads/patient-photos/${filename}`;

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



