const express = require('express');
const pool = require('../db');
const { authenticate, logAudit } = require('../middleware/auth');
const { requirePermission } = require('../services/authorization');
const { getTodayDateString } = require('../utils/timezone');
const pdfService = require('../services/pdfService');

const router = express.Router();
router.use(authenticate);

// ============================================
// COMMERICIAL-GRADE SUPERBILL API
// ============================================

/**
 * POST /api/superbills/from-visit/:visitId
 * Creates (or returns existing draft) superbill for visit
 * Prepopulates data from visit, note, and orders
 */
router.post('/from-visit/:visitId', requirePermission('billing:edit'), async (req, res) => {
    const client = await pool.connect();
    try {
        const { visitId } = req.params;

        // Check for existing superbill
        const existingResult = await client.query(
            'SELECT id FROM superbills WHERE visit_id = $1 AND status != \'VOID\' ORDER BY created_at DESC LIMIT 1',
            [visitId]
        );

        if (existingResult.rows.length > 0) {
            return res.json({ id: existingResult.rows[0].id, existing: true });
        }

        await client.query('BEGIN');

        // 1. Get Visit and Patient Info
        const visitResult = await client.query(`
      SELECT v.*, p.id as patient_id, p.insurance_provider, p.insurance_id,
             p.first_name as patient_first_name, p.last_name as patient_last_name,
             p.dob as patient_dob, p.sex as patient_sex,
             u.id as provider_id, u.npi as provider_npi, u.taxonomy_code as provider_taxonomy
      FROM visits v
      JOIN patients p ON v.patient_id = p.id
      JOIN users u ON v.provider_id = u.id
      WHERE v.id = $1
    `, [visitId]);

        if (visitResult.rows.length === 0) {
            throw new Error('Visit not found');
        }

        const visit = visitResult.rows[0];
        const serviceDate = visit.encounter_date || visit.visit_date;

        // 2. Determine default rendering/billing providers and location
        // In a real system, these would come from settings. 
        // Fallback to visit provider and a default location.
        const renderingProviderId = visit.provider_id;
        const billingProviderId = renderingProviderId; // Often the same, or a clinic NPI

        // Try to find a default location
        const locationResult = await client.query('SELECT id FROM locations WHERE active = true LIMIT 1');
        const locationId = locationResult.rows[0]?.id || null;

        // 3. Create Superbill
        const superbillInsert = await client.query(`
      INSERT INTO superbills (
        patient_id, visit_id, status, 
        service_date_from, service_date_to, 
        place_of_service, rendering_provider_id, 
        billing_provider_id, facility_location_id,
        created_by, created_at, updated_at
      ) VALUES ($1, $2, 'DRAFT', $3, $3, '11', $4, $5, $6, $7, NOW(), NOW())
      RETURNING *
    `, [
            visit.patient_id, visitId, serviceDate,
            renderingProviderId, billingProviderId, locationId,
            req.user.id
        ]);

        const superbill = superbillInsert.rows[0];

        // 4. Prepopulate Diagnoses from order_diagnoses/problems
        // 4. Prepopulate Diagnoses
        // First, get diagnoses from orders
        const orderDiags = await client.query(`
          SELECT DISTINCT pr.icd10_code, pr.problem_name as description
          FROM order_diagnoses od
          JOIN problems pr ON od.problem_id = pr.id
          WHERE od.order_id IN (SELECT id FROM orders WHERE visit_id = $1)
          OR od.order_id IN (SELECT id FROM referrals WHERE visit_id = $1)
        `, [visitId]);

        const allDiags = [...orderDiags.rows];

        // Second, parse from note_draft (Assessment section)
        if (visit.note_draft) {
            // Find "Assessment:" section
            const assessmentMatch = visit.note_draft.match(/Assessment:([\s\S]*?)(?:Plan:|$)/i);
            if (assessmentMatch && assessmentMatch[1]) {
                const assessmentText = assessmentMatch[1];
                // Regex for "Code - Description" e.g., "I10 - Hypertension" or "I10 Hypertension"
                // Matches standard ICD-10 format: [A-Z][0-9]{2}(?:\.[0-9]{1,4})?
                const diagMatches = assessmentText.matchAll(/([A-Z][0-9]{2}(?:\.[0-9]{1,4})?)\s*[-–:]?\s*([^\n]+)/g);

                for (const match of diagMatches) {
                    const code = match[1];
                    const description = match[2].trim();
                    // Avoid duplicates
                    if (!allDiags.find(d => d.icd10_code === code)) {
                        allDiags.push({ icd10_code: code, description });
                    }
                }
            }
        }

        // Insert distinct ICD-10 codes (limit 12)
        const uniqueDiags = [];
        const seenCodes = new Set();
        for (const d of allDiags) {
            if (!seenCodes.has(d.icd10_code) && uniqueDiags.length < 12) {
                seenCodes.add(d.icd10_code);
                uniqueDiags.push(d);
            }
        }

        for (let i = 0; i < uniqueDiags.length; i++) {
            const diag = uniqueDiags[i];
            await client.query(`
                INSERT INTO superbill_diagnoses (superbill_id, icd10_code, description, sequence)
                VALUES ($1, $2, $3, $4)
            `, [superbill.id, diag.icd10_code, diag.description, i + 1]);
        }

        // 5. Prepopulate Lines from orders/charges (if any)
        // For now, let's just add a default E&M code if it's an office visit
        if (visit.note_type === 'office_visit') {
            await client.query(`
        INSERT INTO superbill_lines (superbill_id, cpt_code, description, units, charge, diagnosis_pointers, service_date)
        VALUES ($1, '99213', 'Office visit, established patient', 1, 100.00, '1', $2)
      `, [superbill.id, serviceDate]);
        }

        // Update totals
        await client.query(`
      UPDATE superbills 
      SET total_charges = (SELECT COALESCE(SUM(charge), 0) FROM superbill_lines WHERE superbill_id = $1),
          total_units = (SELECT COALESCE(SUM(units), 0) FROM superbill_lines WHERE superbill_id = $1)
      WHERE id = $1
    `, [superbill.id]);

        await client.query('COMMIT');
        res.status(201).json(superbill);

    } catch (error) {
        if (client) await client.query('ROLLBACK');
        console.error('Error creating superbill from visit:', error);
        res.status(500).json({ error: error.message });
    } finally {
        if (client) client.release();
    }
});

