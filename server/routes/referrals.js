const express = require('express');
const pool = require('../db');
const { authenticate, requireRole, logAudit } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

// -------------------- helpers --------------------
const clean = (v) => (v == null ? '' : String(v).trim());

// -------------------- routes --------------------

// Get referrals for patient
router.get('/patient/:patientId', async (req, res) => {
  const client = await pool.connect();
  try {
    const { patientId } = req.params;

    // Detect problems name column
    const nameColResult = await client.query(
      `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'problems'
        AND column_name IN ('problem_name', 'name')
      LIMIT 1
      `
    );
    const nameCol = nameColResult.rows[0]?.column_name || 'problem_name';

    const result = await client.query(
      `
      SELECT r.*, u.first_name as created_by_first_name, u.last_name as created_by_last_name
      FROM referrals r
      LEFT JOIN users u ON r.created_by = u.id
      WHERE r.patient_id = $1
      ORDER BY r.created_at DESC
      `,
      [patientId]
    );

    // Fetch diagnoses for each referral
    const referralsWithDiagnoses = await Promise.all(
      result.rows.map(async (referral) => {
        const dxResult = await client.query(
          `
          SELECT pr.id, pr.icd10_code, pr.${nameCol} AS diagnosis_name
          FROM referral_diagnoses rd
          JOIN problems pr ON pr.id = rd.problem_id
          WHERE rd.referral_id = $1
          ORDER BY rd.created_at ASC
          `,
          [referral.id]
        );

        return {
          ...referral,
          diagnoses: dxResult.rows.map((d) => ({
            id: d.id,
            name: d.diagnosis_name,
            icd10Code: d.icd10_code
          }))
        };
      })
    );

    res.json(referralsWithDiagnoses);
  } catch (error) {
    console.error('Error fetching referrals:', error);
    res.status(500).json({ error: 'Failed to fetch referrals' });
  } finally {
    client.release();
  }
});

// Get referrals for visit
router.get('/visit/:visitId', async (req, res) => {
  const client = await pool.connect();
  try {
    const { visitId } = req.params;

    // Detect problems name column
    const nameColResult = await client.query(
      `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'problems'
        AND column_name IN ('problem_name', 'name')
      LIMIT 1
      `
    );
    const nameCol = nameColResult.rows[0]?.column_name || 'problem_name';

    const result = await client.query(
      `
      SELECT r.*, u.first_name as created_by_first_name, u.last_name as created_by_last_name
      FROM referrals r
      LEFT JOIN users u ON r.created_by = u.id
      WHERE r.visit_id = $1
      ORDER BY r.created_at DESC
      `,
      [visitId]
    );

    // Fetch diagnoses for each referral
    const referralsWithDiagnoses = await Promise.all(
      result.rows.map(async (referral) => {
        const dxResult = await client.query(
          `
          SELECT pr.id, pr.icd10_code, pr.${nameCol} AS diagnosis_name
          FROM referral_diagnoses rd
          JOIN problems pr ON pr.id = rd.problem_id
          WHERE rd.referral_id = $1
          ORDER BY rd.created_at ASC
          `,
          [referral.id]
        );

        return {
          ...referral,
          diagnoses: dxResult.rows.map((d) => ({
            id: d.id,
            name: d.diagnosis_name,
            icd10Code: d.icd10_code
          }))
        };
      })
    );

    res.json(referralsWithDiagnoses);
  } catch (error) {
    console.error('Error fetching referrals for visit:', error);
    res.status(500).json({ error: 'Failed to fetch referrals' });
  } finally {
    client.release();
  }
});

