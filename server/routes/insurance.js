const express = require('express');
const pool = require('../db');
const { authenticate, requireRole, logAudit } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

// Get all insurance plans
router.get('/plans', requireRole('admin', 'front_desk'), async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM insurance_plans WHERE active = true ORDER BY name'
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching insurance plans:', error);
    res.status(500).json({ error: 'Failed to fetch insurance plans' });
  }
});

// Create insurance plan
router.post('/plans', requireRole('admin'), async (req, res) => {
  try {
    const { name, payerId, planType } = req.body;
    
    const result = await pool.query(
      `INSERT INTO insurance_plans (name, payer_id, plan_type)
       VALUES ($1, $2, $3) RETURNING *`,
      [name, payerId, planType]
    );

    await logAudit(req.user.id, 'create_insurance_plan', 'insurance_plan', result.rows[0].id, {}, req.ip);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating insurance plan:', error);
    res.status(500).json({ error: 'Failed to create insurance plan' });
  }
});

// Update patient insurance
router.put('/patient/:patientId', requireRole('admin', 'front_desk'), async (req, res) => {
  try {
    const { patientId } = req.params;
    const { insuranceProvider, insuranceId, insurancePlanId } = req.body;
    
    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (insuranceProvider !== undefined) {
      updates.push(`insurance_provider = $${paramIndex}`);
      values.push(insuranceProvider);
      paramIndex++;
    }
    if (insuranceId !== undefined) {
      updates.push(`insurance_id = $${paramIndex}`);
      values.push(insuranceId);
      paramIndex++;
    }
    if (insurancePlanId !== undefined) {
      updates.push(`insurance_plan_id = $${paramIndex}`);
      values.push(insurancePlanId);
      paramIndex++;
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No updates provided' });
    }

    values.push(patientId);
    const result = await pool.query(
      `UPDATE patients SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
       WHERE id = $${paramIndex} RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    await logAudit(req.user.id, 'update_patient_insurance', 'patient', patientId, {}, req.ip);

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating patient insurance:', error);
    res.status(500).json({ error: 'Failed to update patient insurance' });
  }
});

module.exports = router;

















