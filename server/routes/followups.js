const express = require('express');
const pool = require('../db');
const { authenticate, logAudit } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

// Get all follow-ups with optional status filter
router.get('/', async (req, res) => {
  try {
    const { status, startDate, endDate } = req.query;
    
    console.log(`[FOLLOWUPS] GET request - status: ${status}, startDate: ${startDate}, endDate: ${endDate}`);
    
    let query = `
      SELECT 
        cf.*,
        a.appointment_date,
        a.appointment_time,
        a.appointment_type,
        a.patient_status as appointment_status,
        a.cancellation_reason,
        p.first_name as patient_first_name,
        p.last_name as patient_last_name,
        p.phone as patient_phone,
        p.emergency_contact_phone,
        p.emergency_contact_name,
        u_provider.first_name as provider_first_name,
        u_provider.last_name as provider_last_name,
        u_addressed.first_name as addressed_by_first_name,
        u_addressed.last_name as addressed_by_last_name,
        u_dismissed.first_name as dismissed_by_first_name,
        u_dismissed.last_name as dismissed_by_last_name
      FROM cancellation_followups cf
      JOIN appointments a ON cf.appointment_id = a.id
      JOIN patients p ON cf.patient_id = p.id
      LEFT JOIN users u_provider ON a.provider_id = u_provider.id
      LEFT JOIN users u_addressed ON cf.addressed_by = u_addressed.id
      LEFT JOIN users u_dismissed ON cf.dismissed_by = u_dismissed.id
      WHERE 1=1
    `;
    
    const params = [];
    let paramCount = 0;
    
    if (status) {
      paramCount++;
      query += ` AND cf.status = $${paramCount}`;
      params.push(status);
    }
    
    if (startDate) {
      paramCount++;
      query += ` AND a.appointment_date >= $${paramCount}`;
      params.push(startDate);
    }
    
    if (endDate) {
      paramCount++;
      query += ` AND a.appointment_date <= $${paramCount}`;
      params.push(endDate);
    }
    
    query += ` ORDER BY cf.created_at DESC`;
    
    console.log(`[FOLLOWUPS] Executing query with params:`, params);
    const result = await pool.query(query, params);
    
    console.log(`[FOLLOWUPS] Found ${result.rows.length} follow-ups from query`);
    
    // Get notes for each follow-up
    const followupsWithNotes = await Promise.all(
      result.rows.map(async (followup) => {
        const notesResult = await pool.query(
          `SELECT * FROM cancellation_followup_notes 
           WHERE followup_id = $1 
           ORDER BY created_at DESC`,
          [followup.id]
        );
        const mapped = {
          ...followup,
          patientName: `${followup.patient_first_name || ''} ${followup.patient_last_name || ''}`.trim(),
          providerName: followup.provider_first_name ? `${followup.provider_first_name} ${followup.provider_last_name}` : null,
          patientPhone: followup.patient_phone,
          notes: notesResult.rows
        };
        console.log(`[FOLLOWUPS] Mapped follow-up:`, {
          id: mapped.id,
          patientName: mapped.patientName,
          appointment_date: mapped.appointment_date,
          status: mapped.status
        });
        return mapped;
      })
    );
    
    console.log(`[FOLLOWUPS] Returning ${followupsWithNotes.length} follow-ups to client`);
    res.json(followupsWithNotes);
  } catch (error) {
    console.error('Error fetching follow-ups:', error);
    res.status(500).json({ error: 'Failed to fetch follow-ups' });
  }
});

// Get or create follow-up for an appointment
router.post('/ensure', async (req, res) => {
  try {
    const { appointmentId, patientId } = req.body;
    
    if (!appointmentId || !patientId) {
      return res.status(400).json({ error: 'appointmentId and patientId are required' });
    }
    
    // Check if follow-up already exists
    const existing = await pool.query(
      'SELECT * FROM cancellation_followups WHERE appointment_id = $1',
      [appointmentId]
    );
    
    if (existing.rows.length > 0) {
      // Get notes
      const notesResult = await pool.query(
        'SELECT * FROM cancellation_followup_notes WHERE followup_id = $1 ORDER BY created_at DESC',
        [existing.rows[0].id]
      );
      return res.json({ ...existing.rows[0], notes: notesResult.rows });
    }
    
    // Create new follow-up
    const result = await pool.query(
      `INSERT INTO cancellation_followups (appointment_id, patient_id, status)
       VALUES ($1, $2, 'pending')
       RETURNING *`,
      [appointmentId, patientId]
    );
    
    await logAudit(req.user.id, 'followup_created', 'cancellation_followup', result.rows[0].id, 
      { appointmentId, patientId }, req.ip);
    
    res.status(201).json({ ...result.rows[0], notes: [] });
  } catch (error) {
    console.error('Error creating follow-up:', error);
    res.status(500).json({ error: 'Failed to create follow-up' });
  }
});

