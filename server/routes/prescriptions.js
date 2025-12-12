/**
 * Prescription API Routes
 * 
 * Handles e-prescribing workflow:
 * - Create prescriptions
 * - Send prescriptions (Surescripts/electronic)
 * - Retrieve prescription history
 * - Medication reconciliation
 */

const express = require('express');
const pool = require('../db');
const { authenticate, requireRole, logAudit } = require('../middleware/auth');
const rxnormService = require('../services/rxnorm');
const pharmacyService = require('../services/pharmacy');
const validationService = require('../services/validation');

const router = express.Router();
router.use(authenticate);

/**
 * POST /api/prescriptions/create
 * Create a new prescription
 */
router.post('/create', requireRole('clinician'), async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    const {
      patientId,
      visitId,
      medicationRxcui,
      medicationName,
      medicationNdc,
      strength,
      quantity,
      quantityUnit = 'EA',
      daysSupply,
      sig,
      sigStructured,
      refills = 0,
      substitutionAllowed = true,
      pharmacyId,
      pharmacyNcpdpId,
      priorAuthRequired = false,
      clinicalNotes,
      patientInstructions,
      startDate,
      isControlled = false,
      schedule,
      diagnosisIds = [] // Array of problem/diagnosis IDs
    } = req.body;

    // Validation
    if (!patientId) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Patient ID is required' });
    }

    if (!medicationName) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Medication name is required' });
    }

    if (!sig && !sigStructured) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Prescription instructions (sig) are required' });
    }

    // Validate diagnosis requirement
    // Filter out temporary IDs for validation
    const validDiagnosisIds = diagnosisIds.filter(id => id && !id.toString().startsWith('temp-'));
    if (!diagnosisIds || !Array.isArray(diagnosisIds) || validDiagnosisIds.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'At least one valid diagnosis is required for all prescriptions' });
    }

    if (!quantity || quantity <= 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Valid quantity is required' });
    }

    // Validate sig
    if (sigStructured) {
      const sigValidation = validationService.validatePrescriptionSig(sigStructured);
      if (!sigValidation.valid) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: sigValidation.error });
      }
    }

    // Validate quantity
    const quantityValidation = validationService.validatePrescriptionQuantity(quantity, quantityUnit);
    if (!quantityValidation.valid) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: quantityValidation.error });
    }

    // Validate refills
    const refillsValidation = validationService.validatePrescriptionRefills(refills, schedule);
    if (!refillsValidation.valid) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: refillsValidation.error });
    }

    // Get prescriber information
    const prescriber = req.user;
    
    // Get prescriber NPI and DEA if available (should be stored in users table)
    // For now, we'll get from request body or user object
    const prescriberNpi = req.body.prescriberNpi || prescriber.npi;
    const prescriberDea = req.body.prescriberDea || prescriber.dea_number;

    // Validate NPI if provided
    if (prescriberNpi) {
      const npiValidation = validationService.validateNPI(prescriberNpi);
      if (!npiValidation.valid) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `Invalid NPI: ${npiValidation.error}` });
      }
    }

    // Check controlled substance requirements
    if (isControlled || schedule) {
      const controlledValidation = validationService.validateControlledSubstancePrescription(
        schedule,
        prescriberDea
      );
      if (!controlledValidation.valid) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: controlledValidation.error });
      }
    }

    // Get pharmacy information if provided
    let pharmacyInfo = null;
    if (pharmacyId) {
      pharmacyInfo = await pharmacyService.getPharmacyById(pharmacyId);
    } else if (pharmacyNcpdpId) {
      pharmacyInfo = await pharmacyService.getPharmacyByNCPDP(pharmacyNcpdpId);
    }

    // Generate sig text from structured sig if needed
    let sigText = sig;
    if (!sigText && sigStructured) {
      // Use dose from sigStructured if provided, otherwise use strength parameter
      const doseToUse = sigStructured.dose || strength;
      sigText = buildSigText(sigStructured, doseToUse);
    }

    // Calculate dates
    const writtenDate = startDate ? new Date(startDate) : new Date();
    const expiresDate = new Date(writtenDate);
    expiresDate.setFullYear(expiresDate.getFullYear() + 1); // Prescriptions expire after 1 year

    // Create prescription
    const result = await client.query(`
      INSERT INTO prescriptions (
        patient_id, visit_id, prescriber_id, prescriber_npi, prescriber_dea,
        medication_rxcui, medication_name, medication_ndc, strength,
        quantity, quantity_unit, days_supply,
        sig, sig_structured,
        refills, refills_remaining, substitution_allowed,
        pharmacy_id, pharmacy_ncpdp_id, pharmacy_name, pharmacy_address, pharmacy_phone,
        prior_auth_required,
        clinical_notes, patient_instructions,
        is_controlled, schedule,
        written_date, start_date, expires_date,
        status, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32)
      RETURNING *
    `, [
      patientId,
      visitId || null,
      prescriber.id,
      prescriberNpi || null,
      prescriberDea || null,
      medicationRxcui || null,
      medicationName,
      medicationNdc || null,
      strength || null,
      quantity,
      quantityUnit,
      daysSupply || null,
      sigText,
      sigStructured ? JSON.stringify(sigStructured) : null,
      refills,
      refills,
      substitutionAllowed,
      pharmacyInfo?.id || null,
      pharmacyInfo?.ncpdpId || pharmacyNcpdpId || null,
      pharmacyInfo?.name || null,
      pharmacyInfo?.address?.full || null,
      pharmacyInfo?.phone || null,
      priorAuthRequired,
      clinicalNotes || null,
      patientInstructions || null,
      isControlled,
      schedule || null,
      writtenDate,
      startDate ? new Date(startDate) : null,
      expiresDate,
      'draft',
      prescriber.id
    ]);

    const prescription = result.rows[0];

    // Link prescription to diagnoses
    if (diagnosisIds && diagnosisIds.length > 0) {
      for (const problemId of diagnosisIds) {
        // Skip temporary IDs (those starting with 'temp-')
        if (problemId && problemId.toString().startsWith('temp-')) {
          // For temporary IDs, we'll skip linking to order_diagnoses
          // The diagnosis requirement is already validated
          continue;
        }
        
        // Verify the problem exists and belongs to the patient
        const problemCheck = await client.query(
          'SELECT id FROM problems WHERE id = $1 AND patient_id = $2',
          [problemId, patientId]
        );
        
        if (problemCheck.rows.length > 0) {
          await client.query(`
            INSERT INTO order_diagnoses (order_id, problem_id, order_type)
            VALUES ($1, $2, 'prescription')
            ON CONFLICT (order_id, problem_id, order_type) DO NOTHING
          `, [prescription.id, problemId]);
        }
      }
    }

    // Check for drug interactions if medication RxCUI is available
    if (medicationRxcui) {
      try {
        // Get patient's current active medications
        const currentMedsResult = await client.query(`
          SELECT medication_rxcui
          FROM prescriptions
          WHERE patient_id = $1
            AND status IN ('sent', 'accepted', 'in_process', 'ready')
            AND medication_rxcui IS NOT NULL
        `, [patientId]);

        const currentRxcuis = currentMedsResult.rows.map(r => r.medication_rxcui);
        
        if (currentRxcuis.length > 0) {
          const interactions = await rxnormService.checkDrugInteractions([
            ...currentRxcuis,
            medicationRxcui
          ]);

          // Store interactions
          for (const interaction of interactions) {
            await client.query(`
              INSERT INTO prescription_interactions (
                prescription_id, interaction_type, severity, description, medication_rxcui
              ) VALUES ($1, $2, $3, $4, $5)
            `, [
              prescription.id,
              'drug-drug',
              interaction.severity,
              interaction.description,
              medicationRxcui
            ]);
          }

          if (interactions.length > 0) {
            prescription.interactions = interactions;
          }
        }
      } catch (interactionError) {
        console.warn('Error checking drug interactions:', interactionError.message);
        // Don't fail prescription creation if interaction check fails
      }
    }

    await client.query('COMMIT');

    // Log audit
    try {
      await logAudit(req.user.id, 'create_prescription', 'prescription', prescription.id, {
        patientId,
        medicationName,
        status: 'draft'
      }, req.ip);
    } catch (auditError) {
      console.warn('Failed to log audit:', auditError.message);
    }

    res.status(201).json({
      ...prescription,
      sigStructured: prescription.sig_structured ? JSON.parse(prescription.sig_structured) : null
    });

  } catch (error) {
    await client.query('ROLLBACK').catch(() => {}); // Ignore rollback errors
    console.error('Error creating prescription:', error);
    console.error('Error stack:', error.stack);
    console.error('Request body:', JSON.stringify(req.body, null, 2));
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      detail: error.detail,
      constraint: error.constraint
    });
    res.status(500).json({ 
      error: 'Failed to create prescription',
      message: error.message,
      details: process.env.NODE_ENV === 'development' ? {
        message: error.message,
        code: error.code,
        detail: error.detail,
        constraint: error.constraint,
        stack: error.stack
      } : undefined
    });
  } finally {
    client.release();
  }
});

