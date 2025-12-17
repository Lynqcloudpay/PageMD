const express = require('express');
const pool = require('../db');
const { authenticate, requireRole, logAudit } = require('../middleware/auth');
const { requirePermission } = require('../services/authorization');

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

    // Get diagnoses for each order
    const orders = await Promise.all(result.rows.map(async (order) => {
      try {
        const diagnosesResult = await pool.query(`
          SELECT pr.id, pr.problem_name, pr.icd10_code
          FROM order_diagnoses od
          JOIN problems pr ON od.problem_id = pr.id
          WHERE od.order_id = $1 AND od.order_type = $2
        `, [order.id, order.order_type || 'prescription']);

        return {
          ...order,
          diagnoses: diagnosesResult.rows.map(d => ({
            id: d.id,
            name: d.problem_name,
            icd10Code: d.icd10_code
          }))
        };
      } catch (diagnosisError) {
        console.warn(`Error fetching diagnoses for order ${order.id}:`, diagnosisError.message);
        // Return order without diagnoses if there's an error
        return {
          ...order,
          diagnoses: []
        };
      }
    }));

    // Get user's favorites if logged in
    let favoriteIds = new Set();
    if (req.user?.id) {
      try {
        const favoritesResult = await pool.query(
          'SELECT favorite_id FROM favorites WHERE user_id = $1 AND favorite_type = $2',
          [req.user.id, 'order']
        );
        favoriteIds = new Set(favoritesResult.rows.map(row => String(row.favorite_id)));
      } catch (favError) {
        console.warn('Error fetching favorites:', favError);
      }
    }
    
    // Add isFavorite flag to each order
    const ordersWithFavorites = orders.map(order => ({
      ...order,
      isFavorite: favoriteIds.has(String(order.id))
    }));

    res.json(ordersWithFavorites);
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