// Create referral
router.post('/', requireRole('clinician'), async (req, res) => {
  const client = await pool.connect();

  const clean = (v) => (v == null ? '' : String(v).trim());
  const isTempDiagnosisId = (id) => {
    const s = String(id || '');
    return s.startsWith('temp-') || s.startsWith('assessment-');
  };

  // Detect whether problems uses problem_name or name (prevents 42703)
  const detectProblemsNameColumn = async () => {
    const r = await client.query(
      `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'problems'
        AND column_name IN ('problem_name', 'name')
      `
    );
    const cols = new Set(r.rows.map((x) => x.column_name));
    if (cols.has('problem_name')) return 'problem_name';
    if (cols.has('name')) return 'name';
    throw new Error("Schema error: problems table missing 'problem_name' or 'name'");
  };

  // "created_at" might not exist in problems in your schema; don't rely on it.
  const upsertProblemFromDiagnosis = async (patientId, d, nameCol) => {
    const name = clean(d?.problem_name) || clean(d?.name) || clean(d?.label);
    const icd10 = clean(d?.icd10_code) || clean(d?.icd10Code) || null;

    if (!name) return null;

    // match by ICD10
    if (icd10) {
      const byCode = await client.query(
        `
        SELECT id
        FROM problems
        WHERE patient_id = $1 AND icd10_code = $2 AND status = 'active'
        LIMIT 1
        `,
        [patientId, icd10]
      );
      if (byCode.rows[0]?.id) return byCode.rows[0].id;
    }

    // match by name
    const byName = await client.query(
      `
      SELECT id
      FROM problems
      WHERE patient_id = $1 AND ${nameCol} = $2 AND status = 'active'
      LIMIT 1
      `,
      [patientId, name]
    );
    if (byName.rows[0]?.id) return byName.rows[0].id;

    // insert
    const created = await client.query(
      `
      INSERT INTO problems (patient_id, ${nameCol}, icd10_code, status)
      VALUES ($1, $2, $3, 'active')
      RETURNING id
      `,
      [patientId, name, icd10]
    );

    return created.rows[0]?.id || null;
  };

  try {
    await client.query('BEGIN');

    const {
      patientId,
      visitId,
      recipientName,
      recipientSpecialty,
      recipientAddress,
      reason,
      referralLetter,
      diagnosisIds,
      diagnosisObjects
    } = req.body || {};

    const dxIds = Array.isArray(diagnosisIds) ? diagnosisIds : [];
    const dxObjs = Array.isArray(diagnosisObjects) ? diagnosisObjects : [];

    if (!patientId) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Patient ID is required' });
    }

    if (!clean(recipientName) && !clean(recipientSpecialty)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Recipient name or specialty is required' });
    }

    if (!req.user?.id) {
      await client.query('ROLLBACK');
      return res.status(401).json({ error: 'User authentication required' });
    }

    // allow diagnosisObjects OR diagnosisIds
    if (dxIds.length === 0 && dxObjs.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: 'At least one diagnosis is required (diagnosisIds or diagnosisObjects).'
      });
    }

    const referralReason = clean(reason) ? clean(reason) : 'Referral requested';

    // Create referral
    const createdReferral = await client.query(
      `
      INSERT INTO referrals (
        patient_id, visit_id, created_by,
        recipient_name, recipient_specialty, recipient_address,
        reason, referral_letter
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      RETURNING *
      `,
      [
        patientId,
        visitId || null,
        req.user.id,
        clean(recipientName) || null,
        clean(recipientSpecialty) || null,
        clean(recipientAddress) || null,
        referralReason,
        referralLetter || null
      ]
    );

    const referral = createdReferral.rows[0];

    // Resolve diagnoses -> problems.id
    const nameCol = await detectProblemsNameColumn();
    const problemIds = new Set();

    // Create/link from diagnosisObjects (handles assessment-0)
    for (const d of dxObjs) {
      const pid = await upsertProblemFromDiagnosis(patientId, d, nameCol);
      if (pid) problemIds.add(String(pid));
    }

    // Link any real problem IDs passed
    for (const rawId of dxIds) {
      if (!rawId) continue;
      if (isTempDiagnosisId(rawId)) continue;

      const check = await client.query(
        `SELECT id FROM problems WHERE id = $1 AND patient_id = $2`,
        [rawId, patientId]
      );
      if (check.rows[0]?.id) problemIds.add(String(check.rows[0].id));
    }

    if (problemIds.size === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error:
          'At least one valid diagnosis is required. The provided diagnosis IDs are invalid or do not exist in the database.'
      });
    }

    // Insert into referral_diagnoses (NEW TABLE)
    for (const pid of problemIds) {
      await client.query(
        `
        INSERT INTO referral_diagnoses (referral_id, problem_id)
        VALUES ($1, $2)
        ON CONFLICT (referral_id, problem_id) DO NOTHING
        `,
        [referral.id, pid]
      );
    }

    await client.query('COMMIT');

    // non-blocking audit
    try {
      await logAudit(req.user.id, 'create_referral', 'referral', referral.id, { diagnosisCount: problemIds.size }, req.ip);
    } catch {}

    // Fetch full diagnosis details for response
    const diagnosesResult = await client.query(
      `
      SELECT pr.id, pr.icd10_code, pr.${nameCol} AS diagnosis_name
      FROM referral_diagnoses rd
      JOIN problems pr ON pr.id = rd.problem_id
      WHERE rd.referral_id = $1
      ORDER BY rd.created_at ASC
      `,
      [referral.id]
    );

    const diagnoses = diagnosesResult.rows.map((d) => ({
      id: d.id,
      name: d.diagnosis_name,
      icd10Code: d.icd10_code
    }));

    // Return referral + diagnoses (so UI has them immediately)
    return res.status(201).json({
      ...referral,
      diagnoses
    });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});

    console.error('ERROR creating referral:', error);

    // ✅ THIS is what will let you see the real cause in the browser
    return res.status(500).json({
      error: 'Failed to create referral',
      message: error.message,
      details: process.env.NODE_ENV === 'development'
        ? {
            code: error.code,
            detail: error.detail,
            constraint: error.constraint,
            table: error.table,
            column: error.column,
            where: error.where
          }
        : undefined
    });
  } finally {
    client.release();
  }
});

// Delete referral
router.delete('/:id', requireRole('clinician'), async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const { id } = req.params;

    const exists = await client.query(`SELECT id FROM referrals WHERE id = $1`, [id]);
    if (exists.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Referral not found' });
    }

    // Remove diagnoses links first (using referral_diagnoses table)
    await client.query(
      `DELETE FROM referral_diagnoses WHERE referral_id = $1`,
      [id]
    );

    await client.query(`DELETE FROM referrals WHERE id = $1`, [id]);

    await client.query('COMMIT');

    try {
      await logAudit(req.user.id, 'delete_referral', 'referral', id, {}, req.ip);
    } catch {}

    res.json({ message: 'Referral deleted successfully' });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Error deleting referral:', error);
    res.status(500).json({ error: 'Failed to delete referral' });
  } finally {
    client.release();
  }
});

// Update referral status
router.put('/:id', requireRole('clinician', 'front_desk'), async (req, res) => {
  try {
    const { id } = req.params;
    const status = clean(req.body?.status);

    if (!status) {
      return res.status(400).json({ error: 'Status is required' });
    }

    const result = await pool.query(
      `UPDATE referrals SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *`,
      [status, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Referral not found' });
    }

    try {
      await logAudit(req.user.id, 'update_referral', 'referral', id, { status }, req.ip);
    } catch {}

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating referral:', error);
    res.status(500).json({ error: 'Failed to update referral' });
  }
});

module.exports = router;