/**
 * GET /api/superbills/patient/:patientId
 * Returns all superbills for a patient
 */
router.get('/patient/:patientId', requirePermission('billing:view'), async (req, res) => {
    try {
        const { patientId } = req.params;
        const result = await pool.query(`
      SELECT s.*, 
             u.first_name as provider_first_name, u.last_name as provider_last_name,
             v.visit_type
      FROM superbills s
      LEFT JOIN users u ON s.rendering_provider_id = u.id
      LEFT JOIN visits v ON s.visit_id = v.id
      WHERE s.patient_id = $1
      ORDER BY s.service_date_from DESC, s.created_at DESC
    `, [patientId]);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching patient superbills:', error);
        res.status(500).json({ error: 'Failed to fetch superbills' });
    }
});

/**
 * GET /api/superbills/:id
 */
router.get('/:id', requirePermission('billing:view'), async (req, res) => {
    try {
        const { id } = req.params;

        const superbillResult = await pool.query(`
      SELECT s.*, 
             p.first_name as patient_first_name, p.last_name as patient_last_name, p.mrn, p.dob,
             render.first_name as rendering_first_name, render.last_name as rendering_last_name, render.npi as rendering_npi,
             bill.first_name as billing_first_name, bill.last_name as billing_last_name, bill.npi as billing_npi,
             loc.name as location_name, loc.address_line1 as location_address
      FROM superbills s
      JOIN patients p ON s.patient_id = p.id
      JOIN users render ON s.rendering_provider_id = render.id
      JOIN users bill ON s.billing_provider_id = bill.id
      LEFT JOIN locations loc ON s.facility_location_id = loc.id
      WHERE s.id = $1
    `, [id]);

        if (superbillResult.rows.length === 0) {
            return res.status(404).json({ error: 'Superbill not found' });
        }

        const superbill = superbillResult.rows[0];

        const diagnosesResult = await pool.query(
            'SELECT * FROM superbill_diagnoses WHERE superbill_id = $1 ORDER BY sequence',
            [id]
        );
        superbill.diagnoses = diagnosesResult.rows;

        const linesResult = await pool.query(
            'SELECT * FROM superbill_lines WHERE superbill_id = $1 ORDER BY created_at',
            [id]
        );
        superbill.lines = linesResult.rows;

        const paymentsResult = await pool.query(
            'SELECT * FROM superbill_payments_summary WHERE superbill_id = $1',
            [id]
        );
        superbill.payments = paymentsResult.rows[0] || null;

        res.json(superbill);
    } catch (error) {
        console.error('Error fetching superbill:', error);
        res.status(500).json({ error: 'Failed to fetch superbill' });
    }
});

