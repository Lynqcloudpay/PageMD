const express = require('express');
const pool = require('../db');
const { authenticate, requireRole, logAudit } = require('../middleware/auth');
const { requirePermission } = require('../services/authorization');

const router = express.Router();
router.use(authenticate);

// ============================================
// COMMERCIAL-GRADE BILLING SYSTEM
// Matches workflow of Epic, Cerner, Allscripts
// ============================================

// Middleware to check for billing lock
const checkBillingLock = (req, res, next) => {
  if (req.clinic?.billing_locked && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    logAudit(req, 'billing_access_blocked', {
      reason: 'Billing Lock Active',
      path: req.path,
      method: req.method
    });
    return res.status(403).json({
      error: 'Financial operations are currently locked for this clinic by platform administrators.',
      code: 'BILLING_LOCKED'
    });
  }
  next();
};

router.use(checkBillingLock);

// Helper function to check if column exists
async function columnExists(tableName, columnName) {
  try {
    const result = await pool.query(
      `SELECT column_name 
       FROM information_schema.columns 
       WHERE table_name = $1 AND column_name = $2`,
      [tableName, columnName]
    );
    return result.rows.length > 0;
  } catch (error) {
    return false;
  }
}

// Helper function to check if table exists
async function tableExists(tableName) {
  try {
    const result = await pool.query(
      `SELECT table_name 
       FROM information_schema.tables 
       WHERE table_name = $1`,
      [tableName]
    );
    return result.rows.length > 0;
  } catch (error) {
    return false;
  }
}

// Generate claim number
function generateClaimNumber() {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `CLM-${timestamp}-${random}`;
}

// ============================================
// FEE SCHEDULE
// ============================================

router.get('/fee-schedule', requireRole('admin', 'clinician', 'front_desk'), async (req, res) => {
  try {
    const { code_type, search } = req.query;
    let query = 'SELECT * FROM fee_schedule WHERE active = true';
    const params = [];

    if (code_type) {
      params.push(code_type);
      query += ` AND code_type = $${params.length}`;
    }

    if (search) {
      params.push(`%${search}%`);
      query += ` AND (code ILIKE $${params.length} OR description ILIKE $${params.length})`;
    }

    query += ' ORDER BY code_type, code LIMIT 200';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching fee schedule:', error);
    res.status(500).json({ error: 'Failed to fetch fee schedule' });
  }
});

// ============================================
// INSURANCE PROVIDERS
// ============================================

router.get('/insurance', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT DISTINCT insurance_provider FROM patients WHERE insurance_provider IS NOT NULL AND insurance_provider != \'\' ORDER BY insurance_provider'
    );
    res.json(result.rows.map(r => r.insurance_provider));
  } catch (error) {
    console.error('Error fetching insurance providers:', error);
    res.status(500).json({ error: 'Failed to fetch insurance providers' });
  }
});

// ============================================
// CLAIM CREATION - COMMERCIAL GRADE
// ============================================

