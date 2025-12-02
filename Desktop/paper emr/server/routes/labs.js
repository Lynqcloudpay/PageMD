const express = require('express');
const pool = require('../db');
const { authenticate, logAudit } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

// Get labs for patient
router.get('/patient/:patientId', async (req, res) => {
  try {
    const { patientId } = req.params;
    // For MVP, we'll return mock data or query from orders where order_type = 'lab'
    // In production, this would integrate with FHIR DiagnosticReport/Observation
    const result = await pool.query(
      `SELECT o.*, o.order_payload as lab_data
       FROM orders o
       WHERE o.patient_id = $1 AND o.order_type = 'lab'
       ORDER BY o.created_at DESC`,
      [patientId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching labs:', error);
    res.status(500).json({ error: 'Failed to fetch labs' });
  }
});

module.exports = router;