/**
 * PUT /api/superbills/:id
 */
router.put('/:id', requirePermission('billing:edit'), async (req, res) => {
    const client = await pool.connect();
    try {
        const { id } = req.params;
        const {
            status, service_date_from, service_date_to,
            place_of_service, claim_frequency_code,
            rendering_provider_id, billing_provider_id,
            facility_location_id, insurance_policy_id,
            authorization_number,
            accident_related_employment, accident_related_auto, accident_related_other,
            accident_state, accident_date
        } = req.body;

        // Check if finalized
        const existing = await client.query('SELECT status FROM superbills WHERE id = $1', [id]);
        if (existing.rows[0]?.status === 'FINALIZED' && !req.user.role === 'admin') {
            return res.status(403).json({ error: 'Cannot edit finalized superbill' });
        }

        await client.query('BEGIN');

        const result = await client.query(`
      UPDATE superbills SET
        status = COALESCE($1, status),
        service_date_from = COALESCE($2, service_date_from),
        service_date_to = COALESCE($3, service_date_to),
        place_of_service = COALESCE($4, place_of_service),
        claim_frequency_code = COALESCE($5, claim_frequency_code),
        rendering_provider_id = COALESCE($6, rendering_provider_id),
        billing_provider_id = COALESCE($7, billing_provider_id),
        facility_location_id = COALESCE($8, facility_location_id),
        insurance_policy_id = COALESCE($9, insurance_policy_id),
        authorization_number = COALESCE($10, authorization_number),
        accident_related_employment = COALESCE($11, accident_related_employment),
        accident_related_auto = COALESCE($12, accident_related_auto),
        accident_related_other = COALESCE($13, accident_related_other),
        accident_state = COALESCE($14, accident_state),
        accident_date = COALESCE($15, accident_date),
        updated_by = $16,
        updated_at = NOW()
      WHERE id = $17
      RETURNING *
    `, [
            status, service_date_from, service_date_to,
            place_of_service, claim_frequency_code,
            rendering_provider_id, billing_provider_id,
            facility_location_id, insurance_policy_id,
            authorization_number,
            accident_related_employment, accident_related_auto, accident_related_other,
            accident_state, accident_date,
            req.user.id, id
        ]);

        await client.query('COMMIT');
        res.json(result.rows[0]);
    } catch (error) {
        if (client) await client.query('ROLLBACK');
        console.error('Error updating superbill:', error);
        res.status(500).json({ error: 'Failed to update superbill' });
    } finally {
        if (client) client.release();
    }
});

/**
 * POST /api/superbills/:id/diagnoses
 */