/**
 * POST /api/prescriptions/:id/send
 * Send prescription electronically (Surescripts, fax, etc.)
 */
router.post('/:id/send', requireRole('clinician'), async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    const { id } = req.params;
    const { transmissionMethod = 'electronic', pharmacyId, pharmacyNcpdpId } = req.body;

    // Get prescription
    const prescriptionResult = await client.query(`
      SELECT p.*, pt.first_name, pt.last_name, pt.dob, pt.sex
      FROM prescriptions p
      JOIN patients pt ON p.patient_id = pt.id
      WHERE p.id = $1
    `, [id]);

    if (prescriptionResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Prescription not found' });
    }

    const prescription = prescriptionResult.rows[0];

    // Validate prescription can be sent
    if (prescription.status !== 'draft' && prescription.status !== 'pending') {
      await client.query('ROLLBACK');
      return res.status(400).json({ 
        error: `Cannot send prescription with status: ${prescription.status}` 
      });
    }

    // Get pharmacy information
    let pharmacyInfo = null;
    if (pharmacyId) {
      pharmacyInfo = await pharmacyService.getPharmacyById(pharmacyId);
    } else if (pharmacyNcpdpId) {
      pharmacyInfo = await pharmacyService.getPharmacyByNCPDP(pharmacyNcpdpId);
    } else if (prescription.pharmacy_id) {
      pharmacyInfo = await pharmacyService.getPharmacyById(prescription.pharmacy_id);
    }

    if (!pharmacyInfo && transmissionMethod === 'electronic') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Pharmacy information is required for electronic transmission' });
    }

    // Update pharmacy info if changed
    if (pharmacyInfo) {
      await client.query(`
        UPDATE prescriptions
        SET pharmacy_id = $1,
            pharmacy_ncpdp_id = $2,
            pharmacy_name = $3,
            pharmacy_address = $4,
            pharmacy_phone = $5
        WHERE id = $6
      `, [
        pharmacyInfo.id,
        pharmacyInfo.ncpdpId,
        pharmacyInfo.name,
        pharmacyInfo.address?.full,
        pharmacyInfo.phone,
        id
      ]);
    }

    // Simulate prescription transmission
    // In production, this would integrate with Surescripts, SCRIPT standard, or FHIR R4
    let transmissionStatus = 'sent';
    let transmissionId = null;
    let error = null;

    try {
      // TODO: Implement actual Surescripts/FHIR transmission
      // For now, simulate successful transmission
      transmissionId = `TRAN-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
      
      // Simulate different outcomes based on transmission method
      if (transmissionMethod === 'electronic' && pharmacyInfo?.integrationEnabled) {
        transmissionStatus = 'sent';
      } else if (transmissionMethod === 'fax') {
        transmissionStatus = 'sent'; // Fax is always "sent" but may not be confirmed
      } else {
        transmissionStatus = 'pending';
      }

    } catch (transmissionError) {
      transmissionStatus = 'error';
      error = transmissionError.message;
    }

    // Update prescription status
    const updateResult = await client.query(`
      UPDATE prescriptions
      SET status = $1,
          transmission_method = $2,
          transmission_id = $3,
          transmission_status = $4,
          transmission_error = $5,
          sent_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $6
      RETURNING *
    `, [
      transmissionStatus === 'sent' ? 'sent' : 'pending',
      transmissionMethod,
      transmissionId,
      transmissionStatus,
      error,
      id
    ]);

    await client.query('COMMIT');

    // Log audit
    try {
      await logAudit(req.user.id, 'send_prescription', 'prescription', id, {
        transmissionMethod,
        transmissionStatus,
        pharmacyNcpdpId: pharmacyInfo?.ncpdpId
      }, req.ip);
    } catch (auditError) {
      console.warn('Failed to log audit:', auditError.message);
    }

    res.json({
      ...updateResult.rows[0],
      transmissionId,
      transmissionStatus
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error sending prescription:', error);
    res.status(500).json({ 
      error: 'Failed to send prescription',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    client.release();
  }
});

/**
 * GET /api/prescriptions/patient/:patientId
 * Get all prescriptions for a patient
 */
router.get('/patient/:patientId', requireRole('clinician', 'nurse', 'front_desk'), async (req, res) => {
  try {
    const { patientId } = req.params;
    const { status, limit = 100, offset = 0 } = req.query;

    let query = `
      SELECT p.*,
             u.first_name || ' ' || u.last_name as prescriber_name,
             ph.name as pharmacy_name
      FROM prescriptions p
      LEFT JOIN users u ON p.prescriber_id = u.id
      LEFT JOIN pharmacies ph ON p.pharmacy_id = ph.id
      WHERE p.patient_id = $1
    `;
    
    const params = [patientId];
    let paramIndex = 2;

    if (status) {
      query += ` AND p.status = $${paramIndex++}`;
      params.push(status);
    }

    query += ` ORDER BY p.written_date DESC, p.created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    params.push(parseInt(limit), parseInt(offset));

    const result = await pool.query(query, params);

    // Get diagnoses for each prescription
    const prescriptions = await Promise.all(result.rows.map(async (p) => {
      const diagnosesResult = await pool.query(`
        SELECT pr.id, pr.problem_name, pr.name, pr.icd10_code, pr.icd10Code
        FROM order_diagnoses od
        JOIN problems pr ON od.problem_id = pr.id
        WHERE od.order_id = $1 AND od.order_type = 'prescription'
      `, [p.id]);

      return {
        ...p,
        sigStructured: p.sig_structured ? JSON.parse(p.sig_structured) : null,
        diagnoses: diagnosesResult.rows.map(d => ({
          id: d.id,
          name: d.problem_name || d.name,
          icd10Code: d.icd10_code || d.icd10Code
        }))
      };
    }));

    res.json(prescriptions);

  } catch (error) {
    console.error('Error fetching patient prescriptions:', error);
    res.status(500).json({ error: 'Failed to fetch prescriptions' });
  }
});