router.post('/claims', requirePermission('billing:edit'), async (req, res) => {
  const client = await pool.connect();

  try {
    // Check if claims table exists BEFORE starting transaction
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'claims'
      );
    `);

    if (!tableCheck.rows[0].exists) {
      // Create basic claims table if it doesn't exist
      await pool.query(`
        CREATE TABLE IF NOT EXISTS claims (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          visit_id UUID REFERENCES visits(id),
          patient_id UUID NOT NULL REFERENCES patients(id),
          diagnosis_codes JSONB,
          procedure_codes JSONB,
          total_amount DECIMAL(10, 2),
          status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'submitted', 'paid', 'denied', 'cancelled')),
          insurance_provider VARCHAR(255),
          claim_number VARCHAR(100),
          submitted_at TIMESTAMP,
          paid_at TIMESTAMP,
          created_by UUID NOT NULL REFERENCES users(id),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      console.log('Created claims table (basic schema)');
    }

    await client.query('BEGIN');

    const {
      visitId,
      diagnosisCodes,
      procedureCodes,
      insuranceProvider,
      insurancePayerId,
      insuranceMemberId,
      insuranceGroupNumber,
      placeOfServiceCode = '11', // Default to Office
      serviceDateStart,
      serviceDateEnd,
      renderingProviderId,
      billingProviderId,
      notes,
      billingNotes,
      qualityMeasures
    } = req.body;

    // Validation
    if (!visitId) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Visit ID is required' });
    }

    if (!diagnosisCodes || !Array.isArray(diagnosisCodes) || diagnosisCodes.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'At least one diagnosis code is required' });
    }

    if (!procedureCodes || !Array.isArray(procedureCodes) || procedureCodes.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'At least one procedure code is required' });
    }

    // Get visit and patient information
    const visitResult = await client.query(
      `SELECT v.*, p.id as patient_id, p.insurance_provider as patient_insurance, 
              p.insurance_id as patient_insurance_id, p.first_name, p.last_name, p.date_of_birth,
              v.visit_date
       FROM visits v
       JOIN patients p ON v.patient_id = p.id
       WHERE v.id = $1`,
      [visitId]
    );

    if (visitResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Visit not found' });
    }

    const visit = visitResult.rows[0];
    const patientId = visit.patient_id;

    // Use visit date as service date if not provided
    const serviceDate = serviceDateStart || visit.visit_date;

    // Normalize diagnosis codes
    const normalizedDiagnosisCodes = diagnosisCodes.map(dx => {
      if (typeof dx === 'string') {
        return { code: dx, description: '', sequence: 1 };
      }
      return {
        code: dx.code || dx,
        description: dx.description || '',
        sequence: dx.sequence || 1
      };
    });

    // Get principal diagnosis (first diagnosis code)
    const principalDiagnosis = normalizedDiagnosisCodes[0].code;

    // Normalize procedure codes and calculate totals
    let totalCharges = 0;
    const normalizedProcedureCodes = procedureCodes.map(proc => {
      const amount = parseFloat(proc.amount || 0);
      const units = parseFloat(proc.units || 1);
      const lineTotal = amount * units;
      totalCharges += lineTotal;

      return {
        code: proc.code || proc,
        description: proc.description || '',
        amount: amount,
        units: units,
        modifier: proc.modifier || null,
        diagnosisPointers: proc.diagnosisPointers || [1]
      };
    });

    // Generate claim number
    const claimNumber = generateClaimNumber();

    // Check which columns exist in the claims table
    const hasEnhancedSchema = await columnExists('claims', 'service_date_start');

    // Determine the correct status based on schema
    const initialStatus = hasEnhancedSchema ? 'draft' : 'pending';

    // Log schema detection for debugging
    if (process.env.NODE_ENV === 'development') {
      console.log('Schema detection - hasEnhancedSchema:', hasEnhancedSchema);
      const serviceDateExists = await columnExists('claims', 'service_date_start');
      const claimNumberExists = await columnExists('claims', 'claim_number');
      const totalChargesExists = await columnExists('claims', 'total_charges');
      console.log('Column checks - service_date_start:', serviceDateExists, 'claim_number:', claimNumberExists, 'total_charges:', totalChargesExists);
    }

    // Build INSERT query based on available columns
    let insertQuery;
    let insertParams;

    if (hasEnhancedSchema) {
      // Enhanced schema with all commercial-grade fields
      insertQuery = `
        INSERT INTO claims (
          claim_number, visit_id, patient_id,
          rendering_provider_id, billing_provider_id,
          insurance_provider, insurance_payer_id, 
          insurance_member_id, insurance_group_number,
          service_date_start, service_date_end,
          place_of_service_code, claim_type,
          diagnosis_codes, principal_diagnosis_code,
          procedure_codes, total_charges,
          status, created_by, notes
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
        RETURNING *
      `;
      insertParams = [
        claimNumber,
        visitId,
        patientId,
        renderingProviderId || req.user.id,
        billingProviderId || req.user.id,
        insuranceProvider || visit.patient_insurance,
        insurancePayerId || null,
        insuranceMemberId || visit.patient_insurance_id,
        insuranceGroupNumber || null,
        serviceDate,
        serviceDateEnd || serviceDate,
        placeOfServiceCode,
        'professional',
        JSON.stringify(normalizedDiagnosisCodes),
        principalDiagnosis,
        JSON.stringify(normalizedProcedureCodes),
        totalCharges,
        initialStatus, // Use the correct status based on schema
        req.user.id,
        notes || billingNotes || null
      ];
    } else {
      // Basic schema fallback
      insertQuery = `
        INSERT INTO claims (
          visit_id, patient_id, diagnosis_codes, 
          procedure_codes, total_amount, status, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7) 
        RETURNING *
      `;
      insertParams = [
        visitId,
        patientId,
        JSON.stringify(normalizedDiagnosisCodes),
        JSON.stringify(normalizedProcedureCodes),
        totalCharges,
        initialStatus, // Use the correct status based on schema (pending for basic)
        req.user.id
      ];
    }

    // Log the query for debugging
    if (process.env.NODE_ENV === 'development') {
      console.log('Creating claim with query:', insertQuery.substring(0, 200));
      console.log('Parameters count:', insertParams.length);
      console.log('Has enhanced schema:', hasEnhancedSchema);
    }

    let result;
    try {
      result = await client.query(insertQuery, insertParams);
    } catch (insertError) {
      console.error('INSERT query failed:', insertError.message);
      console.error('Query:', insertQuery);
      console.error('Params:', insertParams.map((p, i) => `$${i + 1}: ${typeof p} - ${JSON.stringify(p).substring(0, 100)}`));
      throw insertError; // Re-throw to be caught by outer catch
    }

    if (!result || !result.rows || result.rows.length === 0) {
      throw new Error('Claim was not created - no rows returned');
    }

    const claim = result.rows[0];

    // Create line items if table exists
    const lineItemsTableExists = await tableExists('claim_line_items');
    if (lineItemsTableExists) {
      for (let i = 0; i < normalizedProcedureCodes.length; i++) {
        const proc = normalizedProcedureCodes[i];
        try {
          await client.query(
            `INSERT INTO claim_line_items (
              claim_id, line_number, service_date,
              place_of_service_code, procedure_code, procedure_modifier,
              procedure_description, diagnosis_pointers,
              units, unit_charge, line_total
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
            [
              claim.id,
              i + 1,
              serviceDate,
              placeOfServiceCode,
              proc.code,
              proc.modifier || null,
              proc.description,
              `{${proc.diagnosisPointers.join(',')}}`,
              proc.units || 1,
              proc.amount,
              (proc.amount || 0) * (proc.units || 1)
            ]
          );
        } catch (lineItemError) {
          console.log('Error creating line item (non-critical):', lineItemError.message);
        }
      }
    }

    // Create workflow history if table exists
    const workflowTableExists = await tableExists('claim_workflow_history');
    if (workflowTableExists) {
      try {
        await client.query(
          `INSERT INTO claim_workflow_history (claim_id, from_status, to_status, action, performed_by)
           VALUES ($1, NULL, $2, 'Claim created', $3)`,
          [claim.id, initialStatus, req.user.id]
        );
      } catch (workflowError) {
        console.log('Error creating workflow history (non-critical):', workflowError.message);
      }
    }

    await client.query('COMMIT');

    // Log audit after commit (non-critical, don't fail request if it fails)
    try {
      await logAudit(req.user.id, 'create_claim', 'claim', claim.id, {
        claimNumber: claim.claim_number || claimNumber,
        patientId,
        visitId,
        totalCharges
      }, req.ip);
    } catch (auditError) {
      console.warn('Failed to log audit (non-critical):', auditError.message);
    }

    // Return claim with all details
    res.status(201).json({
      ...claim,
      totalAmount: claim.total_amount || claim.total_charges || totalCharges,
      totalCharges: totalCharges
    });

  } catch (error) {
    await client.query('ROLLBACK').catch(() => { }); // Ignore rollback errors
    console.error('Error creating claim:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      detail: error.detail,
      constraint: error.constraint,
      table: error.table,
      column: error.column,
      stack: error.stack
    });

    // Provide more specific error messages
    let errorMessage = 'Failed to create claim';
    if (error.code === '23505') {
      errorMessage = 'A claim with this number already exists';
    } else if (error.code === '23503') {
      errorMessage = `Referenced ${error.table || 'record'} not found`;
    } else if (error.code === '42703') {
      errorMessage = `Database column error: ${error.message}`;
    } else if (error.message) {
      errorMessage = error.message;
    }

    res.status(500).json({
      error: errorMessage,
      details: process.env.NODE_ENV === 'development' ? {
        message: error.message,
        code: error.code,
        detail: error.detail,
        constraint: error.constraint,
        table: error.table,
        column: error.column
      } : undefined
    });
  } finally {
    client.release();
  }
});

// ============================================
// GET CLAIMS
// ============================================

router.get('/claims', requirePermission('billing:view'), async (req, res) => {
  try {
    const { status, patientId, dateFrom, dateTo, limit = 100, offset = 0 } = req.query;
    let claims = [];
    const params = [];
    let paramIndex = 1;

    // Import decryption service
    const { decryptPatientPHI } = require('../services/patientEncryptionService');

    // 1. Fetch Existing Claims (if table exists)
    const tableExistsResult = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'claims'
      );
    `);

    if (tableExistsResult.rows[0].exists) {
      // Basic query for claims - include encryption_metadata for decryption
      let query = `
        SELECT c.*, 
               v.visit_date, v.visit_type,
               p.first_name as patient_first_name, 
               p.last_name as patient_last_name, 
               p.mrn as patient_mrn,
               p.encryption_metadata,
               u.first_name || ' ' || u.last_name as created_by_name,
               'submitted' as record_type
        FROM claims c
        JOIN visits v ON c.visit_id = v.id
        JOIN patients p ON v.patient_id = p.id
        LEFT JOIN users u ON c.created_by = u.id
        WHERE 1=1
      `;

      if (status && status !== 'unbilled') {
        params.push(status);
        query += ` AND c.status = $${paramIndex++}`;
      }

      if (patientId) {
        params.push(patientId);
        query += ` AND c.patient_id = $${paramIndex++}`;
      }

      // Date filters...
      if (dateFrom) {
        params.push(dateFrom);
        query += ` AND c.created_at >= $${paramIndex++}`;
      }
      if (dateTo) {
        params.push(dateTo);
        query += ` AND c.created_at <= $${paramIndex++}`;
      }

      query += ` ORDER BY c.created_at DESC`;

      const result = await pool.query(query, params);

      // Decrypt patient names
      for (const claim of result.rows) {
        if (claim.encryption_metadata) {
          try {
            const decrypted = await decryptPatientPHI({
              first_name: claim.patient_first_name,
              last_name: claim.patient_last_name,
              encryption_metadata: claim.encryption_metadata
            });
            claim.patient_first_name = decrypted.first_name;
            claim.patient_last_name = decrypted.last_name;
          } catch (e) {
            // Keep original if decryption fails
          }
          delete claim.encryption_metadata;
        }
      }

      claims = result.rows.map(claim => ({
        ...claim,
        id: claim.id,
        status: claim.status || 'pending',
        diagnosis_codes: typeof claim.diagnosis_codes === 'string' ? JSON.parse(claim.diagnosis_codes || '[]') : claim.diagnosis_codes,
        procedure_codes: typeof claim.procedure_codes === 'string' ? JSON.parse(claim.procedure_codes || '[]') : claim.procedure_codes
      }));
    }

    // 2. Fetch Unbilled Encounters
    if (!status || status === 'unbilled') {
      let unbilledQuery = `
            SELECT 
                v.id as visit_id, 
                v.visit_date, 
                v.visit_type,
                p.id as patient_id,
                p.first_name as patient_first_name, 
                p.last_name as patient_last_name, 
                p.mrn as patient_mrn,
                p.encryption_metadata,
                SUM(b.fee * b.units) as calculated_total,
                MIN(b.date) as first_billing_date
            FROM visits v
            JOIN patients p ON v.patient_id = p.id
            JOIN billing b ON v.id = b.encounter
            LEFT JOIN claims c ON v.id = c.visit_id
            WHERE b.activity = true 
            AND c.id IS NULL
        `;

      const unbilledParams = [];
      let ubIdx = 1;

      if (patientId) {
        unbilledQuery += ` AND v.patient_id = $${ubIdx++}`;
        unbilledParams.push(patientId);
      }

      if (dateFrom) {
        unbilledQuery += ` AND v.visit_date >= $${ubIdx++}`;
        unbilledParams.push(dateFrom);
      }
      if (dateTo) {
        unbilledQuery += ` AND v.visit_date <= $${ubIdx++}`;
        unbilledParams.push(dateTo);
      }

      unbilledQuery += ` GROUP BY v.id, p.id, v.visit_date, v.visit_type, p.first_name, p.last_name, p.mrn, p.encryption_metadata`;

      const unbilledRes = await pool.query(unbilledQuery, unbilledParams);

      // Decrypt patient names for unbilled
      for (const row of unbilledRes.rows) {
        if (row.encryption_metadata) {
          try {
            const decrypted = await decryptPatientPHI({
              first_name: row.patient_first_name,
              last_name: row.patient_last_name,
              encryption_metadata: row.encryption_metadata
            });
            row.patient_first_name = decrypted.first_name;
            row.patient_last_name = decrypted.last_name;
          } catch (e) {
            // Keep original if decryption fails
          }
        }
      }

      const unbilledItems = unbilledRes.rows.map(row => ({
        id: 'draft-' + row.visit_id,
        visit_id: row.visit_id,
        patient_id: row.patient_id,
        claim_number: 'DRAFT',
        status: 'unbilled',
        visit_date: row.visit_date,
        visit_type: row.visit_type,
        patient_first_name: row.patient_first_name,
        patient_last_name: row.patient_last_name,
        patient_mrn: row.patient_mrn,
        total_amount: row.calculated_total || 0,
        created_at: row.first_billing_date || row.visit_date,
        record_type: 'unbilled'
      }));

      claims = [...claims, ...unbilledItems];
    }

    // 3. Sort and Paginate
    claims.sort((a, b) => new Date(b.created_at || b.visit_date) - new Date(a.created_at || a.visit_date));
    const paginatedClaims = claims.slice(parseInt(offset), parseInt(offset) + parseInt(limit));

    res.json(paginatedClaims);
  } catch (error) {
    console.error('Error fetching claims:', error);
    res.status(500).json({
      error: 'Failed to fetch claims',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Get claim by ID with full details
router.get('/claims/:id', requirePermission('billing:view'), async (req, res) => {
  try {
    const { id } = req.params;

    const claimResult = await pool.query(
      `SELECT c.*, 
              v.visit_date, v.visit_type,
              p.first_name as patient_first_name, 
              p.last_name as patient_last_name, 
              p.mrn as patient_mrn,
              p.date_of_birth as patient_dob
       FROM claims c
       JOIN visits v ON c.visit_id = v.id
       JOIN patients p ON v.patient_id = p.id
       WHERE c.id = $1`,
      [id]
    );

    if (claimResult.rows.length === 0) {
      return res.status(404).json({ error: 'Claim not found' });
    }

    let claim = claimResult.rows[0];

    // Parse JSONB fields
    claim.diagnosis_codes = typeof claim.diagnosis_codes === 'string'
      ? JSON.parse(claim.diagnosis_codes)
      : claim.diagnosis_codes;
    claim.procedure_codes = typeof claim.procedure_codes === 'string'
      ? JSON.parse(claim.procedure_codes)
      : claim.procedure_codes;

    // Get line items if table exists
    const lineItemsTableExists = await tableExists('claim_line_items');
    if (lineItemsTableExists) {
      try {
        const lineItemsResult = await pool.query(
          'SELECT * FROM claim_line_items WHERE claim_id = $1 ORDER BY line_number',
          [id]
        );
        claim.line_items = lineItemsResult.rows;
      } catch (error) {
        console.log('Error fetching line items (non-critical):', error.message);
      }
    }

    res.json(claim);
  } catch (error) {
    console.error('Error fetching claim:', error);
    res.status(500).json({ error: 'Failed to fetch claim' });
  }
});

// Get claims by patient
router.get('/claims/patient/:patientId', requirePermission('billing:view'), async (req, res) => {
  try {
    const { patientId } = req.params;
    const result = await pool.query(
      `SELECT c.*, v.visit_date, v.visit_type,
              p.first_name as patient_first_name, p.last_name as patient_last_name
       FROM claims c
       LEFT JOIN visits v ON c.visit_id = v.id
       JOIN patients p ON c.patient_id = p.id
       WHERE c.patient_id = $1
       ORDER BY c.created_at DESC`,
      [patientId]
    );

    // Parse JSONB fields
    const claims = result.rows.map(claim => ({
      ...claim,
      diagnosis_codes: typeof claim.diagnosis_codes === 'string'
        ? JSON.parse(claim.diagnosis_codes)
        : claim.diagnosis_codes,
      procedure_codes: typeof claim.procedure_codes === 'string'
        ? JSON.parse(claim.procedure_codes)
        : claim.procedure_codes
    }));

    res.json(claims);
  } catch (error) {
    console.error('Error fetching claims:', error);
    res.status(500).json({ error: 'Failed to fetch claims' });
  }
});

// ============================================
// UPDATE CLAIM
// ============================================

router.put('/claims/:id', requireRole('admin', 'front_desk'), async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const { id } = req.params;
    const {
      status,
      claimNumber,
      insuranceProvider,
      diagnosisCodes,
      procedureCodes,
      notes
    } = req.body;

    // Get current claim
    const currentClaim = await client.query(
      'SELECT status FROM claims WHERE id = $1',
      [id]
    );

    if (currentClaim.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Claim not found' });
    }

    const oldStatus = currentClaim.rows[0].status;

    // Build update query
    const updates = [];
    const params = [];
    let paramIndex = 1;

    if (status) {
      updates.push(`status = $${paramIndex++}`);
      params.push(status);

      // Update timestamps based on status
      if (status === 'submitted') {
        updates.push(`submitted_at = CURRENT_TIMESTAMP`);
        const hasSubmittedBy = await columnExists('claims', 'submitted_by');
        if (hasSubmittedBy) {
          updates.push(`submitted_by = $${paramIndex++}`);
          params.push(req.user.id);
        }
      }
      if (status === 'paid' || status === 'partial_paid') {
        updates.push(`paid_at = CURRENT_TIMESTAMP`);
      }
    }

    if (claimNumber) {
      updates.push(`claim_number = $${paramIndex++}`);
      params.push(claimNumber);
    }

    if (insuranceProvider) {
      updates.push(`insurance_provider = $${paramIndex++}`);
      params.push(insuranceProvider);
    }

    if (diagnosisCodes) {
      updates.push(`diagnosis_codes = $${paramIndex++}`);
      params.push(JSON.stringify(diagnosisCodes));
    }

    if (procedureCodes) {
      updates.push(`procedure_codes = $${paramIndex++}`);
      params.push(JSON.stringify(procedureCodes));

      // Recalculate total if procedure codes changed
      const total = procedureCodes.reduce((sum, proc) => {
        return sum + (parseFloat(proc.amount || 0) * parseFloat(proc.units || 1));
      }, 0);

      const hasTotalCharges = await columnExists('claims', 'total_charges');
      if (hasTotalCharges) {
        updates.push(`total_charges = $${paramIndex++}`);
        params.push(total);
      } else {
        updates.push(`total_amount = $${paramIndex++}`);
        params.push(total);
      }
    }

    if (notes !== undefined) {
      updates.push(`notes = $${paramIndex++}`);
      params.push(notes);
    }

    if (updates.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'No fields to update' });
    }

    // Add updated_at and updated_by
    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    const hasUpdatedBy = await columnExists('claims', 'updated_by');
    if (hasUpdatedBy) {
      updates.push(`updated_by = $${paramIndex++}`);
      params.push(req.user.id);
    }

    params.push(id);

    await client.query(
      `UPDATE claims 
       SET ${updates.join(', ')}
       WHERE id = $${paramIndex}
       RETURNING *`,
      params
    );

    // Create workflow history if status changed
    if (status && status !== oldStatus) {
      const workflowTableExists = await tableExists('claim_workflow_history');
      if (workflowTableExists) {
        try {
          await client.query(
            `INSERT INTO claim_workflow_history (claim_id, from_status, to_status, action, performed_by)
             VALUES ($1, $2, $3, $4, $5)`,
            [id, oldStatus, status, `Status changed from ${oldStatus} to ${status}`, req.user.id]
          );
        } catch (error) {
          console.log('Error creating workflow history (non-critical):', error.message);
        }
      }
    }

    await logAudit(req.user.id, 'update_claim', 'claim', id, {
      status,
      oldStatus,
      claimNumber,
      insuranceProvider
    }, req.ip);

    await client.query('COMMIT');

    // Fetch updated claim
    const updatedClaim = await client.query('SELECT * FROM claims WHERE id = $1', [id]);

    res.json(updatedClaim.rows[0]);

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error updating claim:', error);
    res.status(500).json({ error: 'Failed to update claim' });
  } finally {
    client.release();
  }
});

// ============================================
// SUBMIT CLAIM
// ============================================

router.post('/claims/:id/submit', requireRole('admin', 'front_desk'), async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const { id } = req.params;
    const { submissionMethod = 'electronic' } = req.body;

    // Get claim and validate
    const claimResult = await client.query(
      'SELECT * FROM claims WHERE id = $1',
      [id]
    );

    if (claimResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Claim not found' });
    }

    const claim = claimResult.rows[0];

    // Validate claim is ready for submission
    const diagnosisCodes = typeof claim.diagnosis_codes === 'string'
      ? JSON.parse(claim.diagnosis_codes)
      : claim.diagnosis_codes;
    const procedureCodes = typeof claim.procedure_codes === 'string'
      ? JSON.parse(claim.procedure_codes)
      : claim.procedure_codes;

    if (!diagnosisCodes || diagnosisCodes.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Claim must have at least one diagnosis code' });
    }

    if (!procedureCodes || procedureCodes.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Claim must have at least one procedure code' });
    }

    const oldStatus = claim.status;

    // Update claim status
    const hasSubmissionMethod = await columnExists('claims', 'submission_method');
    const hasSubmittedBy = await columnExists('claims', 'submitted_by');

    let updateQuery = `UPDATE claims SET status = 'submitted', submitted_at = CURRENT_TIMESTAMP`;
    const updateParams = [];
    let paramIndex = 1;

    if (hasSubmissionMethod) {
      updateQuery += `, submission_method = $${paramIndex++}`;
      updateParams.push(submissionMethod);
    }

    if (hasSubmittedBy) {
      updateQuery += `, submitted_by = $${paramIndex++}`;
      updateParams.push(req.user.id);
    }

    updateQuery += `, updated_at = CURRENT_TIMESTAMP WHERE id = $${paramIndex++}`;
    updateParams.push(id);

    await client.query(updateQuery, updateParams);

    // Create workflow history
    const workflowTableExists = await tableExists('claim_workflow_history');
    if (workflowTableExists) {
      try {
        await client.query(
          `INSERT INTO claim_workflow_history (claim_id, from_status, to_status, action, performed_by)
           VALUES ($1, $2, 'submitted', 'Claim submitted for processing', $3)`,
          [id, oldStatus, req.user.id]
        );
      } catch (error) {
        console.log('Error creating workflow history (non-critical):', error.message);
      }
    }

    await logAudit(req.user.id, 'submit_claim', 'claim', id, { submissionMethod }, req.ip);

    await client.query('COMMIT');

    const updatedClaim = await client.query('SELECT * FROM claims WHERE id = $1', [id]);

    res.json({
      success: true,
      claim: updatedClaim.rows[0],
      message: 'Claim submitted successfully'
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error submitting claim:', error);
    res.status(500).json({ error: 'Failed to submit claim' });
  } finally {
    client.release();
  }
});

// ============================================
// DELETE CLAIM (only drafts)
// ============================================

router.delete('/claims/:id', requireRole('admin', 'front_desk'), async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const { id } = req.params;

    // Check claim exists and is in draft status
    const claimResult = await client.query(
      'SELECT status FROM claims WHERE id = $1',
      [id]
    );

    if (claimResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Claim not found' });
    }

    if (claimResult.rows[0].status !== 'draft') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Only draft claims can be deleted' });
    }

    await client.query('DELETE FROM claims WHERE id = $1', [id]);

    await logAudit(req.user.id, 'delete_claim', 'claim', id, {}, req.ip);

    await client.query('COMMIT');

    res.json({ success: true, message: 'Claim deleted successfully' });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error deleting claim:', error);
    res.status(500).json({ error: 'Failed to delete claim' });
  } finally {
    client.release();
  }
});