router.post('/:id/diagnoses', requirePermission('billing:edit'), async (req, res) => {
    try {
        const { id } = req.params;
        const { icd10_code, description, sequence } = req.body;

        // Check limit of 12
        const count = await pool.query('SELECT count(*) FROM superbill_diagnoses WHERE superbill_id = $1', [id]);
        if (parseInt(count.rows[0].count) >= 12) {
            return res.status(400).json({ error: 'Maximum 12 diagnoses allowed' });
        }

        const result = await pool.query(`
      INSERT INTO superbill_diagnoses (superbill_id, icd10_code, description, sequence)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (superbill_id, sequence) DO UPDATE SET icd10_code = EXCLUDED.icd10_code, description = EXCLUDED.description
      RETURNING *
    `, [id, icd10_code, description, sequence || (parseInt(count.rows[0].count) + 1)]);

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Error adding diagnosis:', error);
        res.status(500).json({ error: 'Failed to add diagnosis' });
    }
});

/**
 * POST /api/superbills/:id/lines
 */
router.post('/:id/lines', requirePermission('billing:edit'), async (req, res) => {
    const client = await pool.connect();
    try {
        const { id } = req.params;
        const { cpt_code, description, modifier1, units, charge, diagnosis_pointers, service_date } = req.body;

        await client.query('BEGIN');
        const result = await client.query(`
      INSERT INTO superbill_lines (
        superbill_id, cpt_code, description, modifier1, 
        units, charge, diagnosis_pointers, service_date
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [id, cpt_code, description, modifier1, units || 1, charge || 0.00, diagnosis_pointers, service_date]);

        // Update totals
        await client.query(`
      UPDATE superbills 
      SET total_charges = (SELECT SUM(charge) FROM superbill_lines WHERE superbill_id = $1),
          total_units = (SELECT SUM(units) FROM superbill_lines WHERE superbill_id = $1)
      WHERE id = $1
    `, [id]);

        await client.query('COMMIT');
        res.status(201).json(result.rows[0]);
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error adding line:', error);
        res.status(500).json({ error: 'Failed to add line item' });
    } finally {
        client.release();
    }
});

/**
 * DELETE /api/superbills/:id/diagnoses/:diagId
 */
router.delete('/:id/diagnoses/:diagId', requirePermission('billing:edit'), async (req, res) => {
    try {
        const { id, diagId } = req.params;
        await pool.query('DELETE FROM superbill_diagnoses WHERE id = $1 AND superbill_id = $2', [diagId, id]);
        res.json({ message: 'Diagnosis removed' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to remove diagnosis' });
    }
});

/**
 * PUT /api/superbills/:id/lines/:lineId
 */
router.put('/:id/lines/:lineId', requirePermission('billing:edit'), async (req, res) => {
    const client = await pool.connect();
    try {
        const { id, lineId } = req.params;
        const { modifier1, modifier2, units, charge, diagnosis_pointers, service_date } = req.body;

        await client.query('BEGIN');

        await client.query(`
      UPDATE superbill_lines SET
        modifier1 = COALESCE($1, modifier1),
        modifier2 = COALESCE($2, modifier2),
        units = COALESCE($3, units),
        charge = COALESCE($4, charge),
        diagnosis_pointers = COALESCE($5, diagnosis_pointers),
        service_date = COALESCE($6, service_date),
        updated_at = NOW()
      WHERE id = $7 AND superbill_id = $8
    `, [modifier1, modifier2, units, charge, diagnosis_pointers, service_date, lineId, id]);

        // Update totals
        await client.query(`
      UPDATE superbills 
      SET total_charges = (SELECT COALESCE(SUM(charge), 0) FROM superbill_lines WHERE superbill_id = $1),
          total_units = (SELECT COALESCE(SUM(units), 0) FROM superbill_lines WHERE superbill_id = $1)
      WHERE id = $1
    `, [id]);

        await client.query('COMMIT');
        res.json({ message: 'Line item updated' });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error updating line item:', error);
        res.status(500).json({ error: 'Failed to update line item' });
    } finally {
        client.release();
    }
});

/**
 * DELETE /api/superbills/:id/lines/:lineId
 */
router.delete('/:id/lines/:lineId', requirePermission('billing:edit'), async (req, res) => {
    const client = await pool.connect();
    try {
        const { id, lineId } = req.params;
        await client.query('BEGIN');
        await client.query('DELETE FROM superbill_lines WHERE id = $1 AND superbill_id = $2', [lineId, id]);

        // Update totals
        await client.query(`
      UPDATE superbills 
      SET total_charges = (SELECT COALESCE(SUM(charge), 0) FROM superbill_lines WHERE superbill_id = $1),
          total_units = (SELECT COALESCE(SUM(units), 0) FROM superbill_lines WHERE superbill_id = $1)
      WHERE id = $1
    `, [id]);

        await client.query('COMMIT');
        res.json({ message: 'Line item removed' });
    } catch (error) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: 'Failed to remove line item' });
    } finally {
        client.release();
    }
});

/**
 * POST /api/superbills/:id/finalize
 */
router.post('/:id/finalize', requirePermission('billing:edit'), async (req, res) => {
    const client = await pool.connect();
    try {
        const { id } = req.params;

        // Validation
        const diagCount = await client.query('SELECT count(*) FROM superbill_diagnoses WHERE superbill_id = $1', [id]);
        const lineCount = await client.query('SELECT count(*) FROM superbill_lines WHERE superbill_id = $1', [id]);

        if (parseInt(diagCount.rows[0].count) === 0) {
            return res.status(400).json({ error: 'At least one diagnosis required to finalize' });
        }
        if (parseInt(lineCount.rows[0].count) === 0) {
            return res.status(400).json({ error: 'At least one line item required to finalize' });
        }

        const result = await client.query(
            'UPDATE superbills SET status = \'FINALIZED\', updated_at = NOW() WHERE id = $1 RETURNING *',
            [id]
        );

        await logAudit(req.user.id, 'finalize_superbill', 'superbill', id, {}, req.ip);
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error finalizing superbill:', error);
        res.status(500).json({ error: 'Failed to finalize' });
    } finally {
        client.release();
    }
});

/**
 * POST /api/superbills/:id/void
 */
router.post('/:id/void', requirePermission('billing:edit'), async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query(
            'UPDATE superbills SET status = \'VOID\', updated_at = NOW() WHERE id = $1 RETURNING *',
            [id]
        );
        res.json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: 'Failed to void' });
    }
});

/**
 * GET /api/superbills/:id/print
 */
router.get('/:id/print', requirePermission('billing:view'), async (req, res) => {
    try {
        const { id } = req.params;

        // Fetch full data
        const superbill = await getFullSuperbillData(id);

        // Generate PDF
        const pdfBuffer = await pdfService.generateSuperbillPDF(superbill);

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=superbill_${id}.pdf`);
        res.send(pdfBuffer);

    } catch (error) {
        console.error('Error printing superbill:', error);
        res.status(500).json({ error: 'Failed to generate PDF' });
    }
});

