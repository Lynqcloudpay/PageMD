const express = require('express');
const pool = require('../db');
const { authenticate, requireRole, logAudit } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

// Get orders for patient
router.get('/patient/:patientId', async (req, res) => {
  try {
    const { patientId } = req.params;
    const result = await pool.query(
      `SELECT o.*, u.first_name as ordered_by_first_name, u.last_name as ordered_by_last_name
       FROM orders o
       JOIN users u ON o.ordered_by = u.id
       WHERE o.patient_id = $1
       ORDER BY o.created_at DESC`,
      [patientId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

// Create order
router.post('/', requireRole('clinician'), async (req, res) => {
  try {
    const { patientId, visitId, orderType, orderPayload } = req.body;

    const result = await pool.query(
      `INSERT INTO orders (patient_id, visit_id, order_type, ordered_by, order_payload)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [patientId, visitId, orderType, req.user.id, orderPayload ? JSON.stringify(orderPayload) : null]
    );

    await logAudit(req.user.id, 'create_order', 'order', result.rows[0].id, { orderType }, req.ip);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating order:', error);
    res.status(500).json({ error: 'Failed to create order' });
  }
});

// Update order status
router.put('/:id', requireRole('clinician', 'nurse'), async (req, res) => {
  try {
    const { id } = req.params;
    const { status, externalOrderId, reviewed, comment, orderPayload } = req.body;

    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (status !== undefined) {
      updates.push(`status = $${paramIndex}`);
      values.push(status);
      paramIndex++;
    }

    if (externalOrderId) {
      updates.push(`external_order_id = $${paramIndex}`);
      values.push(externalOrderId);
      paramIndex++;
    }

    if (reviewed !== undefined) {
      updates.push(`reviewed = $${paramIndex}`);
      values.push(reviewed);
      paramIndex++;
      
      if (reviewed) {
        updates.push(`reviewed_at = CURRENT_TIMESTAMP`);
        updates.push(`reviewed_by = $${paramIndex}`);
        values.push(req.user.id);
        paramIndex++;
      }
    }

    if (comment !== undefined && comment.trim()) {
      // If comment is provided, add it to the comments array with timestamp
      // IMPORTANT: Always preserve all previous comments for legal record keeping
      const currentOrder = await pool.query('SELECT comments FROM orders WHERE id = $1', [id]);
      let existingComments = currentOrder.rows[0]?.comments || [];
      
      console.log('Current order comments before update:', existingComments);
      
      // Parse existing comments if they're stored as a string
      if (typeof existingComments === 'string') {
        try {
          existingComments = JSON.parse(existingComments);
        } catch (e) {
          console.error('Error parsing existing comments:', e);
          // If parsing fails, start with empty array
          existingComments = [];
        }
      }
      
      // Ensure existingComments is an array
      if (!Array.isArray(existingComments)) {
        console.warn('Existing comments is not an array, resetting:', existingComments);
        existingComments = [];
      }
      
      console.log('Existing comments count:', existingComments.length);
      
      const newComment = {
        comment: comment.trim(),
        timestamp: new Date().toISOString(),
        userId: req.user.id,
        userName: `${req.user.first_name} ${req.user.last_name}` || 'Unknown'
      };
      
      // Append new comment to existing comments (never delete previous comments)
      const updatedComments = [...existingComments, newComment];
      
      console.log('Updated comments count:', updatedComments.length);
      console.log('All comments:', JSON.stringify(updatedComments, null, 2));
      
      updates.push(`comments = $${paramIndex}`);
      values.push(JSON.stringify(updatedComments));
      paramIndex++;
      
      // Also update the legacy comment field for backward compatibility (keep most recent)
      updates.push(`comment = $${paramIndex}`);
      values.push(comment.trim());
      paramIndex++;
    }

    if (orderPayload) {
      updates.push(`order_payload = $${paramIndex}`);
      values.push(JSON.stringify(orderPayload));
      paramIndex++;
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);

    const result = await pool.query(
      `UPDATE orders SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    await logAudit(req.user.id, 'update_order', 'order', id, { status, reviewed }, req.ip);

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating order:', error);
    res.status(500).json({ error: 'Failed to update order' });
  }
});

module.exports = router;