// ============================================
// INSURANCE ELIGIBILITY VERIFICATION
// ============================================

router.post('/eligibility/verify', requireRole('admin', 'front_desk', 'clinician'), async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const {
      patientId,
      insuranceProvider,
      insurancePayerId,
      insuranceMemberId,
      insuranceGroupNumber,
      serviceDate
    } = req.body;

    if (!patientId) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Patient ID is required' });
    }

    // In a real system, this would call an eligibility verification API
    // For now, we'll create a record and mark as active
    const eligibilityTableExists = await tableExists('insurance_eligibility');

    if (eligibilityTableExists) {
      const result = await client.query(
        `INSERT INTO insurance_eligibility (
          patient_id, insurance_provider, insurance_payer_id,
          insurance_member_id, insurance_group_number,
          eligibility_status, verified_at, verified_by, verification_method
        ) VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, $7, $8)
        RETURNING *`,
        [
          patientId,
          insuranceProvider,
          insurancePayerId,
          insuranceMemberId,
          insuranceGroupNumber,
          'active', // Default to active - in production, call real API
          req.user.id,
          'manual'
        ]
      );

      await client.query('COMMIT');
      res.json(result.rows[0]);
    } else {
      // Fallback if table doesn't exist
      await client.query('ROLLBACK');
      res.json({
        patientId,
        eligibilityStatus: 'active',
        verified: true,
        message: 'Eligibility verification table not available'
      });
    }

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error verifying eligibility:', error);
    res.status(500).json({ error: 'Failed to verify eligibility' });
  } finally {
    client.release();
  }
});

