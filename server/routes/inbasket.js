const express = require('express');
const pool = require('../db');
const { authenticate, requireRole, logAudit } = require('../middleware/auth');
const { enrichWithPatientNames, getPatientDisplayName } = require('../services/patientNameUtils');

const router = express.Router();
router.use(authenticate);

// --- HELPER: Sync Logic ---
// Syncs external items (orders, documents) into the inbox_items table
// This ensures we have a unified, real-table representation for everything
async function syncInboxItems(tenantId) {
  // 1. Sync Lab Orders
  await pool.query(`
    INSERT INTO inbox_items (
      id, tenant_id, patient_id, type, priority, status, 
      subject, body, reference_id, reference_table, 
      created_by, created_at, updated_at
    )
    SELECT 
      gen_random_uuid(), $1, patient_id, 'lab', 
      CASE WHEN (order_payload->>'priority') = 'stat' THEN 'stat' ELSE 'normal' END,
      'new',
      COALESCE(order_payload->>'test_name', 'Lab Result'),
      'New lab result ready for review',
      id, 'orders',
      ordered_by, created_at, created_at
    FROM orders 
    WHERE order_type = 'lab' 
      AND (status = 'completed' OR result_value IS NOT NULL)
      AND (reviewed IS NULL OR reviewed = false)
      AND NOT EXISTS (
        SELECT 1 FROM inbox_items 
        WHERE reference_id = orders.id AND reference_table = 'orders'
      )
  `, [tenantId]);

  // 2. Sync Imaging Orders
  await pool.query(`
    INSERT INTO inbox_items (
      id, tenant_id, patient_id, type, priority, status, 
      subject, body, reference_id, reference_table, 
      created_by, created_at, updated_at
    )
    SELECT 
      gen_random_uuid(), $1, patient_id, 'imaging', 'normal',
      'new',
      COALESCE(order_payload->>'study_name', 'Imaging Result'),
      'New imaging result ready for review',
      id, 'orders',
      ordered_by, created_at, created_at
    FROM orders 
    WHERE order_type = 'imaging'
      AND (status = 'completed' OR result_value IS NOT NULL)
      AND (reviewed IS NULL OR reviewed = false)
      AND NOT EXISTS (
        SELECT 1 FROM inbox_items 
        WHERE reference_id = orders.id AND reference_table = 'orders'
      )
  `, [tenantId]);

  // 3. Sync Documents
  await pool.query(`
    INSERT INTO inbox_items (
      id, tenant_id, patient_id, type, priority, status, 
      subject, body, reference_id, reference_table, 
      created_by, created_at, updated_at
    )
    SELECT 
      gen_random_uuid(), $1, patient_id, 'document', 'normal',
      'new',
      filename,
      COALESCE(doc_type, 'Document Upload'),
      id, 'documents',
      uploader_id, created_at, created_at
    FROM documents
    WHERE (reviewed IS NULL OR reviewed = false)
      AND NOT EXISTS (
        SELECT 1 FROM inbox_items 
        WHERE reference_id = documents.id AND reference_table = 'documents'
      )
  `, [tenantId]);

  // 4. Sync Old Messages/Tasks
  await pool.query(`
    INSERT INTO inbox_items (
      id, tenant_id, patient_id, type, priority, status, 
      subject, body, reference_id, reference_table, 
      assigned_user_id, created_by, created_at, updated_at,
      completed_at
    )
    SELECT 
      gen_random_uuid(), $1, patient_id, 
      CASE WHEN message_type = 'task' THEN 'task' ELSE 'message' END,
      COALESCE(priority, 'normal'),
      CASE 
        WHEN task_status = 'completed' THEN 'completed'
        WHEN read_at IS NOT NULL THEN 'read'
        ELSE 'new'
      END,
      subject, body, id, 'messages',
      to_user_id, from_user_id, created_at, created_at,
      CASE WHEN task_status = 'completed' THEN updated_at ELSE NULL END
    FROM messages
    WHERE NOT EXISTS (
        SELECT 1 FROM inbox_items 
        WHERE reference_id = messages.id AND reference_table = 'messages'
    )
  `, [tenantId]);
}

// --- ROUTES ---

// GET / - List items (with sync)
router.get('/', async (req, res) => {
  try {
    const { status = 'new', type, assignedTo } = req.query;
    const tenantId = req.user.tenantId || req.user.tenant_id; // Handle both cases if needed, assuming tenant is on user

    // Trigger sync first (fire and forget usually, but manageable here)
    if (tenantId) {
      await syncInboxItems(tenantId);
    }

    let query = `
      SELECT i.*, 
             u_assigned.first_name as assigned_first_name, u_assigned.last_name as assigned_last_name,
             u_created.first_name as created_by_first_name, u_created.last_name as created_by_last_name
      FROM inbox_items i
      LEFT JOIN users u_assigned ON i.assigned_user_id = u_assigned.id
      LEFT JOIN users u_created ON i.created_by = u_created.id
      WHERE 1=1
    `;
    const params = [];
    let paramCount = 0;

    // Filters
    if (status && status !== 'all') {
      if (status === 'completed') {
        paramCount++;
        query += ` AND i.status = $${paramCount}`;
        params.push('completed');
      } else {
        // Default view: everything not completed/archived
        query += ` AND i.status NOT IN ('completed', 'archived')`;
      }
    }

    if (type && type !== 'all') {
      paramCount++;
      query += ` AND i.type = $${paramCount}`;
      params.push(type);
    }

    if (assignedTo === 'me') {
      paramCount++;
      query += ` AND i.assigned_user_id = $${paramCount}`;
      params.push(req.user.id);
    }

    query += ` ORDER BY i.created_at DESC LIMIT 100`;

    const result = await pool.query(query, params);

    // Enrich with patient names (SAFE DECRYPTION)
    const richItems = await enrichWithPatientNames(result.rows, 'patient_id');

    res.json(richItems);
  } catch (error) {
    console.error('Error fetching inbasket:', error);
    res.status(500).json({ error: 'Failed to fetch inbasket' });
  }
});

