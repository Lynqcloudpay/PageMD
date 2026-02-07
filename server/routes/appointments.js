const express = require('express');
const pool = require('../db');
const { authenticate } = require('../middleware/auth');
const { requirePermission, audit } = require('../services/authorization');
const { preparePatientForResponse } = require('../services/patientEncryptionService');
const { idempotency } = require('../middleware/idempotency');

const router = express.Router();
router.use(authenticate);

// Get appointments - filter by date range or specific date
router.get('/', requirePermission('schedule:view'), async (req, res) => {
  try {
    const { date, startDate, endDate, providerId } = req.query;

    let query = `
      SELECT a.*,
             p.first_name as patient_first_name,
             p.last_name as patient_last_name,
             p.encryption_metadata,
             p.encryption_metadata as patient_encryption_metadata,
             p.id as patient_id,
             p.dob as patient_dob,
             p.email as patient_email,
             u.first_name as provider_first_name,
             u.last_name as provider_last_name,
             u.id as provider_id,
             v.id as encounter_id,
             v.status as encounter_status
      FROM appointments a
      JOIN patients p ON a.patient_id = p.id
      JOIN users u ON a.provider_id = u.id
      LEFT JOIN visits v ON a.id = v.appointment_id
      WHERE 1=1
    `;

    const params = [];
    let paramCount = 0;

    // Scope filtering: clinicians with SELF scope only see their own appointments
    if (req.user.scope?.scheduleScope === 'SELF' && req.user.role === 'CLINICIAN') {
      paramCount++;
      query += ` AND a.provider_id = $${paramCount}`;
      params.push(req.user.id);
    } else if (providerId) {
      // Allow filter by providerId if clinic scope or non-clinician
      paramCount++;
      query += ` AND a.provider_id = $${paramCount}`;
      params.push(providerId);
    }

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

    query += ` ORDER BY a.appointment_date ASC, a.appointment_time ASC`;

    const result = await pool.query(query, params);

    const appointments = await Promise.all(result.rows.map(async row => {
      // Parse status_history if it's a string
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

      // Decrypt patient name
      const patientData = {
        first_name: row.patient_first_name,
        last_name: row.patient_last_name,
        email: row.patient_email,
        encryption_metadata: row.patient_encryption_metadata || row.encryption_metadata
      };
      const decryptedPatient = await preparePatientForResponse(patientData);

      // Handle null/undefined patient names gracefully
      const firstName = decryptedPatient.first_name || '';
      const lastName = decryptedPatient.last_name || '';
      const patientName = (firstName && lastName)
        ? `${firstName} ${lastName}`.trim()
        : firstName || lastName || 'Unknown Patient';

      return {
        id: row.id,
        patientId: row.patient_id,
        patientName,
        patientEmail: decryptedPatient.email,
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
        patient_status: row.patient_status ?? 'scheduled',
        room_sub_status: row.room_sub_status ?? null,
        status_history: statusHistory,
        arrival_time: row.arrival_time ?? null,
        current_room: row.current_room ?? null,
        checkout_time: row.checkout_time ?? null,
        cancellation_reason: row.cancellation_reason ?? null,
        patient_dob: row.patient_dob,
        visit_method: row.visit_method || 'office',
        encounter_id: row.encounter_id,
        encounter_status: row.encounter_status
      };
    }));

    res.json(appointments);
  } catch (error) {
    console.error('Error fetching appointments:', error);
    res.status(500).json({ error: 'Failed to fetch appointments' });
  }
});

// Get appointment by ID
router.get('/:id', requirePermission('schedule:view'), async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT a.*,
             p.first_name as patient_first_name,
             p.last_name as patient_last_name,
             p.encryption_metadata,
             p.encryption_metadata as patient_encryption_metadata,
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

    // Decrypt patient name
    const patientData = {
      first_name: row.patient_first_name,
      last_name: row.patient_last_name,
      encryption_metadata: row.patient_encryption_metadata || row.encryption_metadata
    };
    const decryptedPatient = await preparePatientForResponse(patientData);

    // Handle null/undefined patient names gracefully
    const firstName = decryptedPatient.first_name || '';
    const lastName = decryptedPatient.last_name || '';
    const patientName = (firstName && lastName)
      ? `${firstName} ${lastName}`.trim()
      : firstName || lastName || 'Unknown Patient';

    const appointment = {
      id: row.id,
      patientId: row.patient_id,
      patientName,
      providerId: row.provider_id,
      providerName: `${row.provider_first_name} ${row.provider_last_name}`,
      date: row.appointment_date,
      time: row.appointment_time,
      duration: row.duration,
      type: row.appointment_type,
      status: row.status,
      notes: row.notes,
      createdAt: row.created_at,
      // Patient status tracking fields - ensure all fields are present
      patient_status: row.patient_status ?? 'scheduled',
      room_sub_status: row.room_sub_status ?? null,
      status_history: statusHistory,
      arrival_time: row.arrival_time ?? null,
      current_room: row.current_room ?? null,
      checkout_time: row.checkout_time ?? null,
      cancellation_reason: row.cancellation_reason ?? null,
      visit_method: row.visit_method || 'office'
    };

    res.json(appointment);
  } catch (error) {
    console.error('Error fetching appointment:', error);
    res.status(500).json({ error: 'Failed to fetch appointment' });
  }
});