/**
 * GET /api/superbills/:id/export/cms1500
 */
router.get('/:id/export/cms1500', requirePermission('billing:view'), async (req, res) => {
    try {
        const { id } = req.params;
        const superbill = await getFullSuperbillData(id);
        const mapping = cms1500Mapper(superbill);
        res.json(mapping);
    } catch (error) {
        res.status(500).json({ error: 'Failed to export CMS-1500' });
    }
});

/**
 * GET /api/superbills/:id/export/837p
 */
router.get('/:id/export/837p', requirePermission('billing:view'), async (req, res) => {
    try {
        const { id } = req.params;
        const superbill = await getFullSuperbillData(id);
        const structure = edi837pStructure(superbill);
        res.json(structure);
    } catch (error) {
        res.status(500).json({ error: 'Failed to export 837P' });
    }
});

// Helper: Get full data
async function getFullSuperbillData(id) {
    const sbResult = await pool.query(`
    SELECT s.*, 
           p.first_name as patient_first_name, p.last_name as patient_last_name, p.mrn, p.dob, p.sex,
           p.address_line1 as patient_address, p.city as patient_city, p.state as patient_state, p.zip as patient_zip,
           render.first_name as rendering_first_name, render.last_name as rendering_last_name, render.npi as rendering_npi, render.taxonomy_code as rendering_taxonomy,
           bill.first_name as billing_first_name, bill.last_name as billing_last_name, bill.npi as billing_npi,
           loc.name as location_name, loc.address_line1 as location_address, loc.city as location_city, loc.state as location_state, loc.zip as location_zip,
           org.name as org_name, org.tax_id as org_tax_id, org.npi as org_npi
    FROM superbills s
    JOIN patients p ON s.patient_id = p.id
    JOIN users render ON s.rendering_provider_id = render.id
    JOIN users bill ON s.billing_provider_id = bill.id
    LEFT JOIN locations loc ON s.facility_location_id = loc.id
    LEFT JOIN organizations org ON loc.organization_id = org.id
    WHERE s.id = $1
  `, [id]);

    if (sbResult.rows.length === 0) throw new Error('Superbill not found');
    const sb = sbResult.rows[0];

    const diags = await pool.query('SELECT * FROM superbill_diagnoses WHERE superbill_id = $1 ORDER BY sequence', [id]);
    const lines = await pool.query('SELECT * FROM superbill_lines WHERE superbill_id = $1 ORDER BY service_date', [id]);

    return { ...sb, diagnoses: diags.rows, lines: lines.rows };
}

