const express = require('express');
const pool = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

// Get appointments - filter by date range or specific date
router.get('/', requireRole('clinician', 'nurse', 'admin'), async (req, res) => {
  try {
    const { date, startDate, endDate, providerId } = req.query;
    
    let query = `
      SELECT a.*,
             p.first_name as patient_first_name,
             p.last_name as patient_last_name,
             p.id as patient_id,
             u.first_name as provider_first_name,
             u.last_name as provider_last_name,
             u.id as provider_id
      FROM appointments a
      JOIN patients p ON a.patient_id = p.id
      JOIN users u ON a.provider_id = u.id
      WHERE 1=1
    `;
    
    const params = [];
    let paramCount = 0;
    
    if (date) {
      paramCount++;
      query += ` AND a.appointment_date = $${paramCount}`;
      params.push(date);
    } else if (startDate && endDate) {
      paramCount++;
      query += ` AND a.appointment_date >= $${paramCount}`;
      params.push(startDate);
      paramCount++;
      query += ` AND a.appointment_date <= $${paramCount}`;
      params.push(endDate);
    }
    
    if (providerId) {
      paramCount++;
      query += ` AND a.provider_id = $${paramCount}`;
      params.push(providerId);
    }
    
    query += ` ORDER BY a.appointment_date ASC, a.appointment_time ASC`;
    
    const result = await pool.query(query, params);
    
    const appointments = result.rows.map(row => ({
      id: row.id,
      patientId: row.patient_id,
      patientName: `${row.patient_first_name} ${row.patient_last_name}`,
      providerId: row.provider_id,
      providerName: `${row.provider_first_name} ${row.provider_last_name}`,
      date: row.appointment_date,
      time: row.appointment_time,
      duration: row.duration,
      type: row.appointment_type,
      status: row.status,
      notes: row.notes,
      createdAt: row.created_at
    }));
    
    res.json(appointments);
  } catch (error) {
    console.error('Error fetching appointments:', error);
    res.status(500).json({ error: 'Failed to fetch appointments' });
  }
});

// Get appointment by ID
router.get('/:id', requireRole('clinician', 'nurse', 'admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT a.*,
              p.first_name as patient_first_name,
              p.last_name as patient_last_name,
              p.id as patient_id,
              u.first_name as provider_first_name,
              u.last_name as provider_last_name,
              u.id as provider_id
       FROM appointments a
       JOIN patients p ON a.patient_id = p.id
       JOIN users u ON a.provider_id = u.id
       WHERE a.id = $1`,
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Appointment not found' });
    }
    
    const row = result.rows[0];
    const appointment = {
      id: row.id,
      patientId: row.patient_id,
      patientName: `${row.patient_first_name} ${row.patient_last_name}`,
      providerId: row.provider_id,
      providerName: `${row.provider_first_name} ${row.provider_last_name}`,
      date: row.appointment_date,
      time: row.appointment_time,
      duration: row.duration,
      type: row.appointment_type,
      status: row.status,
      notes: row.notes,
      createdAt: row.created_at
    };
    
    res.json(appointment);
  } catch (error) {
    console.error('Error fetching appointment:', error);
    res.status(500).json({ error: 'Failed to fetch appointment' });
  }
});

// Create appointment
router.post('/', requireRole('clinician', 'nurse', 'admin'), async (req, res) => {
  try {
    const { patientId, providerId, date, time, duration, type, notes } = req.body;
    
    if (!patientId || !date || !time) {
      return res.status(400).json({ error: 'Patient ID, date, and time are required' });
    }
    
    // Use current user as provider if not specified
    const finalProviderId = providerId || req.user.id;
    
    const result = await pool.query(
      `INSERT INTO appointments (patient_id, provider_id, appointment_date, appointment_time, duration, appointment_type, notes, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [patientId, finalProviderId, date, time, duration || 30, type || 'Follow-up', notes || null, req.user.id]
    );
    
    // Fetch the full appointment with patient and provider names
    const fullResult = await pool.query(
      `SELECT a.*,
              p.first_name as patient_first_name,
              p.last_name as patient_last_name,
              p.id as patient_id,
              u.first_name as provider_first_name,
              u.last_name as provider_last_name,
              u.id as provider_id
       FROM appointments a
       JOIN patients p ON a.patient_id = p.id
       JOIN users u ON a.provider_id = u.id
       WHERE a.id = $1`,
      [result.rows[0].id]
    );
    
    const row = fullResult.rows[0];
    const appointment = {
      id: row.id,
      patientId: row.patient_id,
      patientName: `${row.patient_first_name} ${row.patient_last_name}`,
      providerId: row.provider_id,
      providerName: `${row.provider_first_name} ${row.provider_last_name}`,
      date: row.appointment_date,
      time: row.appointment_time,
      duration: row.duration,
      type: row.appointment_type,
      status: row.status,
      notes: row.notes,
      createdAt: row.created_at
    };
    
    res.status(201).json(appointment);
  } catch (error) {
    console.error('Error creating appointment:', error);
    res.status(500).json({ error: 'Failed to create appointment' });
  }
});

