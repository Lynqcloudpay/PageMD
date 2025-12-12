const express = require('express');
const pool = require('../db');
const { authenticate, requireRole, logAudit } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

// Get clinical alerts for patient
router.get('/patient/:patientId', async (req, res) => {
  try {
    const { patientId } = req.params;
    const { activeOnly = 'true' } = req.query;
    
    let query = 'SELECT * FROM clinical_alerts WHERE patient_id = $1';
    const params = [patientId];
    
    if (activeOnly === 'true') {
      query += ' AND active = true';
    }
    
    query += ' ORDER BY severity DESC, created_at DESC';
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching clinical alerts:', error);
    res.status(500).json({ error: 'Failed to fetch clinical alerts' });
  }
});

// Create clinical alert
router.post('/', requireRole('clinician', 'admin'), async (req, res) => {
  try {
    const { patientId, alertType, severity, message, ruleName } = req.body;
    
    const result = await pool.query(
      `INSERT INTO clinical_alerts (patient_id, alert_type, severity, message, rule_name)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [patientId, alertType, severity || 'normal', message, ruleName]
    );

    await logAudit(req.user.id, 'create_clinical_alert', 'clinical_alert', result.rows[0].id, {
      patientId,
      alertType,
      severity
    }, req.ip);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating clinical alert:', error);
    res.status(500).json({ error: 'Failed to create clinical alert' });
  }
});

// Acknowledge alert
router.put('/:id/acknowledge', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query(
      `UPDATE clinical_alerts 
       SET acknowledged_by = $1, acknowledged_at = CURRENT_TIMESTAMP, active = false
       WHERE id = $2 RETURNING *`,
      [req.user.id, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Alert not found' });
    }

    await logAudit(req.user.id, 'acknowledge_alert', 'clinical_alert', id, {}, req.ip);

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error acknowledging alert:', error);
    res.status(500).json({ error: 'Failed to acknowledge alert' });
  }
});

module.exports = router;

































