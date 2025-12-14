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
      createdAt: row.created_at,
      // Patient status tracking fields
      patient_status: row.patient_status || 'scheduled',
      room_sub_status: row.room_sub_status || null,
      status_history: row.status_history || [],
      arrival_time: row.arrival_time,
      current_room: row.current_room,
      checkout_time: row.checkout_time,
      cancellation_reason: row.cancellation_reason || null
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
      createdAt: row.created_at,
      // Patient status tracking fields
      patient_status: row.patient_status || 'scheduled',
      status_history: row.status_history || [],
      arrival_time: row.arrival_time,
      current_room: row.current_room,
      checkout_time: row.checkout_time
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
    
    // Check for existing appointments at the same time slot (max 2 per slot)
    // Exception: If BOTH appointments are cancelled/no-show, treat slot as empty (0/2)
    const existingAppts = await pool.query(
      `SELECT patient_status
       FROM appointments
       WHERE provider_id = $1
         AND appointment_date = $2
         AND appointment_time = $3`,
      [finalProviderId, date, time]
    );
    
    const allCancelled = existingAppts.rows.length === 2 && 
                         existingAppts.rows.every(row => 
                           row.patient_status === 'cancelled' || row.patient_status === 'no_show'
                         );
    
    // If both are cancelled, treat as empty (allow booking)
    if (!allCancelled && existingAppts.rows.length >= 2) {
      return res.status(400).json({ 
        error: 'Time slot is full. Maximum 2 appointments allowed per time slot.',
        existingCount: existingAppts.rows.length
      });
    }
    
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
      createdAt: row.created_at,
      // Patient status tracking fields
      patient_status: row.patient_status || 'scheduled',
      status_history: row.status_history || [],
      arrival_time: row.arrival_time,
      current_room: row.current_room,
      checkout_time: row.checkout_time
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
    const { 
      date, time, duration, type, status, notes, providerId,
      patient_status, room_sub_status, status_history, arrival_time, current_room, checkout_time,
      cancellation_reason
    } = req.body;
    
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
    if (patient_status !== undefined) {
      paramCount++;
      // Validate patient_status value
      const validStatuses = ['scheduled', 'arrived', 'checked_in', 'in_room', 'checked_out', 'no_show', 'cancelled'];
      if (!validStatuses.includes(patient_status)) {
        return res.status(400).json({ 
          error: 'Invalid patient_status value', 
          validValues: validStatuses,
          received: patient_status
        });
      }
      updates.push(`patient_status = $${paramCount}`);
      params.push(patient_status);
    }
    if (cancellation_reason !== undefined) {
      paramCount++;
      updates.push(`cancellation_reason = $${paramCount}`);
      params.push(cancellation_reason);
    }
    if (status_history !== undefined) {
      paramCount++;
      updates.push(`status_history = $${paramCount}::jsonb`);
      // Ensure status_history is properly formatted as JSON
      // Also ensure all timestamps use server time if client timestamps are provided
      let historyJson;
      if (Array.isArray(status_history)) {
        // Update the last entry's timestamp to use server time if it's recent (within 5 seconds)
        // This ensures real-time accuracy while respecting server authority
        const now = new Date();
        const updatedHistory = status_history.map((entry, index) => {
          if (index === status_history.length - 1 && entry.timestamp) {
            const entryTime = new Date(entry.timestamp);
            const timeDiff = Math.abs(now - entryTime);
            // If the timestamp is within 5 seconds, it's likely being set now, so use server time
            if (timeDiff < 5000) {
              return { ...entry, timestamp: now.toISOString() };
            }
          }
          return entry;
        });
        historyJson = JSON.stringify(updatedHistory);
      } else if (typeof status_history === 'string') {
        // If it's already a string, try to parse and re-stringify to ensure valid JSON
        try {
          const parsed = JSON.parse(status_history);
          if (Array.isArray(parsed) && parsed.length > 0) {
            const now = new Date();
            const updatedHistory = parsed.map((entry, index) => {
              if (index === parsed.length - 1 && entry.timestamp) {
                const entryTime = new Date(entry.timestamp);
                const timeDiff = Math.abs(now - entryTime);
                if (timeDiff < 5000) {
                  return { ...entry, timestamp: now.toISOString() };
                }
              }
              return entry;
            });
            historyJson = JSON.stringify(updatedHistory);
          } else {
            historyJson = JSON.stringify(parsed);
          }
        } catch (e) {
          console.error('Invalid status_history JSON string:', status_history);
          historyJson = JSON.stringify([]);
        }
      } else {
        historyJson = JSON.stringify(status_history);
      }
      params.push(historyJson);
    }
    if (arrival_time !== undefined) {
      // Use server time (CURRENT_TIMESTAMP) if arrival_time is being set and is recent
      if (arrival_time && arrival_time !== null && arrival_time !== '') {
        // Check if the timestamp is very recent (within 10 seconds) - if so, use server time
        const clientTime = new Date(arrival_time);
        const serverTime = new Date();
        const timeDiff = Math.abs(serverTime - clientTime);
        if (timeDiff < 10000) { // Within 10 seconds, use server time for accuracy
          updates.push(`arrival_time = CURRENT_TIMESTAMP`);
          // No parameter needed for CURRENT_TIMESTAMP
        } else {
          paramCount++;
          updates.push(`arrival_time = $${paramCount}`);
          params.push(clientTime);
        }
      } else {
        paramCount++;
        updates.push(`arrival_time = $${paramCount}`);
        params.push(null);
      }
    }
    if (current_room !== undefined) {
      paramCount++;
      updates.push(`current_room = $${paramCount}`);
      params.push(current_room || null);
    }
    if (checkout_time !== undefined) {
      // Use server time (CURRENT_TIMESTAMP) if checkout_time is being set and is recent
      if (checkout_time && checkout_time !== null && checkout_time !== '') {
        // Check if the timestamp is very recent (within 10 seconds) - if so, use server time
        const clientTime = new Date(checkout_time);
        const serverTime = new Date();
        const timeDiff = Math.abs(serverTime - clientTime);
        if (timeDiff < 10000) { // Within 10 seconds, use server time for accuracy
          updates.push(`checkout_time = CURRENT_TIMESTAMP`);
          // No parameter needed for CURRENT_TIMESTAMP
        } else {
          paramCount++;
          updates.push(`checkout_time = $${paramCount}`);
          params.push(clientTime);
        }
      } else {
        paramCount++;
        updates.push(`checkout_time = $${paramCount}`);
        params.push(null);
      }
    }
    if (room_sub_status !== undefined) {
      paramCount++;
      updates.push(`room_sub_status = $${paramCount}`);
      params.push(room_sub_status || null);
    }
    
    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }
    
    // Add updated_at (no parameter needed for CURRENT_TIMESTAMP)
    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    
    // Add WHERE clause parameter
    paramCount++;
    params.push(id);
    
    const updateQuery = `UPDATE appointments SET ${updates.join(', ')} WHERE id = $${paramCount}`;
    
    // Log for debugging
    if (process.env.NODE_ENV === 'development') {
      console.log('Update query:', updateQuery);
      console.log('Update params:', params.map((p, i) => `${i + 1}: ${typeof p === 'object' ? JSON.stringify(p).substring(0, 100) : p}`));
    }
    
    try {
      await pool.query(updateQuery, params);
    } catch (dbError) {
      console.error('Database error during update:', {
        message: dbError.message,
        code: dbError.code,
        detail: dbError.detail,
        hint: dbError.hint,
        constraint: dbError.constraint,
        table: dbError.table,
        column: dbError.column,
        query: updateQuery,
        params: params.map((p, i) => `${i + 1}: ${typeof p === 'object' ? JSON.stringify(p).substring(0, 100) : p}`)
      });
      throw dbError; // Re-throw to be caught by outer catch
    }
    
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
    
    // Parse status_history if it's a string (PostgreSQL JSONB can return as string)
    let statusHistory = [];
    if (row.status_history) {
      try {
        statusHistory = typeof row.status_history === 'string' 
          ? JSON.parse(row.status_history) 
          : row.status_history;
        if (!Array.isArray(statusHistory)) {
          statusHistory = [];
        }
      } catch (e) {
        console.warn('Error parsing status_history:', e);
        statusHistory = [];
      }
    }
    
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
      createdAt: row.created_at,
      // Patient status tracking fields
      patient_status: row.patient_status || 'scheduled',
      room_sub_status: row.room_sub_status || null,
      status_history: statusHistory,
      arrival_time: row.arrival_time,
      current_room: row.current_room,
      checkout_time: row.checkout_time
    };
    
    res.json(appointment);
  } catch (error) {
    console.error('Error updating appointment:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      detail: error.detail,
      hint: error.hint,
      constraint: error.constraint,
      table: error.table,
      column: error.column,
      stack: error.stack
    });
    res.status(500).json({ 
      error: 'Failed to update appointment',
      message: error.message,
      details: error.detail || error.message,
      hint: error.hint,
      constraint: error.constraint,
      code: error.code
    });
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