// Create appointment
router.post('/', requirePermission('schedule:edit'), idempotency, async (req, res) => {
  try {
    const { patientId, providerId, date, time, duration, type, notes, visitMethod } = req.body;

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
      `INSERT INTO appointments (patient_id, provider_id, appointment_date, appointment_time, duration, appointment_type, notes, created_by, clinic_id, visit_method)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [patientId, finalProviderId, date, time, duration || 30, type || 'Follow-up', notes || null, req.user.id, req.user?.clinic_id, visitMethod || 'office']
    );

    // Fetch the full appointment with patient and provider names
    const fullResult = await pool.query(
      `SELECT a.*,
      p.first_name as patient_first_name,
      p.last_name as patient_last_name,
      p.last_name as patient_last_name,
      p.encryption_metadata,
      p.encryption_metadata as patient_encryption_metadata,
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

    // Decrypt patient name
    const patientData = {
      first_name: row.patient_first_name,
      last_name: row.patient_last_name,
      encryption_metadata: row.patient_encryption_metadata || row.encryption_metadata
    };
    const decryptedPatient = await preparePatientForResponse(patientData);

    // Handle null/undefined patient names gracefully
    const firstName = decryptedPatient.first_name || '';
    const lastName = decryptedPatient.last_name || '';
    const patientName = (firstName && lastName)
      ? `${firstName} ${lastName}`.trim()
      : firstName || lastName || 'Unknown Patient';

    const appointment = {
      id: row.id,
      patientId: row.patient_id,
      patientName,
      providerId: row.provider_id,
      providerName: `${row.provider_first_name} ${row.provider_last_name}`,
      date: row.appointment_date,
      time: row.appointment_time,
      duration: row.duration,
      type: row.appointment_type,
      status: row.status,
      notes: row.notes,
      createdAt: row.created_at,
      // Patient status tracking fields - ensure all fields are present
      patient_status: row.patient_status ?? 'scheduled',
      room_sub_status: row.room_sub_status ?? null,
      status_history: statusHistory,
      arrival_time: row.arrival_time ?? null,
      current_room: row.current_room ?? null,
      checkout_time: row.checkout_time ?? null,
      cancellation_reason: row.cancellation_reason ?? null,
      visit_method: row.visit_method || 'office'
    };

    res.status(201).json(appointment);
  } catch (error) {
    console.error('Error creating appointment:', error);
    res.status(500).json({ error: 'Failed to create appointment' });
  }
});