/**
 * GET /api/prescriptions/:id
 * Get prescription by ID
 */
router.get('/:id', requireRole('clinician', 'nurse', 'front_desk'), async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(`
      SELECT p.*,
             u.first_name || ' ' || u.last_name as prescriber_name,
             ph.* as pharmacy_info
      FROM prescriptions p
      LEFT JOIN users u ON p.prescriber_id = u.id
      LEFT JOIN pharmacies ph ON p.pharmacy_id = ph.id
      WHERE p.id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Prescription not found' });
    }

    const prescription = result.rows[0];

    // Get interactions
    const interactionsResult = await pool.query(`
      SELECT * FROM prescription_interactions
      WHERE prescription_id = $1
    `, [id]);

    // Get diagnoses
    const diagnosesResult = await pool.query(`
      SELECT pr.id, pr.problem_name, pr.name, pr.icd10_code, pr.icd10Code
      FROM order_diagnoses od
      JOIN problems pr ON od.problem_id = pr.id
      WHERE od.order_id = $1 AND od.order_type = 'prescription'
    `, [id]);

    res.json({
      ...prescription,
      sigStructured: prescription.sig_structured ? JSON.parse(prescription.sig_structured) : null,
      interactions: interactionsResult.rows,
      diagnoses: diagnosesResult.rows.map(d => ({
        id: d.id,
        name: d.problem_name || d.name,
        icd10Code: d.icd10_code || d.icd10Code
      }))
    });

  } catch (error) {
    console.error('Error fetching prescription:', error);
    res.status(500).json({ error: 'Failed to fetch prescription' });
  }
});

/**
 * Helper function to build sig text from structured sig
 */
function buildSigText(sigStructured, medicationStrength = null) {
  const parts = [];
  
  // Use dose from sigStructured if provided, otherwise use medicationStrength parameter
  const dose = sigStructured.dose || medicationStrength;
  if (dose) {
    parts.push(dose);
  }
  
  if (sigStructured.route) {
    parts.push(sigStructured.route.toLowerCase());
  }
  
  if (sigStructured.frequency) {
    parts.push(sigStructured.frequency.toLowerCase());
  }
  
  // Handle new duration structure (durationValue + durationUnit)
  if (sigStructured.durationValue && sigStructured.durationUnit) {
    parts.push(`for ${sigStructured.durationValue} ${sigStructured.durationUnit}`);
  } else if (sigStructured.duration) {
    // Backward compatibility with old duration format
    parts.push(`for ${sigStructured.duration}`);
  }
  
  if (sigStructured.asNeeded) {
    parts.push('as needed');
  }
  
  if (sigStructured.additionalInstructions) {
    parts.push(sigStructured.additionalInstructions);
  }

  return parts.join(' ');
}

module.exports = router;









