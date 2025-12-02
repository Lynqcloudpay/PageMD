const express = require('express');
const pool = require('../db');
const { authenticate, requireRole, logAudit } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

// Get fee schedule
router.get('/fee-schedule', requireRole('admin', 'clinician'), async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM fee_schedule ORDER BY code_type, code'
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching fee schedule:', error);
    res.status(500).json({ error: 'Failed to fetch fee schedule' });
  }
});

// Get insurance providers
router.get('/insurance', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT DISTINCT insurance_provider FROM patients WHERE insurance_provider IS NOT NULL ORDER BY insurance_provider'
    );
    res.json(result.rows.map(r => r.insurance_provider));
  } catch (error) {
    console.error('Error fetching insurance providers:', error);
    res.status(500).json({ error: 'Failed to fetch insurance providers' });
  }
});

// Create claim
router.post('/claims', requireRole('admin', 'front_desk'), async (req, res) => {
  try {
    const { visitId, diagnosisCodes, procedureCodes, totalAmount } = req.body;
    
    const result = await pool.query(
      `INSERT INTO claims (visit_id, diagnosis_codes, procedure_codes, total_amount, status, created_by)
       VALUES ($1, $2, $3, $4, 'pending', $5) RETURNING *`,
      [visitId, JSON.stringify(diagnosisCodes), JSON.stringify(procedureCodes), totalAmount, req.user.id]
    );

    await logAudit(req.user.id, 'create_claim', 'claim', result.rows[0].id, {}, req.ip);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating claim:', error);
    res.status(500).json({ error: 'Failed to create claim' });
  }
});

// Get claims by patient
router.get('/claims/patient/:patientId', requireRole('admin', 'front_desk'), async (req, res) => {
  try {
    const { patientId } = req.params;
    const result = await pool.query(
      `SELECT c.*, v.visit_date, v.visit_type
       FROM claims c
       JOIN visits v ON c.visit_id = v.id
       WHERE v.patient_id = $1
       ORDER BY c.created_at DESC`,
      [patientId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching claims:', error);
    res.status(500).json({ error: 'Failed to fetch claims' });
  }
});

module.exports = router;