// Get orders for a specific visit (including referrals)
router.get('/visit/:visitId', async (req, res) => {
  try {
    const { visitId } = req.params;
    
    // Get orders
    const ordersResult = await pool.query(
      `SELECT o.*, u.first_name as ordered_by_first_name, u.last_name as ordered_by_last_name
       FROM orders o
       JOIN users u ON o.ordered_by = u.id
       WHERE o.visit_id = $1
       ORDER BY o.created_at ASC`,
      [visitId]
    );

    // Get referrals for the same visit
    const referralsResult = await pool.query(
      `SELECT r.*, u.first_name as ordered_by_first_name, u.last_name as ordered_by_last_name
       FROM referrals r
       JOIN users u ON r.created_by = u.id
       WHERE r.visit_id = $1
       ORDER BY r.created_at ASC`,
      [visitId]
    );

    // Get patient ID from first order (all orders should have same patient)
    const patientId = ordersResult.rows.length > 0 ? ordersResult.rows[0].patient_id : null;
    
    // Get patient's active problems as fallback diagnoses for orders without diagnoses
    let fallbackDiagnoses = [];
    if (patientId) {
      try {
        const problemsResult = await pool.query(
          `SELECT id, problem_name, icd10_code 
           FROM problems 
           WHERE patient_id = $1 AND status = 'active'
           ORDER BY created_at DESC
           LIMIT 5`,
          [patientId]
        );
        fallbackDiagnoses = problemsResult.rows;
      } catch (error) {
        console.warn('Error fetching fallback diagnoses:', error);
      }
    }

    // Get diagnoses for each order
    const orders = await Promise.all(ordersResult.rows.map(async (order) => {
      try {
        const diagnosesResult = await pool.query(`
          SELECT pr.id, pr.problem_name, pr.icd10_code
          FROM order_diagnoses od
          JOIN problems pr ON od.problem_id = pr.id
          WHERE od.order_id = $1 AND od.order_type = $2
        `, [order.id, order.order_type || 'prescription']);

        let diagnoses = diagnosesResult.rows.map(d => ({
          id: d.id,
          name: d.problem_name || d.name,
          icd10Code: d.icd10_code
        }));
        
        // If order has no diagnoses, use fallback diagnoses from patient's active problems
        if (diagnoses.length === 0 && fallbackDiagnoses.length > 0) {
          diagnoses = fallbackDiagnoses.map(d => ({
            id: d.id,
            name: d.problem_name,
            icd10Code: d.icd10_code
          }));
        }

        return {
          ...order,
          diagnoses: diagnoses
        };
      } catch (diagnosisError) {
        console.warn(`Error fetching diagnoses for order ${order.id}:`, diagnosisError.message);
        // Use fallback diagnoses if available
        return {
          ...order,
          diagnoses: fallbackDiagnoses.length > 0 ? fallbackDiagnoses.map(d => ({
            id: d.id,
            name: d.problem_name,
            icd10Code: d.icd10_code
          })) : []
        };
      }
    }));

    // Convert referrals to order format for consistency
    const referralOrders = await Promise.all(referralsResult.rows.map(async (referral) => {
      // Get diagnoses for referral from order_diagnoses table
      let diagnoses = [];
      try {
        const diagnosesResult = await pool.query(`
          SELECT pr.id, pr.problem_name, pr.icd10_code
          FROM order_diagnoses od
          JOIN problems pr ON od.problem_id = pr.id
          WHERE od.order_id = $1 AND od.order_type = $2
        `, [referral.id, 'referral']);
        
        diagnoses = diagnosesResult.rows.map(d => ({
          id: d.id,
          name: d.problem_name || d.name,
          icd10Code: d.icd10_code
        }));
      } catch (error) {
        console.warn('Error fetching referral diagnoses:', error);
      }

      return {
        id: referral.id,
        order_type: 'referral',
        order_payload: JSON.stringify({
          specialist: referral.recipient_specialty || referral.recipient_name,
          reason: referral.reason,
          recipientName: referral.recipient_name,
          recipientAddress: referral.recipient_address,
          referralLetter: referral.referral_letter
        }),
        patient_id: referral.patient_id,
        visit_id: referral.visit_id,
        ordered_by: referral.created_by,
        ordered_by_first_name: referral.ordered_by_first_name,
        ordered_by_last_name: referral.ordered_by_last_name,
        created_at: referral.created_at,
        diagnoses: diagnoses
      };
    }));

    // Combine orders and referrals
    const allOrders = [...orders, ...referralOrders];

    res.json(allOrders);
  } catch (error) {
    console.error('Error fetching visit orders:', error);
    res.status(500).json({ error: 'Failed to fetch visit orders' });
  }
});