// Update appointment
router.put('/:id', requireRole('clinician', 'nurse', 'admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { date, time, duration, type, status, notes, providerId } = req.body;
    
    const updates = [];
    const params = [];
    let paramCount = 0;
    
    if (date !== undefined) {
      paramCount++;
      updates.push(`appointment_date = $${paramCount}`);
      params.push(date);
    }
    if (time !== undefined) {
      paramCount++;
      updates.push(`appointment_time = $${paramCount}`);
      params.push(time);
    }
    if (duration !== undefined) {
      paramCount++;
      updates.push(`duration = $${paramCount}`);
      params.push(duration);
    }
    if (type !== undefined) {
      paramCount++;
      updates.push(`appointment_type = $${paramCount}`);
      params.push(type);
    }
    if (status !== undefined) {
      paramCount++;
      updates.push(`status = $${paramCount}`);
      params.push(status);
    }
    if (notes !== undefined) {
      paramCount++;
      updates.push(`notes = $${paramCount}`);
      params.push(notes);
    }
    if (providerId !== undefined) {
      paramCount++;
      updates.push(`provider_id = $${paramCount}`);
      params.push(providerId);
    }
    
    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }
    
    paramCount++;
    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    paramCount++;
    params.push(id);
    
    await pool.query(
      `UPDATE appointments SET ${updates.join(', ')} WHERE id = $${paramCount}`,
      params
    );
    
    // Fetch updated appointment
    const fullResult = await pool.query(
      `SELECT a.*,
              p.first_name as patient_first_name,
              p.last_name as patient_last_name,
              p.id as patient_id,
              u.first_name as provider_first_name,
              u.last_name as provider_last_name,
              u.id as provider_id
       FROM appointments a
       JOIN patients p ON a.patient_id = p.id
       JOIN users u ON a.provider_id = u.id
       WHERE a.id = $1`,
      [id]
    );
    
    if (fullResult.rows.length === 0) {
      return res.status(404).json({ error: 'Appointment not found' });
    }
    
    const row = fullResult.rows[0];
    const appointment = {
      id: row.id,
      patientId: row.patient_id,
      patientName: `${row.patient_first_name} ${row.patient_last_name}`,
      providerId: row.provider_id,
      providerName: `${row.provider_first_name} ${row.provider_last_name}`,
      date: row.appointment_date,
      time: row.appointment_time,
      duration: row.duration,
      type: row.appointment_type,
      status: row.status,
      notes: row.notes,
      createdAt: row.created_at
    };
    
    res.json(appointment);
  } catch (error) {
    console.error('Error updating appointment:', error);
    res.status(500).json({ error: 'Failed to update appointment' });
  }
});

// Delete appointment
router.delete('/:id', requireRole('clinician', 'admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM appointments WHERE id = $1 RETURNING *', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Appointment not found' });
    }
    
    res.json({ message: 'Appointment deleted successfully' });
  } catch (error) {
    console.error('Error deleting appointment:', error);
    res.status(500).json({ error: 'Failed to delete appointment' });
  }
});

module.exports = router;