// Helper: CMS-1500 Mapper
function cms1500Mapper(sb) {
    return {
        box1: 'Group Health Plan', // Example
        box2: `${sb.patient_last_name}, ${sb.patient_first_name}`,
        box3: sb.dob,
        box4: 'Self', // Insured's Name
        box11: sb.insurance_policy_id ? 'Payer Policy' : '',
        box21: sb.diagnoses.map(d => ({ icd: '10', code: d.icd10_code })),
        box24: sb.lines.map(l => ({
            date: l.service_date,
            pos: l.place_of_service_override || sb.place_of_service,
            cpt: l.cpt_code,
            modifier: l.modifier1,
            diagPointer: l.diagnosis_pointers,
            charge: l.charge,
            units: l.units
        })),
        box25: sb.org_tax_id,
        box31: `${sb.rendering_first_name} ${sb.rendering_last_name} NPI: ${sb.rendering_npi}`,
        box33: `${sb.org_name} ${sb.location_address} NPI: ${sb.org_npi}`
    };
}

// Helper: 837P Structure
function edi837pStructure(sb) {
    return {
        ISA: { sender: sb.org_tax_id, receiver: 'PAYER_ID' },
        GS: { functionalCode: 'HC' },
        Loop2000A: { // Billing Provider
            NM1: { type: '85', name: sb.org_name, npi: sb.org_npi },
            REF: { type: 'EI', id: sb.org_tax_id }
        },
        Loop2000B: { // Subscriber
            NM1: { type: 'IL', name: sb.patient_last_name, npi: '' },
            SBR: { payer: sb.insurance_policy_id }
        },
        Loop2300: { // Claim
            CLM: { id: sb.id, amount: sb.total_charges, pos: sb.place_of_service },
            HI: sb.diagnoses.map(d => ({ type: 'ABK', code: d.icd10_code })),
            Loop2400: sb.lines.map(l => ({
                SV1: { cpt: l.cpt_code, amount: l.charge, units: l.units },
                DTP: { date: l.service_date }
            }))
        }
    };
}

module.exports = router;
