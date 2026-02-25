const express = require('express');
const pool = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');
const { requirePermission } = require('../services/authorization');

const router = express.Router();
router.use(authenticate);

// Get patient registry (e.g., all patients with diabetes)
router.get('/registry/:condition', requireRole('clinician', 'admin'), async (req, res) => {
  try {
    const { condition } = req.params;
    const { search } = req.query;

    // Search problems table for condition
    const result = await pool.query(
      `SELECT DISTINCT p.*, pr.problem_name, pr.status, pr.onset_date
       FROM patients p
       JOIN problems pr ON p.id = pr.patient_id
       WHERE LOWER(pr.problem_name) LIKE LOWER($1)
       ${search ? `AND (p.first_name ILIKE $2 OR p.last_name ILIKE $2 OR p.mrn ILIKE $2)` : ''}
       ORDER BY p.last_name, p.first_name`,
      search ? [`%${condition}%`, `%${search}%`] : [`%${condition}%`]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching registry:', error);
    res.status(500).json({ error: 'Failed to fetch registry' });
  }
});

// Get quality measures
router.get('/quality-measures', requireRole('clinician', 'admin'), async (req, res) => {
  try {
    const { measure, startDate, endDate } = req.query;

    // Example: Diabetes A1C control measure
    let query = `
      SELECT 
        COUNT(DISTINCT p.id) as total_patients,
        COUNT(DISTINCT CASE WHEN o.result_value::numeric < 7 THEN p.id END) as controlled,
        COUNT(DISTINCT CASE WHEN o.result_value::numeric >= 7 THEN p.id END) as uncontrolled
      FROM patients p
      JOIN problems pr ON p.id = pr.patient_id
      LEFT JOIN orders o ON p.id = o.patient_id 
        AND o.order_type = 'Lab'
        AND o.test_name ILIKE '%A1C%'
        AND o.status = 'completed'
    `;

    const params = [];
    if (startDate) {
      params.push(startDate);
      query += ` AND o.completed_at >= $${params.length}`;
    }
    if (endDate) {
      params.push(endDate);
      query += ` AND o.completed_at <= $${params.length}`;
    }
    query += ` WHERE LOWER(pr.problem_name) LIKE '%diabetes%'`;

    const result = await pool.query(query, params);
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching quality measures:', error);
    res.status(500).json({ error: 'Failed to fetch quality measures' });
  }
});

// Get dashboard statistics (enhanced command center)
router.get('/dashboard', requirePermission('reports:view'), async (req, res) => {
  try {
    const stats = {};
    const userId = req.user?.id;
    const clinicId = req.user?.clinic_id;

    // Use US/Eastern timezone for "today"
    const todayQuery = "(CURRENT_TIMESTAMP AT TIME ZONE 'US/Eastern')::date";

    // Total patients
    let patientsQuery = 'SELECT COUNT(*) as count FROM patients WHERE 1=1';
    const patientsParams = [];
    if (clinicId) {
      patientsQuery += ' AND clinic_id = $1';
      patientsParams.push(clinicId);
    }
    const patients = await pool.query(patientsQuery, patientsParams);
    stats.totalPatients = parseInt(patients.rows[0]?.count || 0);

    // Visits today (Scheduled Appointments) — exclude cancelled/no-show
    const visitsToday = await pool.query(
      `SELECT COUNT(*) as count FROM appointments 
       WHERE appointment_date = ${todayQuery}
       AND status NOT IN ('cancelled', 'no-show')
       ${clinicId ? 'AND clinic_id = $1' : ''}`,
      clinicId ? [clinicId] : []
    );
    stats.visitsToday = parseInt(visitsToday.rows[0]?.count || 0);

    // Patient Flow Breakdown for today
    try {
      const flowQuery = await pool.query(
        `SELECT 
          COUNT(*) FILTER (WHERE patient_status = 'scheduled' OR patient_status IS NULL) as scheduled,
          COUNT(*) FILTER (WHERE patient_status = 'arrived') as arrived,
          COUNT(*) FILTER (WHERE patient_status = 'in-room' OR patient_status = 'in_room') as in_room,
          COUNT(*) FILTER (WHERE patient_status = 'checked_out' OR patient_status = 'checked-out' OR patient_status = 'completed') as checked_out,
          COUNT(*) FILTER (WHERE patient_status = 'no-show' OR patient_status = 'no_show') as no_show,
          COUNT(*) FILTER (WHERE patient_status = 'cancelled') as cancelled
         FROM appointments 
         WHERE appointment_date = ${todayQuery}
         ${clinicId ? 'AND clinic_id = $1' : ''}`,
        clinicId ? [clinicId] : []
      );
      stats.patientFlow = {
        scheduled: parseInt(flowQuery.rows[0]?.scheduled || 0),
        arrived: parseInt(flowQuery.rows[0]?.arrived || 0),
        inRoom: parseInt(flowQuery.rows[0]?.in_room || 0),
        checkedOut: parseInt(flowQuery.rows[0]?.checked_out || 0),
        noShow: parseInt(flowQuery.rows[0]?.no_show || 0),
        cancelled: parseInt(flowQuery.rows[0]?.cancelled || 0),
      };
    } catch (flowError) {
      console.warn('Error fetching patient flow:', flowError);
      stats.patientFlow = { scheduled: 0, arrived: 0, inRoom: 0, checkedOut: 0, noShow: 0, cancelled: 0 };
    }

    // Unsigned notes count for current user
    if (userId) {
      try {
        const unsignedRes = await pool.query(
          `SELECT COUNT(*) as count FROM visits 
           WHERE (provider_id = $1 OR assigned_attending_id = $1)
           AND (status = 'draft' OR status IS NULL OR status = 'preliminary')
           AND note_signed_at IS NULL`,
          [userId]
        );
        stats.unsignedNotes = parseInt(unsignedRes.rows[0]?.count || 0);
      } catch (e) {
        stats.unsignedNotes = 0;
      }
    }

    // In Basket / Tasks (assigned to user)
    if (userId) {
      try {
        const inboxStats = await pool.query(
          `SELECT 
            COUNT(*) FILTER (WHERE status NOT IN ('completed', 'archived') AND assigned_user_id = $1 AND type NOT IN ('lab', 'imaging', 'message', 'note')) as other_count,
            COUNT(*) FILTER (WHERE status NOT IN ('completed', 'archived') AND type IN ('lab', 'imaging')) as labs_count,
            COUNT(*) FILTER (WHERE status NOT IN ('completed', 'archived') AND type = 'message' AND assigned_user_id = $1) as msgs_count,
            COUNT(*) FILTER (WHERE status NOT IN ('completed', 'archived') AND type = 'note' AND assigned_user_id = $1) as notes_count
           FROM inbox_items`,
          [userId]
        );
        stats.pendingOrders = parseInt(inboxStats.rows[0]?.other_count || 0);
        stats.unreadLabs = parseInt(inboxStats.rows[0]?.labs_count || 0);
        stats.unreadMessages = parseInt(inboxStats.rows[0]?.msgs_count || 0);
        stats.pendingNotes = parseInt(inboxStats.rows[0]?.notes_count || 0);

        // Cancellation Follow-ups (Pending)
        const followupStats = await pool.query(
          "SELECT COUNT(*) as count FROM cancellation_followups WHERE status = 'pending'"
        );
        stats.cancellationFollowups = parseInt(followupStats.rows[0]?.count || 0);
      } catch (inboxError) {
        console.warn('Error fetching inbox stats for dashboard:', inboxError);
        stats.pendingOrders = 0;
        stats.unreadMessages = 0;
        stats.unreadLabs = 0;
        stats.pendingNotes = 0;
        stats.cancellationFollowups = 0;
      }
    } else {
      stats.pendingOrders = 0;
      stats.unreadMessages = 0;
      stats.unreadLabs = 0;
      stats.pendingNotes = 0;
    }

    // Tomorrow's appointment count
    try {
      const tomorrowRes = await pool.query(
        `SELECT COUNT(*) as count FROM appointments 
         WHERE appointment_date = (${todayQuery} + INTERVAL '1 day')::date
         AND status NOT IN ('cancelled', 'no-show')
         ${clinicId ? 'AND clinic_id = $1' : ''}`,
        clinicId ? [clinicId] : []
      );
      stats.tomorrowCount = parseInt(tomorrowRes.rows[0]?.count || 0);
    } catch (e) {
      stats.tomorrowCount = 0;
    }

    res.json(stats);
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    console.error('Error details:', error.message, error.stack);
    res.status(500).json({
      error: 'Failed to fetch dashboard statistics',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;