// Add a note to a follow-up
router.post('/:id/notes', async (req, res) => {
  try {
    const { id } = req.params;
    const { note, noteType } = req.body;
    
    if (!note) {
      return res.status(400).json({ error: 'Note is required' });
    }
    
    const userName = `${req.user.firstName || req.user.first_name || ''} ${req.user.lastName || req.user.last_name || ''}`.trim();
    
    const result = await pool.query(
      `INSERT INTO cancellation_followup_notes (followup_id, note, note_type, created_by, created_by_name)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [id, note, noteType || 'general', req.user.id, userName]
    );
    
    // Update the follow-up's updated_at timestamp
    await pool.query(
      'UPDATE cancellation_followups SET updated_at = CURRENT_TIMESTAMP WHERE id = $1',
      [id]
    );
    
    await logAudit(req.user.id, 'followup_note_added', 'cancellation_followup_note', result.rows[0].id, 
      { followupId: id, noteType }, req.ip);
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error adding note:', error);
    res.status(500).json({ error: 'Failed to add note' });
  }
});

// Mark follow-up as addressed (rescheduled)
router.put('/:id/address', async (req, res) => {
  try {
    const { id } = req.params;
    const { note } = req.body;
    
    const userName = `${req.user.firstName || req.user.first_name || ''} ${req.user.lastName || req.user.last_name || ''}`.trim();
    
    // Update follow-up status
    const result = await pool.query(
      `UPDATE cancellation_followups 
       SET status = 'addressed', 
           addressed_at = CURRENT_TIMESTAMP, 
           addressed_by = $1,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING *`,
      [req.user.id, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Follow-up not found' });
    }
    
    // Add a note if provided
    if (note) {
      await pool.query(
        `INSERT INTO cancellation_followup_notes (followup_id, note, note_type, created_by, created_by_name)
         VALUES ($1, $2, 'rescheduled', $3, $4)`,
        [id, note, req.user.id, userName]
      );
    }
    
    await logAudit(req.user.id, 'followup_addressed', 'cancellation_followup', id, { note }, req.ip);
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error addressing follow-up:', error);
    res.status(500).json({ error: 'Failed to address follow-up' });
  }
});

// Mark follow-up as dismissed (won't reschedule)
router.put('/:id/dismiss', async (req, res) => {
  try {
    const { id } = req.params;
    const { reason, note } = req.body;
    
    if (!reason) {
      return res.status(400).json({ error: 'Dismiss reason is required' });
    }
    
    const userName = `${req.user.firstName || req.user.first_name || ''} ${req.user.lastName || req.user.last_name || ''}`.trim();
    
    // Update follow-up status
    const result = await pool.query(
      `UPDATE cancellation_followups 
       SET status = 'dismissed', 
           dismissed_at = CURRENT_TIMESTAMP, 
           dismissed_by = $1,
           dismiss_reason = $2,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $3
       RETURNING *`,
      [req.user.id, reason, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Follow-up not found' });
    }
    
    // Add a note
    const noteText = note || `Dismissed: ${reason}`;
    await pool.query(
      `INSERT INTO cancellation_followup_notes (followup_id, note, note_type, created_by, created_by_name)
       VALUES ($1, $2, 'dismissed', $3, $4)`,
      [id, noteText, req.user.id, userName]
    );
    
    await logAudit(req.user.id, 'followup_dismissed', 'cancellation_followup', id, { reason, note }, req.ip);
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error dismissing follow-up:', error);
    res.status(500).json({ error: 'Failed to dismiss follow-up' });
  }
});

// Get stats for dashboard
router.get('/stats', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        COUNT(*) FILTER (WHERE status = 'pending') as pending_count,
        COUNT(*) FILTER (WHERE status = 'addressed') as addressed_count,
        COUNT(*) FILTER (WHERE status = 'dismissed') as dismissed_count,
        COUNT(*) as total_count
      FROM cancellation_followups
    `);
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

module.exports = router;