router.get('/eligibility/patient/:patientId', requireRole('admin', 'front_desk', 'clinician'), async (req, res) => {
  try {
    const { patientId } = req.params;
    const eligibilityTableExists = await tableExists('insurance_eligibility');

    if (eligibilityTableExists) {
      const result = await pool.query(
        `SELECT * FROM insurance_eligibility 
         WHERE patient_id = $1 
         ORDER BY verified_at DESC 
         LIMIT 10`,
        [patientId]
      );
      res.json(result.rows);
    } else {
      res.json([]);
    }
  } catch (error) {
    console.error('Error fetching eligibility:', error);
    res.status(500).json({ error: 'Failed to fetch eligibility' });
  }
});

// ============================================
// PAYMENT POSTING
// ============================================

router.post('/payments', requireRole('admin', 'front_desk'), async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const {
      claimId,
      paymentDate,
      paymentAmount,
      paymentMethod,
      paymentType = 'insurance_payment',
      checkNumber,
      checkDate,
      referenceNumber,
      traceNumber,
      allocationNotes,
      lineItemAllocations
    } = req.body;

    if (!claimId || !paymentDate || !paymentAmount) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Claim ID, payment date, and payment amount are required' });
    }

    const paymentTableExists = await tableExists('payment_postings');

    if (paymentTableExists) {
      // Create payment posting
      const paymentResult = await client.query(
        `INSERT INTO payment_postings (
          claim_id, payment_date, payment_amount, payment_method,
          payment_type, check_number, check_date, reference_number,
          trace_number, allocation_notes, posted_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *`,
        [
          claimId,
          paymentDate,
          paymentAmount,
          paymentMethod,
          paymentType,
          checkNumber || null,
          checkDate || null,
          referenceNumber || null,
          traceNumber || null,
          allocationNotes || null,
          req.user.id
        ]
      );

      const payment = paymentResult.rows[0];

      // Create allocations if line items are specified
      if (lineItemAllocations && Array.isArray(lineItemAllocations)) {
        const allocationTableExists = await tableExists('payment_allocations');
        if (allocationTableExists) {
          for (const allocation of lineItemAllocations) {
            await client.query(
              `INSERT INTO payment_allocations (
                payment_posting_id, claim_line_item_id,
                allocated_amount, adjustment_amount,
                patient_responsibility, allocation_type, notes
              ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
              [
                payment.id,
                allocation.lineItemId || null,
                allocation.allocatedAmount || 0,
                allocation.adjustmentAmount || 0,
                allocation.patientResponsibility || 0,
                allocation.allocationType || null,
                allocation.notes || null
              ]
            );
          }
        }
      }

      // Update claim amounts
      const claimResult = await client.query(
        'SELECT amount_paid, total_charges FROM claims WHERE id = $1',
        [claimId]
      );

      if (claimResult.rows.length > 0) {
        const currentPaid = parseFloat(claimResult.rows[0].amount_paid || 0);
        const totalCharges = parseFloat(claimResult.rows[0].total_charges || 0);
        const newPaid = currentPaid + parseFloat(paymentAmount);

        const hasAmountPaid = await columnExists('claims', 'amount_paid');
        if (hasAmountPaid) {
          const newStatus = newPaid >= totalCharges ? 'paid' : 'partial_paid';

          await client.query(
            `UPDATE claims 
             SET amount_paid = $1, 
                 status = $2,
                 payment_received_at = CURRENT_TIMESTAMP,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $3`,
            [newPaid, newStatus, claimId]
          );
        }
      }

      await client.query('COMMIT');
      res.status(201).json(payment);
    } else {
      await client.query('ROLLBACK');
      res.status(400).json({ error: 'Payment posting table not available' });
    }

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error posting payment:', error);
    res.status(500).json({ error: 'Failed to post payment' });
  } finally {
    client.release();
  }
});

router.get('/payments/claim/:claimId', requireRole('admin', 'front_desk'), async (req, res) => {
  try {
    const { claimId } = req.params;
    const paymentTableExists = await tableExists('payment_postings');

    if (paymentTableExists) {
      const result = await pool.query(
        `SELECT pp.*, 
                json_agg(pa.*) FILTER (WHERE pa.id IS NOT NULL) as allocations
         FROM payment_postings pp
         LEFT JOIN payment_allocations pa ON pp.id = pa.payment_posting_id
         WHERE pp.claim_id = $1
         GROUP BY pp.id
         ORDER BY pp.payment_date DESC`,
        [claimId]
      );
      res.json(result.rows);
    } else {
      res.json([]);
    }
  } catch (error) {
    console.error('Error fetching payments:', error);
    res.status(500).json({ error: 'Failed to fetch payments' });
  }
});

// ============================================
// DENIAL MANAGEMENT
// ============================================

router.post('/denials', requireRole('admin', 'front_desk'), async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const {
      claimId,
      claimLineItemId,
      denialCode,
      denialReason,
      denialCategory,
      denialDate
    } = req.body;

    if (!claimId || !denialCode || !denialReason) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Claim ID, denial code, and denial reason are required' });
    }

    const denialTableExists = await tableExists('claim_denials');

    if (denialTableExists) {
      const result = await client.query(
        `INSERT INTO claim_denials (
          claim_id, claim_line_item_id, denial_code,
          denial_reason, denial_category, denial_date
        ) VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *`,
        [
          claimId,
          claimLineItemId || null,
          denialCode,
          denialReason,
          denialCategory || null,
          denialDate || new Date().toISOString().split('T')[0]
        ]
      );

      // Update claim status to denied
      await client.query(
        `UPDATE claims 
         SET status = 'denied',
             denial_code = $1,
             denial_reason = $2,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $3`,
        [denialCode, denialReason, claimId]
      );

      await client.query('COMMIT');
      res.status(201).json(result.rows[0]);
    } else {
      await client.query('ROLLBACK');
      res.status(400).json({ error: 'Denial table not available' });
    }

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating denial:', error);
    res.status(500).json({ error: 'Failed to create denial' });
  } finally {
    client.release();
  }
});

router.post('/denials/:id/appeal', requireRole('admin', 'front_desk'), async (req, res) => {
  const client = await pool.connect();

  try {
    const { id } = req.params;
    const { appealStatus = 'appeal_submitted', appealResponse } = req.body;

    const denialTableExists = await tableExists('claim_denials');

    if (denialTableExists) {
      const result = await pool.query(
        `UPDATE claim_denials 
         SET appeal_status = $1,
             appeal_submitted_date = CURRENT_DATE,
             appeal_response = $2,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $3
         RETURNING *`,
        [appealStatus, appealResponse || null, id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Denial not found' });
      }

      // Update claim status if appeal is submitted
      if (appealStatus === 'appeal_submitted') {
        await pool.query(
          `UPDATE claims SET status = 'appealed', updated_at = CURRENT_TIMESTAMP
           WHERE id = (SELECT claim_id FROM claim_denials WHERE id = $1)`,
          [id]
        );
      }

      res.json(result.rows[0]);
    } else {
      res.status(400).json({ error: 'Denial table not available' });
    }
  } catch (error) {
    console.error('Error updating appeal:', error);
    res.status(500).json({ error: 'Failed to update appeal' });
  }
});

router.get('/denials/claim/:claimId', requireRole('admin', 'front_desk'), async (req, res) => {
  try {
    const { claimId } = req.params;
    const denialTableExists = await tableExists('claim_denials');

    if (denialTableExists) {
      const result = await pool.query(
        'SELECT * FROM claim_denials WHERE claim_id = $1 ORDER BY denial_date DESC',
        [claimId]
      );
      res.json(result.rows);
    } else {
      res.json([]);
    }
  } catch (error) {
    console.error('Error fetching denials:', error);
    res.status(500).json({ error: 'Failed to fetch denials' });
  }
});

// ============================================
// PRIOR AUTHORIZATION
// ============================================

router.post('/prior-authorizations', requireRole('admin', 'front_desk', 'clinician'), async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const {
      patientId,
      claimId,
      authorizationNumber,
      insuranceProvider,
      insurancePayerId,
      procedureCodes,
      diagnosisCodes,
      requestedUnits,
      requestedDate,
      serviceStartDate,
      serviceEndDate,
      expirationDate
    } = req.body;

    if (!patientId || !requestedDate) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Patient ID and requested date are required' });
    }

    const priorAuthTableExists = await tableExists('prior_authorizations');

    if (priorAuthTableExists) {
      const result = await client.query(
        `INSERT INTO prior_authorizations (
          patient_id, claim_id, authorization_number,
          insurance_provider, insurance_payer_id,
          procedure_codes, diagnosis_codes,
          requested_units, requested_date,
          service_start_date, service_end_date,
          expiration_date, requested_by, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'pending')
        RETURNING *`,
        [
          patientId,
          claimId || null,
          authorizationNumber || null,
          insuranceProvider,
          insurancePayerId || null,
          procedureCodes || [],
          diagnosisCodes || [],
          requestedUnits || 1,
          requestedDate,
          serviceStartDate || null,
          serviceEndDate || null,
          expirationDate || null,
          req.user.id
        ]
      );

      await client.query('COMMIT');
      res.status(201).json(result.rows[0]);
    } else {
      await client.query('ROLLBACK');
      res.status(400).json({ error: 'Prior authorization table not available' });
    }

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating prior authorization:', error);
    res.status(500).json({ error: 'Failed to create prior authorization' });
  } finally {
    client.release();
  }
});

router.get('/prior-authorizations/patient/:patientId', requireRole('admin', 'front_desk', 'clinician'), async (req, res) => {
  try {
    const { patientId } = req.params;
    const priorAuthTableExists = await tableExists('prior_authorizations');

    if (priorAuthTableExists) {
      const result = await pool.query(
        `SELECT * FROM prior_authorizations 
         WHERE patient_id = $1 
         ORDER BY requested_date DESC 
         LIMIT 50`,
        [patientId]
      );
      res.json(result.rows);
    } else {
      res.json([]);
    }
  } catch (error) {
    console.error('Error fetching prior authorizations:', error);
    res.status(500).json({ error: 'Failed to fetch prior authorizations' });
  }
});

// ============================================
// BILLING STATISTICS/DASHBOARD
// ============================================

router.get('/statistics', requireRole('admin', 'front_desk'), async (req, res) => {
  try {
    const { dateFrom, dateTo } = req.query;

    let whereClause = 'WHERE 1=1';
    const params = [];
    let paramIndex = 1;

    if (dateFrom) {
      params.push(dateFrom);
      whereClause += ` AND (c.service_date_start >= $${paramIndex++} OR c.created_at >= $${paramIndex})`;
      paramIndex++;
    }

    if (dateTo) {
      params.push(dateTo);
      whereClause += ` AND (c.service_date_start <= $${paramIndex++} OR c.created_at <= $${paramIndex})`;
      paramIndex++;
    }

    const statsQuery = `
      SELECT 
        COUNT(*) as total_claims,
        COUNT(*) FILTER (WHERE status = 'draft') as draft_claims,
        COUNT(*) FILTER (WHERE status = 'submitted') as submitted_claims,
        COUNT(*) FILTER (WHERE status = 'paid') as paid_claims,
        COUNT(*) FILTER (WHERE status = 'denied') as denied_claims,
        COUNT(*) FILTER (WHERE status = 'partial_paid') as partial_paid_claims,
        COALESCE(SUM(total_charges), SUM(total_amount), 0) as total_charges,
        COALESCE(SUM(amount_paid), 0) as total_paid,
        COALESCE(SUM(total_charges), SUM(total_amount), 0) - COALESCE(SUM(amount_paid), 0) as outstanding_amount
      FROM claims c
      ${whereClause}
    `;

    const statsResult = await pool.query(statsQuery, params);

    // Get claims by status breakdown
    const statusBreakdownQuery = `
      SELECT status, COUNT(*) as count, 
             COALESCE(SUM(total_charges), SUM(total_amount), 0) as total_amount
      FROM claims c
      ${whereClause}
      GROUP BY status
      ORDER BY count DESC
    `;

    const statusResult = await pool.query(statusBreakdownQuery, params);

    res.json({
      summary: statsResult.rows[0],
      statusBreakdown: statusResult.rows
    });

  } catch (error) {
    console.error('Error fetching billing statistics:', error);
    res.status(500).json({ error: 'Failed to fetch billing statistics' });
  }
});

module.exports = router;
