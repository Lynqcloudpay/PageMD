const express = require('express');
const pool = require('../db');
const { authenticate, logAudit } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

// Get messages for user
router.get('/', async (req, res) => {
  try {
    const { patientId, type } = req.query;
    let query = `
      SELECT m.*, 
        u1.first_name as from_first_name, u1.last_name as from_last_name,
        u2.first_name as to_first_name, u2.last_name as to_last_name
      FROM messages m
      JOIN users u1 ON m.from_user_id = u1.id
      LEFT JOIN users u2 ON m.to_user_id = u2.id
      WHERE (m.from_user_id = $1 OR m.to_user_id = $1 OR m.to_user_id IS NULL)
    `;
    const params = [req.user.id];
    let paramIndex = 2;

    if (patientId) {
      query += ` AND m.patient_id = $${paramIndex}`;
      params.push(patientId);
      paramIndex++;
    }

    if (type) {
      query += ` AND m.message_type = $${paramIndex}`;
      params.push(type);
      paramIndex++;
    }

    query += ` ORDER BY m.created_at DESC`;

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// Create message
router.post('/', async (req, res) => {
  try {
    const { patientId, toUserId, subject, body, messageType, priority } = req.body;

    const result = await pool.query(
      `INSERT INTO messages (patient_id, from_user_id, to_user_id, subject, body, message_type, priority)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [patientId || null, req.user.id, toUserId || null, subject, body, messageType || 'message', priority || 'normal']
    );

    await logAudit(req.user.id, 'create_message', 'message', result.rows[0].id, {}, req.ip);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating message:', error);
    res.status(500).json({ error: 'Failed to create message' });
  }
});

// Mark message as read
router.put('/:id/read', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `UPDATE messages SET read_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Message not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error marking message as read:', error);
    res.status(500).json({ error: 'Failed to mark message as read' });
  }
});

// Update task status
router.put('/:id/task', async (req, res) => {
  try {
    const { id } = req.params;
    const { taskStatus } = req.body;

    const result = await pool.query(
      `UPDATE messages SET task_status = $1 WHERE id = $2 AND message_type = 'task' RETURNING *`,
      [taskStatus, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    await logAudit(req.user.id, 'update_task', 'message', id, { taskStatus }, req.ip);

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating task:', error);
    res.status(500).json({ error: 'Failed to update task' });
  }
});

module.exports = router;