// Update appointment
router.put('/:id', requirePermission('schedule:edit'), async (req, res) => {
  try {
    const { id } = req.params;
    const {
      date, time, duration, type, status, notes, providerId, visitMethod
    } = req.body;

    // Accept both snake_case and camelCase for patient status fields (for compatibility)
    const normalizedPatientStatus = req.body.patient_status ?? req.body.patientStatus;
    const normalizedRoomSubStatus = req.body.room_sub_status ?? req.body.roomSubStatus;
    const normalizedStatusHistory = req.body.status_history ?? req.body.statusHistory;
    const normalizedArrivalTime = req.body.arrival_time ?? req.body.arrivalTime;
    const normalizedCurrentRoom = req.body.current_room ?? req.body.currentRoom;
    const normalizedCheckoutTime = req.body.checkout_time ?? req.body.checkoutTime;
    const normalizedCancellationReason = req.body.cancellation_reason ?? req.body.cancellationReason;

    // First, verify appointment exists
    const existingAppointment = await pool.query('SELECT id FROM appointments WHERE id = $1', [id]);
    if (existingAppointment.rows.length === 0) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    const updates = [];
    const params = [];
    let paramCount = 0;

    // Standard appointment fields
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
    if (visitMethod !== undefined) {
      paramCount++;
      updates.push(`visit_method = $${paramCount}`);
      params.push(visitMethod);
    }

    // Patient status fields - require schedule:status_update permission
    if (normalizedPatientStatus !== undefined) {
      // Check permission for status updates
      if (!req.user.permissions || !req.user.permissions.includes('schedule:status_update')) {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'Insufficient permissions to update appointment status',
          required: 'schedule:status_update'
        });
      }

      // Validate patient_status value
      const validStatuses = ['scheduled', 'arrived', 'checked_in', 'in_room', 'checked_out', 'no_show', 'cancelled'];
      if (!validStatuses.includes(normalizedPatientStatus)) {
        return res.status(400).json({
          error: 'Invalid patient_status value',
          validValues: validStatuses,
          received: normalizedPatientStatus
        });
      }
      paramCount++;
      updates.push(`patient_status = $${paramCount}`);
      params.push(normalizedPatientStatus);
    }

    if (normalizedCancellationReason !== undefined) {
      paramCount++;
      updates.push(`cancellation_reason = $${paramCount}`);
      params.push(normalizedCancellationReason || null);
    }

    // Handle status_history - ensure it's always a valid JSON array
    if (normalizedStatusHistory !== undefined) {
      paramCount++;
      updates.push(`status_history = $${paramCount}:: jsonb`);

      let historyJson;
      try {
        // Parse if string, otherwise use as-is
        let historyArray;
        if (typeof normalizedStatusHistory === 'string') {
          try {
            historyArray = JSON.parse(normalizedStatusHistory);
          } catch (parseError) {
            console.error('Failed to parse status_history string:', parseError);
            historyArray = [];
          }
        } else if (Array.isArray(normalizedStatusHistory)) {
          historyArray = normalizedStatusHistory;
        } else {
          console.warn('status_history is not an array or string, defaulting to empty array');
          historyArray = [];
        }

        // Ensure it's an array
        if (!Array.isArray(historyArray)) {
          historyArray = [];
        }

        // Update the last entry's timestamp to use server time if it's very recent
        if (historyArray.length > 0) {
          const now = new Date();
          const lastEntry = historyArray[historyArray.length - 1];
          if (lastEntry.timestamp) {
            try {
              const entryTime = new Date(lastEntry.timestamp);
              const timeDiff = Math.abs(now.getTime() - entryTime.getTime());
              // If timestamp is within 5 seconds, use server time for accuracy
              if (timeDiff < 5000) {
                historyArray[historyArray.length - 1] = {
                  ...lastEntry,
                  timestamp: now.toISOString()
                };
              }
            } catch (dateError) {
              // Invalid timestamp, use server time
              historyArray[historyArray.length - 1] = {
                ...lastEntry,
                timestamp: now.toISOString()
              };
            }
          } else {
            // No timestamp, add server time
            historyArray[historyArray.length - 1] = {
              ...lastEntry,
              timestamp: now.toISOString()
            };
          }
        }

        historyJson = JSON.stringify(historyArray);
      } catch (error) {
        console.error('Error processing status_history:', error);
        historyJson = JSON.stringify([]);
      }

      params.push(historyJson);
    }

    // Handle arrival_time
    if (normalizedArrivalTime !== undefined) {
      if (normalizedArrivalTime === null || normalizedArrivalTime === '') {
        paramCount++;
        updates.push(`arrival_time = $${paramCount}`);
        params.push(null);
      } else {
        try {
          const clientTime = new Date(normalizedArrivalTime);
          const serverTime = new Date();
          const timeDiff = Math.abs(serverTime.getTime() - clientTime.getTime());

          // If timestamp is very recent (within 10 seconds), use server time for accuracy
          if (timeDiff < 10000 && !isNaN(clientTime.getTime())) {
            updates.push(`arrival_time = CURRENT_TIMESTAMP`);
          } else {
            paramCount++;
            updates.push(`arrival_time = $${paramCount}`);
            params.push(clientTime);
          }
        } catch (dateError) {
          // Invalid date, use server time
          updates.push(`arrival_time = CURRENT_TIMESTAMP`);
        }
      }
    }

    // Handle checkout_time
    if (normalizedCheckoutTime !== undefined) {
      if (normalizedCheckoutTime === null || normalizedCheckoutTime === '') {
        paramCount++;
        updates.push(`checkout_time = $${paramCount}`);
        params.push(null);
      } else {
        try {
          const clientTime = new Date(normalizedCheckoutTime);
          const serverTime = new Date();
          const timeDiff = Math.abs(serverTime.getTime() - clientTime.getTime());

          // If timestamp is very recent (within 10 seconds), use server time for accuracy
          if (timeDiff < 10000 && !isNaN(clientTime.getTime())) {
            updates.push(`checkout_time = CURRENT_TIMESTAMP`);
          } else {
            paramCount++;
            updates.push(`checkout_time = $${paramCount}`);
            params.push(clientTime);
          }
        } catch (dateError) {
          // Invalid date, use server time
          updates.push(`checkout_time = CURRENT_TIMESTAMP`);
        }
      }
    }

    // Handle current_room
    if (normalizedCurrentRoom !== undefined) {
      paramCount++;
      updates.push(`current_room = $${paramCount}`);
      params.push(normalizedCurrentRoom || null);
    }

    // Handle room_sub_status
    if (normalizedRoomSubStatus !== undefined) {
      paramCount++;
      updates.push(`room_sub_status = $${paramCount}`);
      params.push(normalizedRoomSubStatus || null);
    }

    // Ensure we have something to update
    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    // Scope check: verify appointment exists and user has access
    const checkRes = await pool.query('SELECT id, provider_id FROM appointments WHERE id = $1', [id]);
    if (checkRes.rows.length === 0) {
      await audit(req, 'appointment_update', 'appointment', id, false);
      return res.status(404).json({ error: 'Appointment not found' });
    }

    // Scope check: if SELF scope, ensure appointment belongs to user
    if (req.user.scope?.scheduleScope === 'SELF' && req.user.role === 'CLINICIAN') {
      if (checkRes.rows[0].provider_id !== req.user.id) {
        await audit(req, 'appointment_update', 'appointment', id, false);
        return res.status(403).json({ error: 'Forbidden: Cannot update appointments outside your scope' });
      }
    }

    // Add updated_at timestamp
    updates.push(`updated_at = CURRENT_TIMESTAMP`);

    // Add WHERE clause parameter
    paramCount++;
    params.push(id);

    // Build and execute update query
    const updateQuery = `UPDATE appointments SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING * `;

    // Log for debugging in development
    if (process.env.NODE_ENV === 'development') {
      console.log('Update query:', updateQuery);
      console.log('Update params count:', params.length);
      console.log('Updates count:', updates.length);
    }

    let updateResult;
    try {
      updateResult = await pool.query(updateQuery, params);
    } catch (dbError) {
      console.error('Database error during appointment update:', {
        message: dbError.message,
        code: dbError.code,
        detail: dbError.detail,
        hint: dbError.hint,
        constraint: dbError.constraint,
        table: dbError.table,
        column: dbError.column,
        query: updateQuery.substring(0, 200),
        paramCount: params.length
      });
      throw dbError;
    }

    if (updateResult.rows.length === 0) {
      await audit(req, 'appointment_update', 'appointment', id, false);
      return res.status(404).json({ error: 'Appointment not found after update' });
    }

    // Audit successful update
    await audit(req, 'appointment_update', 'appointment', id, true);

    // Fetch updated appointment
    const fullResult = await pool.query(
      `SELECT a.*,
      p.first_name as patient_first_name,
      p.last_name as patient_last_name,
      p.encryption_metadata as patient_encryption_metadata,
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

    // Decrypt patient name
    const patientData = {
      first_name: row.patient_first_name,
      last_name: row.patient_last_name,
      encryption_metadata: row.patient_encryption_metadata
    };
    const decryptedPatient = await preparePatientForResponse(patientData);

    // Handle null/undefined patient names gracefully
    const firstName = decryptedPatient.first_name || '';
    const lastName = decryptedPatient.last_name || '';
    const patientName = (firstName && lastName)
      ? `${firstName} ${lastName}`.trim()
      : firstName || lastName || 'Unknown Patient';

    const appointment = {
      id: row.id,
      patientId: row.patient_id,
      patientName,
      providerId: row.provider_id,
      providerName: `${row.provider_first_name} ${row.provider_last_name}`,
      date: row.appointment_date,
      time: row.appointment_time,
      duration: row.duration,
      type: row.appointment_type,
      status: row.status,
      notes: row.notes,
      createdAt: row.created_at,
      // Patient status tracking fields - use ?? to preserve valid falsy values
      patient_status: row.patient_status ?? 'scheduled',
      room_sub_status: row.room_sub_status ?? null,
      status_history: statusHistory,
      arrival_time: row.arrival_time ?? null,
      current_room: row.current_room ?? null,
      checkout_time: row.checkout_time ?? null,
      cancellation_reason: row.cancellation_reason ?? null,
      visit_method: row.visit_method || 'office'
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
router.delete('/:id', requirePermission('schedule:edit'), async (req, res) => {
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

/**
 * POST /:id/generate-guest-link
 * Generate a magic link for guest telehealth access
 * Only for telehealth appointments
 */
router.post('/:id/generate-guest-link', requirePermission('schedule:view'), async (req, res) => {
  const crypto = require('crypto');
  const emailService = require('../services/emailService');

  try {
    const { id } = req.params;

    // Get appointment with patient details
    const result = await pool.query(`
      SELECT 
        a.*,
        p.id as patient_id,
        p.first_name,
        p.last_name,
        p.email,
        p.encryption_metadata,
        u.first_name as provider_first_name,
        u.last_name as provider_last_name,
        c.phone as clinic_phone,
        c.display_name as clinic_name
      FROM appointments a
      JOIN patients p ON a.patient_id = p.id
      LEFT JOIN users u ON a.provider_id = u.id
      LEFT JOIN clinics c ON c.id = a.clinic_id
      WHERE a.id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    const appt = result.rows[0];

    // Verify it's a telehealth appointment
    const visitMethod = (appt.visit_method || '').toLowerCase();
    const apptType = (appt.appointment_type || '').toLowerCase();
    const isTelehealth = visitMethod === 'telehealth' ||
      apptType.includes('telehealth') ||
      apptType.includes('video') ||
      apptType.includes('virtual');

    if (!isTelehealth) {
      return res.status(400).json({ error: 'Guest links can only be generated for telehealth appointments' });
    }

    // Check appointment status
    const closedStatuses = ['completed', 'checked_out', 'cancelled', 'no_show'];
    if (closedStatuses.includes(appt.status) || closedStatuses.includes(appt.patient_status)) {
      return res.status(400).json({ error: 'Cannot generate link for closed appointments' });
    }

    // Support email override for one-time links
    const { emailOverride } = req.body;

    // Always decrypt patient data to get the name, regardless of email override
    const decryptedPatient = await preparePatientForResponse({
      first_name: appt.first_name,
      last_name: appt.last_name,
      email: appt.email,
      encryption_metadata: appt.encryption_metadata
    });

    const patientEmail = emailOverride || decryptedPatient.email;

    if (!patientEmail) {
      return res.status(400).json({ error: 'Patient does not have an email address on file' });
    }

    const patientName = `${decryptedPatient.first_name || ''} ${decryptedPatient.last_name || ''}`.trim() || 'Patient';
    const providerName = `Dr. ${appt.provider_last_name || appt.provider_first_name || 'Provider'}`;

    // Generate secure token
    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    // Calculate expiry: appointment time + duration + 90 minutes
    const appointmentDate = new Date(appt.appointment_date);
    const [hours, minutes] = (appt.appointment_time || '09:00').split(':').map(Number);
    appointmentDate.setHours(hours, minutes, 0, 0);

    const durationMinutes = appt.duration || 30;
    const expiresAt = new Date(appointmentDate.getTime() + (durationMinutes + 90) * 60 * 1000);

    // Invalidate any existing tokens for this appointment
    await pool.query(`
      UPDATE guest_access_tokens 
      SET invalidated_at = CURRENT_TIMESTAMP 
      WHERE appointment_id = $1 AND invalidated_at IS NULL
    `, [id]);

    // Create new token
    await pool.query(`
      INSERT INTO guest_access_tokens (appointment_id, patient_id, token_hash, expires_at, created_by)
      VALUES ($1, $2, $3, $4, $5)
    `, [id, appt.patient_id, tokenHash, expiresAt, req.user.id]);

    // Build guest link
    const baseUrl = process.env.BASE_URL || 'https://pagemdemr.com';
    const guestLink = `${baseUrl}/visit/guest?token=${token}`;

    // Format appointment time for email
    const appointmentTimeFormatted = appointmentDate.toLocaleString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });

    // Send email
    await emailService.sendGuestAccessLink(
      patientEmail,
      patientName,
      providerName,
      appointmentTimeFormatted,
      guestLink,
      appt.clinic_phone || '(555) 555-5555'
    );

    console.log(`[Guest Access] Link generated for appointment ${id}, sent to ${patientEmail}`);

    res.json({
      success: true,
      message: 'Guest access link sent successfully',
      sentTo: patientEmail
    });

  } catch (error) {
    console.error('[Guest Access] Error generating link:', error);
    res.status(500).json({ error: 'Failed to generate guest access link' });
  }
});

module.exports = router;












