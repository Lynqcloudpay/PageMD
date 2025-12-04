const express = require('express');
const pool = require('../db');
const { authenticate, requireRole, logAudit } = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();
router.use(authenticate);

// Generate claim number
function generateClaimNumber() {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `CLM-${timestamp}-${random}`;
}

// ============================================
// COMMERCIAL-GRADE CLAIM CREATION
// ============================================

router.post('/claims', requireRole('admin', 'front_desk', 'clinician'), async (req, res) => {
  const client = await pool.connect();
  
  try {
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
      notes
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
              p.insurance_id as patient_insurance_id
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
    
    // Calculate total charges from procedure codes
    let totalCharges = 0;
    const lineItems = [];
    
    procedureCodes.forEach((proc, index) => {
      const amount = parseFloat(proc.amount || 0);
      const units = parseFloat(proc.units || 1);
      const lineTotal = amount * units;
      totalCharges += lineTotal;
      
      lineItems.push({
        lineNumber: index + 1,
        serviceDate: serviceDate,
        placeOfServiceCode: placeOfServiceCode,
        procedureCode: proc.code,
        procedureModifier: proc.modifier || null,
        procedureDescription: proc.description || '',
        diagnosisPointers: proc.diagnosisPointers || [1], // Default to first diagnosis
        units: units,
        unitCharge: amount,
        lineTotal: lineTotal
      });
    });
    
    // Get principal diagnosis (first diagnosis code)
    const principalDiagnosis = diagnosisCodes[0].code || diagnosisCodes[0];
    
    // Normalize diagnosis codes format
    const normalizedDiagnosisCodes = diagnosisCodes.map(dx => ({
      code: typeof dx === 'string' ? dx : dx.code,
      description: typeof dx === 'string' ? '' : (dx.description || '')
    }));
    
    // Normalize procedure codes format
    const normalizedProcedureCodes = procedureCodes.map(proc => ({
      code: proc.code,
      description: proc.description || '',
      amount: parseFloat(proc.amount || 0),
      units: parseFloat(proc.units || 1)
    }));
    
    // Generate claim number
    const claimNumber = generateClaimNumber();
    
    // Create claim
    const claimResult = await client.query(
      `INSERT INTO claims (
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
      RETURNING *`,
      [
        claimNumber,
        visitId,
        patientId,
        renderingProviderId || req.user.id,
        billingProviderId || req.user.id,
        insuranceProvider || visit.patient_insurance,
        insurancePayerId,
        insuranceMemberId || visit.patient_insurance_id,
        insuranceGroupNumber,
        serviceDate,
        serviceDateEnd || serviceDate,
        placeOfServiceCode,
        'professional',
        JSON.stringify(normalizedDiagnosisCodes),
        principalDiagnosis,
        JSON.stringify(normalizedProcedureCodes),
        totalCharges,
        'draft',
        req.user.id,
        notes || null
      ]
    );
    
    const claim = claimResult.rows[0];
    
    // Create line items
    for (const lineItem of lineItems) {
      await client.query(
        `INSERT INTO claim_line_items (
          claim_id, line_number, service_date,
          place_of_service_code, procedure_code, procedure_modifier,
          procedure_description, diagnosis_pointers,
          units, unit_charge, line_total
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          claim.id,
          lineItem.lineNumber,
          lineItem.serviceDate,
          lineItem.placeOfServiceCode,
          lineItem.procedureCode,
          lineItem.procedureModifier,
          lineItem.procedureDescription,
          `{${lineItem.diagnosisPointers.join(',')}}`,
          lineItem.units,
          lineItem.unitCharge,
          lineItem.lineTotal
        ]
      );
    }
    
    // Create workflow history entry
    await client.query(
      `INSERT INTO claim_workflow_history (claim_id, from_status, to_status, action, performed_by)
       VALUES ($1, NULL, 'draft', 'Claim created', $2)`,
      [claim.id, req.user.id]
    );
    
    await logAudit(req.user.id, 'create_claim', 'claim', claim.id, { claimNumber }, req.ip);
    
    await client.query('COMMIT');
    
    // Fetch complete claim with line items
    const completeClaim = await client.query(
      `SELECT c.*, 
              json_agg(cli.*) FILTER (WHERE cli.id IS NOT NULL) as line_items
       FROM claims c
       LEFT JOIN claim_line_items cli ON c.id = cli.claim_id
       WHERE c.id = $1
       GROUP BY c.id`,
      [claim.id]
    );
    
    res.status(201).json(completeClaim.rows[0]);
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating claim:', error);
    res.status(500).json({ error: error.message || 'Failed to create claim' });
  } finally {
    client.release();
  }
});

// Get claim with full details
router.get('/claims/:id', requireRole('admin', 'front_desk', 'clinician'), async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get claim with all related data
    const claimResult = await pool.query(
      `SELECT c.*,
              json_agg(DISTINCT cli.*) FILTER (WHERE cli.id IS NOT NULL) as line_items,
              json_agg(DISTINCT pp.*) FILTER (WHERE pp.id IS NOT NULL) as payments,
              json_agg(DISTINCT cd.*) FILTER (WHERE cd.id IS NOT NULL) as denials
       FROM claims c
       LEFT JOIN claim_line_items cli ON c.id = cli.claim_id
       LEFT JOIN payment_postings pp ON c.id = pp.claim_id
       LEFT JOIN claim_denials cd ON c.id = cd.claim_id
       WHERE c.id = $1
       GROUP BY c.id`,
      [id]
    );
    
    if (claimResult.rows.length === 0) {
      return res.status(404).json({ error: 'Claim not found' });
    }
    
    res.json(claimResult.rows[0]);
  } catch (error) {
    console.error('Error fetching claim:', error);
    res.status(500).json({ error: 'Failed to fetch claim' });
  }
});

// Update claim status with workflow tracking
router.put('/claims/:id/status', requireRole('admin', 'front_desk'), async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { id } = req.params;
    const { status, notes } = req.body;
    
    // Get current claim status
    const currentClaim = await client.query(
      'SELECT status FROM claims WHERE id = $1',
      [id]
    );
    
    if (currentClaim.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Claim not found' });
    }
    
    const oldStatus = currentClaim.rows[0].status;
    
    // Update claim
    const updates = ['status = $1', 'updated_at = CURRENT_TIMESTAMP', 'updated_by = $2'];
    const params = [status, req.user.id];
    let paramIndex = 3;
    
    if (status === 'submitted') {
      updates.push(`submitted_at = CURRENT_TIMESTAMP`);
      updates.push(`submitted_by = $${paramIndex++}`);
      params.push(req.user.id);
    }
    
    params.push(id);
    
    await client.query(
      `UPDATE claims SET ${updates.join(', ')} WHERE id = $${paramIndex}`,
      params
    );
    
    // Create workflow history
    await client.query(
      `INSERT INTO claim_workflow_history (claim_id, from_status, to_status, action, notes, performed_by)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [id, oldStatus, status, `Status changed from ${oldStatus} to ${status}`, notes || null, req.user.id]
    );
    
    await logAudit(req.user.id, 'update_claim_status', 'claim', id, { oldStatus, newStatus: status }, req.ip);
    
    await client.query('COMMIT');
    
    // Fetch updated claim
    const updatedClaim = await client.query('SELECT * FROM claims WHERE id = $1', [id]);
    
    res.json(updatedClaim.rows[0]);
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error updating claim status:', error);
    res.status(500).json({ error: 'Failed to update claim status' });
  } finally {
    client.release();
  }
});

// Submit claim for processing
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
    if (!claim.diagnosis_codes || claim.diagnosis_codes.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Claim must have at least one diagnosis code' });
    }
    
    if (!claim.procedure_codes || claim.procedure_codes.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Claim must have at least one procedure code' });
    }
    
    // Update claim status
    await client.query(
      `UPDATE claims 
       SET status = 'submitted',
           submission_method = $1,
           submitted_at = CURRENT_TIMESTAMP,
           submitted_by = $2,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $3`,
      [submissionMethod, req.user.id, id]
    );
    
    // Create workflow history
    await client.query(
      `INSERT INTO claim_workflow_history (claim_id, from_status, to_status, action, performed_by)
       VALUES ($1, $2, 'submitted', 'Claim submitted for processing', $3)`,
      [id, claim.status, req.user.id]
    );
    
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

module.exports = router;