// Create order - IMPROVED VERSION
router.post('/', requirePermission('notes:create'), async (req, res) => {
  const client = await pool.connect();
  
  // --- helpers ---
  const normalizeOrderType = (t) => {
    if (!t) return t;
    const v = String(t).toLowerCase().trim();
    // keep DB consistent: store/link prescriptions as "prescription"
    if (v === 'rx') return 'prescription';
    return v;
  };

  const toCleanString = (v) => (v == null ? '' : String(v).trim());

  // Upsert a "problem" for a diagnosis object and return problem_id
  const upsertProblemFromDiagnosis = async (patientId, d) => {
    const name =
      toCleanString(d?.problem_name) ||
      toCleanString(d?.name) ||
      toCleanString(d?.label);

    const icd10 =
      toCleanString(d?.icd10_code) ||
      toCleanString(d?.icd10Code) ||
      null;

    if (!name) return null;

    // 1) Try match by ICD10 (best)
    if (icd10) {
      const byCode = await client.query(
        `SELECT id
         FROM problems
         WHERE patient_id = $1 AND icd10_code = $2 AND status = 'active'
         ORDER BY created_at DESC
         LIMIT 1`,
        [patientId, icd10]
      );
      if (byCode.rows[0]?.id) return byCode.rows[0].id;
    }

    // 2) Try match by name
    const byName = await client.query(
      `SELECT id
       FROM problems
       WHERE patient_id = $1 AND problem_name = $2 AND status = 'active'
       ORDER BY created_at DESC
       LIMIT 1`,
      [patientId, name]
    );
    if (byName.rows[0]?.id) return byName.rows[0].id;

    // 3) Create new
    const created = await client.query(
      `INSERT INTO problems (patient_id, problem_name, icd10_code, status)
       VALUES ($1, $2, $3, 'active')
       RETURNING id`,
      [patientId, name, icd10]
    );
    return created.rows[0]?.id || null;
  };

  try {
    await client.query('BEGIN');

    const patientId = req.body?.patientId;
    const visitId = req.body?.visitId || null;
    const orderTypeRaw = req.body?.orderType;
    const orderType = normalizeOrderType(orderTypeRaw);
    const orderPayload = req.body?.orderPayload;
    const diagnosisIds = Array.isArray(req.body?.diagnosisIds) ? req.body.diagnosisIds : [];
    const diagnosisObjects = Array.isArray(req.body?.diagnosisObjects) ? req.body.diagnosisObjects : [];

    // Validate required fields
    if (!patientId) {
      await client.query('ROLLBACK').catch(() => {});
      return res.status(400).json({ error: 'Patient ID is required' });
    }

    if (!orderType) {
      await client.query('ROLLBACK').catch(() => {});
      return res.status(400).json({ error: 'Order type is required' });
    }

    const allowedOrderTypes = ['lab', 'imaging', 'prescription', 'referral', 'procedure'];
    if (!allowedOrderTypes.includes(orderType)) {
      await client.query('ROLLBACK').catch(() => {});
      return res.status(400).json({
        error: `Invalid order type: ${orderTypeRaw}. Must be one of: ${allowedOrderTypes.join(', ')}`
      });
    }

    // ✅ IMPORTANT FIX: allow diagnosisObjects as satisfying diagnosis requirement
    if ((diagnosisIds.length === 0) && (diagnosisObjects.length === 0)) {
      await client.query('ROLLBACK').catch(() => {});
      return res.status(400).json({
        error: 'At least one diagnosis is required (diagnosisIds or diagnosisObjects).'
      });
    }

    if (!req.user?.id) {
      await client.query('ROLLBACK').catch(() => {});
      return res.status(401).json({ error: 'User authentication required' });
    }

    // Ensure payload is object (JSONB)
    let payloadValue = null;
    if (orderPayload != null) {
      if (typeof orderPayload === 'string') {
        try {
          payloadValue = JSON.parse(orderPayload);
        } catch {
          payloadValue = orderPayload;
        }
      } else {
        payloadValue = orderPayload;
      }
    }

    // Create the order
    const orderInsert = await client.query(
      `INSERT INTO orders (patient_id, visit_id, order_type, ordered_by, order_payload)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [patientId, visitId, orderType, req.user.id, payloadValue]
    );
    const order = orderInsert.rows[0];

    // ---- Resolve diagnoses to real problems.id ----
    const problemIds = new Set();
    const invalidDiagnosisIds = [];

    // 1) If diagnosisObjects provided, upsert problems for them (most reliable)
    for (const d of diagnosisObjects) {
      const pid = await upsertProblemFromDiagnosis(patientId, d);
      if (pid) problemIds.add(String(pid));
    }

    // 2) Also accept "real" problem IDs from diagnosisIds (ignore temp ids safely)
    for (const rawId of diagnosisIds) {
      if (!rawId) continue;
      const idStr = String(rawId);

      // Skip temp IDs (we handled via diagnosisObjects already)
      if (idStr.startsWith('temp-') || idStr.startsWith('assessment-')) continue;

      const check = await client.query(
        `SELECT id
         FROM problems
         WHERE id = $1 AND patient_id = $2`,
        [rawId, patientId]
      );

      if (check.rows[0]?.id) {
        problemIds.add(String(check.rows[0].id));
      } else {
        invalidDiagnosisIds.push(idStr);
      }
    }

    // ✅ If still nothing, throw the same error but now you'll know WHY
    if (problemIds.size === 0) {
      await client.query('ROLLBACK').catch(() => {});
      return res.status(400).json({
        error: 'At least one valid diagnosis is required. The provided diagnosis IDs are invalid or do not exist in the database.',
        details: process.env.NODE_ENV === 'development'
          ? { patientId, orderType, diagnosisIds, diagnosisObjectsCount: diagnosisObjects.length, invalidDiagnosisIds }
          : undefined
      });
    }

    // Link order_diagnoses
    for (const pid of problemIds) {
      await client.query(
        `INSERT INTO order_diagnoses (order_id, problem_id, order_type)
         VALUES ($1, $2, $3)
         ON CONFLICT (order_id, problem_id, order_type) DO NOTHING`,
        [order.id, pid, orderType]
      );
    }

    await client.query('COMMIT');

    // Return order with diagnoses
    const diagnosesResult = await pool.query(
      `SELECT pr.id, pr.problem_name, pr.icd10_code
       FROM order_diagnoses od
       JOIN problems pr ON od.problem_id = pr.id
       WHERE od.order_id = $1 AND od.order_type = $2`,
      [order.id, orderType]
    );

    // Non-blocking audit
    try {
      await logAudit(req.user.id, 'create_order', 'order', order.id, { orderType, diagnosisCount: problemIds.size }, req.ip);
    } catch {}

    return res.status(201).json({
      ...order,
      diagnoses: diagnosesResult.rows.map(d => ({
        id: d.id,
        name: d.problem_name,
        icd10Code: d.icd10_code
      }))
    });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Error creating order:', error);
    return res.status(500).json({
      error: 'Failed to create order',
      message: error.message,
      details: (process.env.NODE_ENV === 'development') ? {
        code: error.code,
        detail: error.detail,
        constraint: error.constraint,
        table: error.table,
        column: error.column
      } : undefined
    });
  } finally {
    client.release();
  }
});


// Update order status
router.put('/:id', requirePermission('orders:create'), async (req, res) => {
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

// Add/remove order favorite
router.post('/:id/favorite', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    // Check if already favorited
    const existing = await pool.query(
      'SELECT id FROM favorites WHERE user_id = $1 AND favorite_type = $2 AND favorite_id = $3',
      [userId, 'order', id]
    );
    
    if (existing.rows.length > 0) {
      // Remove favorite
      await pool.query(
        'DELETE FROM favorites WHERE user_id = $1 AND favorite_type = $2 AND favorite_id = $3',
        [userId, 'order', id]
      );
      res.json({ isFavorite: false });
    } else {
      // Add favorite
      await pool.query(
        'INSERT INTO favorites (user_id, favorite_type, favorite_id) VALUES ($1, $2, $3)',
        [userId, 'order', id]
      );
      res.json({ isFavorite: true });
    }
  } catch (error) {
    console.error('Error toggling order favorite:', error);
    res.status(500).json({ error: 'Failed to toggle favorite' });
  }
});

// Delete order
router.delete('/:id', requirePermission('orders:create'), async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { id } = req.params;
    
    // Check if order exists
    const existingOrder = await client.query('SELECT id, visit_id FROM orders WHERE id = $1', [id]);
    
    if (existingOrder.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Order not found' });
    }
    
    const order = existingOrder.rows[0];
    
    // Delete order_diagnoses first (foreign key constraint)
    await client.query('DELETE FROM order_diagnoses WHERE order_id = $1', [id]);
    
    // Delete the order
    await client.query('DELETE FROM orders WHERE id = $1 RETURNING *', [id]);
    
    await client.query('COMMIT');
    await logAudit(req.user.id, 'delete_order', 'order', id, { visitId: order.visit_id }, req.ip);
    
    res.json({ message: 'Order deleted successfully' });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Error deleting order:', error);
    res.status(500).json({ error: 'Failed to delete order' });
  } finally {
    client.release();
  }
});

module.exports = router;



