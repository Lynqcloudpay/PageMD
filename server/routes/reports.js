const express = require('express');
const pool = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');

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

// Get dashboard statistics
router.get('/dashboard', requireRole('clinician', 'admin'), async (req, res) => {
  try {
    const stats = {};
    
    // Total patients
    const patients = await pool.query('SELECT COUNT(*) as count FROM patients');
    stats.totalPatients = parseInt(patients.rows[0]?.count || 0);
    
    // Visits today
    const visitsToday = await pool.query(
      `SELECT COUNT(*) as count FROM visits WHERE DATE(visit_date) = CURRENT_DATE`
    );
    stats.visitsToday = parseInt(visitsToday.rows[0]?.count || 0);
    
    // Pending orders
    const pendingOrders = await pool.query(
      `SELECT COUNT(*) as count FROM orders WHERE status = 'pending'`
    );
    stats.pendingOrders = parseInt(pendingOrders.rows[0]?.count || 0);
    
    // Unread messages (only if user is authenticated)
    if (req.user?.id) {
      try {
        const unreadMessages = await pool.query(
          `SELECT COUNT(*) as count FROM messages WHERE to_user_id = $1 AND read_at IS NULL`,
          [req.user.id]
        );
        stats.unreadMessages = parseInt(unreadMessages.rows[0]?.count || 0);
      } catch (msgError) {
        console.warn('Error fetching unread messages:', msgError);
        stats.unreadMessages = 0;
      }
    } else {
      stats.unreadMessages = 0;
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

