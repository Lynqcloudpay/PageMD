const express = require('express');
const pool = require('../db');
const { authenticate, requireRole, logAudit } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

// Get referrals for patient
router.get('/patient/:patientId', async (req, res) => {
  try {
    const { patientId } = req.params;
    const result = await pool.query(
      `SELECT r.*, u.first_name as created_by_first_name, u.last_name as created_by_last_name
       FROM referrals r
       JOIN users u ON r.created_by = u.id
       WHERE r.patient_id = $1
       ORDER BY r.created_at DESC`,
      [patientId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching referrals:', error);
    res.status(500).json({ error: 'Failed to fetch referrals' });
  }
});

// Create referral
router.post('/', requireRole('clinician'), async (req, res) => {
  try {
    const { patientId, visitId, recipientName, recipientSpecialty, recipientAddress, reason, referralLetter } = req.body;

    const result = await pool.query(
      `INSERT INTO referrals (
        patient_id, visit_id, created_by, recipient_name, recipient_specialty,
        recipient_address, reason, referral_letter
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [patientId, visitId || null, req.user.id, recipientName, recipientSpecialty, recipientAddress, reason, referralLetter]
    );

    await logAudit(req.user.id, 'create_referral', 'referral', result.rows[0].id, {}, req.ip);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating referral:', error);
    res.status(500).json({ error: 'Failed to create referral' });
  }
});

// Update referral status
router.put('/:id', requireRole('clinician', 'front_desk'), async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const result = await pool.query(
      `UPDATE referrals SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *`,
      [status, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Referral not found' });
    }

    await logAudit(req.user.id, 'update_referral', 'referral', id, { status }, req.ip);

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating referral:', error);
    res.status(500).json({ error: 'Failed to update referral' });
  }
});

module.exports = router;