// GET /stats - Counters for sidebar
router.get('/stats', async (req, res) => {
  try {
    const counts = await pool.query(`
      SELECT 
        COUNT(*) FILTER (WHERE status NOT IN ('completed', 'archived')) as all_count,
        COUNT(*) FILTER (WHERE status NOT IN ('completed', 'archived') AND assigned_user_id = $1) as my_count,
        COUNT(*) FILTER (WHERE status NOT IN ('completed', 'archived') AND type = 'lab') as labs_count,
        COUNT(*) FILTER (WHERE status NOT IN ('completed', 'archived') AND type = 'document') as docs_count,
        COUNT(*) FILTER (WHERE status NOT IN ('completed', 'archived') AND type = 'message') as msgs_count,
        COUNT(*) FILTER (WHERE status NOT IN ('completed', 'archived') AND type = 'task') as tasks_count,
        COUNT(*) FILTER (WHERE status NOT IN ('completed', 'archived') AND type = 'refill') as refills_count
      FROM inbox_items
    `, [req.user.id]);

    res.json(counts.rows[0]);
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Failed' });
  }
});

// GET /:id - Details with threading
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // 1. Get Item
    const itemRes = await pool.query(`
      SELECT i.*, 
             u_assigned.first_name as assigned_first_name, u_assigned.last_name as assigned_last_name
      FROM inbox_items i
      LEFT JOIN users u_assigned ON i.assigned_user_id = u_assigned.id
      WHERE i.id = $1
    `, [id]);

    if (itemRes.rows.length === 0) return res.status(404).json({ error: 'Item not found' });

    const item = (await enrichWithPatientNames(itemRes.rows, 'patient_id'))[0];

    // 2. Get Notes/Thread
    const notesRes = await pool.query(`
      SELECT n.*, u.first_name, u.last_name
      FROM inbox_notes n
      LEFT JOIN users u ON n.user_id = u.id
      WHERE n.item_id = $1
      ORDER BY n.created_at ASC
    `, [id]);

    res.json({ ...item, notes: notesRes.rows });
  } catch (error) {
    console.error('Error fetching details:', error);
    res.status(500).json({ error: 'Failed' });
  }
});

// POST / - Create new item (Task/Message)
router.post('/', async (req, res) => {
  try {
    const { type, subject, body, patientId, priority = 'normal', assignedUserId } = req.body;

    const result = await pool.query(`
      INSERT INTO inbox_items (
        type, subject, body, patient_id, priority, assigned_user_id, created_by, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'new')
      RETURNING *
    `, [type, subject, body, patientId || null, priority, assignedUserId || null, req.user.id]);

    await logAudit(req.user.id, 'inbasket_create', 'inbox_items', result.rows[0].id, { type });
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error creating item:', error);
    res.status(500).json({ error: 'Failed' });
  }
});

// PUT /:id - Update status/assignment
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, assignedUserId, priority } = req.body;

    const updates = [];
    const params = [];
    let paramCount = 0;

    if (status) {
      paramCount++;
      updates.push(`status = $${paramCount}`);
      params.push(status);

      if (status === 'completed') {
        updates.push(`completed_at = CURRENT_TIMESTAMP`);
        updates.push(`completed_by = '${req.user.id}'`);
      }
    }

    if (assignedUserId !== undefined) { // Allow null to unassign
      paramCount++;
      updates.push(`assigned_user_id = $${paramCount}`);
      params.push(assignedUserId);
    }

    if (priority) {
      paramCount++;
      updates.push(`priority = $${paramCount}`);
      params.push(priority);
    }

    if (updates.length === 0) return res.json({});

    params.push(id);
    const query = `UPDATE inbox_items SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $${params.length} RETURNING *`;

    const result = await pool.query(query, params);

    // Propagate completion to original orders/docs if applicable
    if (status === 'completed' && result.rows[0].reference_id) {
      const item = result.rows[0];
      if (item.reference_table === 'orders') {
        await pool.query("UPDATE orders SET reviewed = true, reviewed_at = CURRENT_TIMESTAMP, reviewed_by = $1 WHERE id = $2", [req.user.id, item.reference_id]);
      } else if (item.reference_table === 'documents') {
        await pool.query("UPDATE documents SET reviewed = true, reviewed_at = CURRENT_TIMESTAMP, reviewed_by = $1 WHERE id = $2", [req.user.id, item.reference_id]);
      }
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating item:', error);
    res.status(500).json({ error: 'Failed' });
  }
});

// POST /:id/notes - Add note/reply
router.post('/:id/notes', async (req, res) => {
  try {
    const { id } = req.params;
    const { note } = req.body;

    const result = await pool.query(`
      INSERT INTO inbox_notes (item_id, user_id, user_name, note)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `, [id, req.user.id, `${req.user.first_name} ${req.user.last_name}`, note]);

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error adding note:', error);
    res.status(500).json({ error: 'Failed' });
  }
});

module.exports = router;
