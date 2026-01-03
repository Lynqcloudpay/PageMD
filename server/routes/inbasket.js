const express = require('express');
const pool = require('../db');
const { authenticate, requireRole, logAudit } = require('../middleware/auth');
const { enrichWithPatientNames, getPatientDisplayName } = require('../services/patientNameUtils');

const router = express.Router();
router.use(authenticate);

// --- HELPER: Sync Logic ---
// Syncs external items (orders, documents) into the inbox_items table
// This ensures we have a unified, real-table representation for everything
// Schema self-healing state
async function ensureSchema(client) {
  const db = client || pool;
  // 1. Try to create extensions (separately, ignored if fails due to permissions)
  try {
    await db.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');
    await db.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
  } catch (e) {
    // Ignore extension creation errors (likely permission issues or already exists)
    // Postgres 13+ has gen_random_uuid() built-in anyway
    console.warn('Note: Could not create extensions (might already exist):', e.message);
  }

  // 2. Create Tables
  try {
    // Note: We don't start a transaction here because the caller (syncInboxItems) handles it or connection state
    await db.query(`
            CREATE TABLE IF NOT EXISTS inbox_items (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                tenant_id UUID,
                patient_id UUID REFERENCES patients(id),
                type VARCHAR(50) NOT NULL,
                priority VARCHAR(20) DEFAULT 'normal',
                status VARCHAR(50) DEFAULT 'new',
                subject VARCHAR(255),
                body TEXT,
                reference_id UUID,
                reference_table VARCHAR(50),
                assigned_user_id UUID REFERENCES users(id),
                assigned_role VARCHAR(50),
                created_by UUID REFERENCES users(id),
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                completed_at TIMESTAMP WITH TIME ZONE,
                completed_by UUID REFERENCES users(id)
            )
        `);

    await db.query(`
            CREATE TABLE IF NOT EXISTS inbox_notes (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                item_id UUID REFERENCES inbox_items(id) ON DELETE CASCADE,
                user_id UUID REFERENCES users(id),
                user_name VARCHAR(100),
                note TEXT NOT NULL,
                is_internal BOOLEAN DEFAULT true,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            )
        `);

    // Indexes
    await db.query(`CREATE INDEX IF NOT EXISTS idx_inbox_assigned_user ON inbox_items(assigned_user_id) WHERE status != 'completed'`);
    await db.query(`CREATE INDEX IF NOT EXISTS idx_inbox_patient ON inbox_items(patient_id)`);
    await db.query(`CREATE INDEX IF NOT EXISTS idx_inbox_status ON inbox_items(status)`);
    await db.query(`CREATE INDEX IF NOT EXISTS idx_inbox_reference ON inbox_items(reference_id)`);

    // 3. Self-healing migration for portal_appointment_requests
    // This ensures that existing schemas get the provider_id column we recently added.
    try {
      await db.query(`
            DO $$ 
            BEGIN 
                IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'portal_appointment_requests') THEN
                    ALTER TABLE portal_appointment_requests ADD COLUMN IF NOT EXISTS provider_id UUID REFERENCES users(id);
                END IF;
            END $$;
        `);
    } catch (e) {
      console.warn('Self-healing migration failed (provider_id):', e.message);
    }

  } catch (error) {
    console.error('Error ensuring inbasket schema:', error);
    // Don't throw, let the query fail naturally if table doesn't exist, 
    // but at least we tried our best.
  }
}

async function syncInboxItems(tenantId, schema) {
  const client = await pool.connect();
  try {
    if (schema) {
      // Set the search path strictly to the tenant schema first, then public
      await client.query(`SET search_path TO ${schema}, public`);
    }

    await ensureSchema(client);

    // 1. Sync Lab Orders
    await client.query(`
    INSERT INTO inbox_items (
      id, tenant_id, patient_id, type, priority, status, 
      subject, body, reference_id, reference_table, 
      created_by, assigned_user_id, created_at, updated_at
    )
    SELECT 
      gen_random_uuid(), $1, patient_id, 'lab', 
      CASE WHEN (order_payload->>'priority') = 'stat' THEN 'stat' ELSE 'normal' END,
      'new',
      COALESCE(order_payload->>'test_name', 'Lab Result'),
      'New lab result ready for review',
      id, 'orders',
      ordered_by, ordered_by, created_at, created_at
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
    await client.query(`
    INSERT INTO inbox_items (
      id, tenant_id, patient_id, type, priority, status, 
      subject, body, reference_id, reference_table, 
      created_by, assigned_user_id, created_at, updated_at
    )
    SELECT 
      gen_random_uuid(), $1, patient_id, 'imaging', 'normal',
      'new',
      COALESCE(order_payload->>'study_name', 'Imaging Result'),
      'New imaging result ready for review',
      id, 'orders',
      ordered_by, ordered_by, created_at, created_at
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
    await client.query(`
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
    ${tenantId ? 'AND tenant_id = $1' : ''}
      AND NOT EXISTS (
        SELECT 1 FROM inbox_items 
        WHERE reference_id = documents.id AND reference_table = 'documents'
      )
  `, [tenantId]);

    // 4. Sync Referrals
    await client.query(`
    INSERT INTO inbox_items (
      id, tenant_id, patient_id, type, priority, status, 
      subject, body, reference_id, reference_table, 
      created_by, created_at, updated_at
    )
    SELECT 
      gen_random_uuid(), $1, patient_id, 'referral', 'normal',
      'new',
      'Referral: ' || COALESCE(recipient_name, recipient_specialty, 'New Referral'),
      reason,
      id, 'referrals',
      created_by, created_at, created_at
    FROM referrals
    WHERE (status IS NULL OR status = 'pending' OR status = 'new')
      AND NOT EXISTS (
        SELECT 1 FROM inbox_items 
        WHERE reference_id = referrals.id AND reference_table = 'referrals'
      )
  `, [tenantId]);

    // 5. Sync Unsigned Notes (Co-signing)
    await client.query(`
    INSERT INTO inbox_items (
      id, tenant_id, patient_id, type, priority, status, 
      subject, body, reference_id, reference_table, 
      assigned_user_id, created_at, updated_at
    )
    SELECT 
      gen_random_uuid(), $1, patient_id, 'note', 'normal',
      'new',
      'Sign Note: ' || COALESCE(note_type, 'Office Visit'),
      'Visit dated ' || encounter_date,
      id, 'visits',
      provider_id, created_at, created_at
    FROM visits
    WHERE status = 'draft' AND note_signed_at IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM inbox_items 
        WHERE reference_id = visits.id AND reference_table = 'visits'
      )
  `, [tenantId]);

    // 6. Sync Old Messages/Tasks
    await client.query(`
    INSERT INTO inbox_items (
      id, tenant_id, patient_id, type, priority, status, 
      subject, body, reference_id, reference_table, 
      assigned_user_id, created_by, created_at, updated_at,
      completed_at
    )
    SELECT 
      gen_random_uuid(), $1, patient_id, 
      CASE 
        WHEN message_type = 'task' THEN 'task'
        WHEN message_type = 'refill' THEN 'refill'
        ELSE 'message' 
      END,
      COALESCE(priority, 'normal'),
      CASE 
        WHEN task_status = 'completed' THEN 'completed'
        WHEN read_at IS NOT NULL THEN 'read'
        ELSE 'new'
      END,
      subject, body, id, 'messages',
      to_user_id, from_user_id, created_at, created_at,
      CASE WHEN task_status = 'completed' THEN created_at ELSE NULL END
    FROM messages
    WHERE NOT EXISTS (
        SELECT 1 FROM inbox_items 
        WHERE reference_id = messages.id AND reference_table = 'messages'
    )
  `, [tenantId]);

    // 7. Sync Portal Message Threads (Unread threads)
    // CLEANUP: Remove old individual portal message items (migration to threads)
    await client.query(`
        DELETE FROM inbox_items 
        WHERE reference_table = 'portal_messages' 
          AND status != 'completed'
    `);

    // Insert new items for threads that don't have an active item
    await client.query(`
    INSERT INTO inbox_items(
      id, tenant_id, patient_id, type, priority, status,
      subject, body, reference_id, reference_table,
      assigned_user_id, created_at, updated_at
    )
    SELECT
      gen_random_uuid(), $1, t.patient_id, 'portal_message', 'normal', 'new',
      'Portal: ' || t.subject,
      (SELECT body FROM portal_messages WHERE thread_id = t.id AND sender_portal_account_id IS NOT NULL ORDER BY created_at DESC LIMIT 1),
      t.id, 'portal_message_threads',
      COALESCE(t.assigned_user_id, p.primary_care_provider), t.updated_at, t.updated_at
    FROM portal_message_threads t
    JOIN patients p ON t.patient_id = p.id
    WHERE EXISTS (
        SELECT 1 FROM portal_messages m 
        WHERE m.thread_id = t.id 
          AND m.sender_portal_account_id IS NOT NULL 
          AND m.read_at IS NULL
    )
    AND NOT EXISTS(
        SELECT 1 FROM inbox_items 
        WHERE reference_id = t.id AND reference_table = 'portal_message_threads' AND status != 'completed'
    )
    `, [tenantId]);

    // Update existing active items if thread updated
    await client.query(`
    UPDATE inbox_items i
    SET 
        body = sub.latest_body,
        updated_at = sub.thread_updated_at,
        status = 'new'
    FROM (
        SELECT t.id as thread_id, t.updated_at as thread_updated_at,
        (SELECT body FROM portal_messages WHERE thread_id = t.id AND sender_portal_account_id IS NOT NULL ORDER BY created_at DESC LIMIT 1) as latest_body
        FROM portal_message_threads t
        WHERE EXISTS (
             SELECT 1 FROM portal_messages m 
             WHERE m.thread_id = t.id AND m.sender_portal_account_id IS NOT NULL AND m.read_at IS NULL
        )
    ) sub
    WHERE i.reference_id = sub.thread_id 
      AND i.reference_table = 'portal_message_threads'
      AND i.status != 'completed'
      AND i.updated_at < sub.thread_updated_at
    `);

    // 8. Sync Portal Appointment Requests
    await client.query(`
    INSERT INTO inbox_items(
      id, tenant_id, patient_id, type, priority, status,
      subject, body, reference_id, reference_table,
      assigned_user_id, created_at, updated_at
    )
    SELECT
      gen_random_uuid(), $1, p.id, 'portal_appointment', 'normal', 'new',
      'Portal Appt Req: ' || appointment_type,
      'Preferred Date: ' || preferred_date || ' (' || preferred_time_range || ')\nReason: ' || COALESCE(reason, 'N/A'),
      ar.id, 'portal_appointment_requests',
      COALESCE(ar.provider_id, p.primary_care_provider), ar.created_at, ar.created_at
    FROM portal_appointment_requests ar
    JOIN patients p ON ar.patient_id = p.id
    WHERE ar.status = 'pending'
      AND NOT EXISTS(
        SELECT 1 FROM inbox_items 
        WHERE reference_id = ar.id AND reference_table = 'portal_appointment_requests'
      )
    `, [tenantId]);

  } finally {
    client.release();
  }
}

// --- ROUTES ---

// GET / - List items (with sync)
router.get('/', async (req, res) => {
  try {
    const { status = 'new', type, assignedTo } = req.query;
    const tenantId = req.user.tenantId || req.user.tenant_id || null;
    const schema = req.user.schema || req.user.schema_name || 'tenant_sandbox'; // Fallback for safety

    // Trigger sync first - always run since we use schema-based multi-tenancy
    await syncInboxItems(tenantId, schema);

    let query = `
      SELECT i.*,
    u_assigned.first_name as assigned_first_name, u_assigned.last_name as assigned_last_name,
    u_created.first_name as created_by_first_name, u_created.last_name as created_by_last_name
      FROM inbox_items i
      LEFT JOIN users u_assigned ON i.assigned_user_id = u_assigned.id
      LEFT JOIN users u_created ON i.created_by = u_created.id
      WHERE 1 = 1
    `;
    const params = [];
    let paramCount = 0;

    // Filters
    if (status && status !== 'all') {
      if (status === 'completed') {
        paramCount++;
        query += ` AND i.status = $${paramCount} `;
        params.push('completed');
      } else {
        // Default view: everything not completed/archived
        query += ` AND i.status NOT IN('completed', 'archived')`;
      }
    }

    if (type && type !== 'all') {
      paramCount++;
      query += ` AND i.type = $${paramCount} `;
      params.push(type);
    }

    if (assignedTo === 'me') {
      paramCount++;
      query += ` AND i.assigned_user_id = $${paramCount} `;
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
    await ensureSchema();
    const counts = await pool.query(`
      SELECT
        COUNT(*) FILTER(WHERE status NOT IN('completed', 'archived')) as all_count,
        COUNT(*) FILTER(WHERE status NOT IN('completed', 'archived') AND assigned_user_id = $1) as my_count,
        COUNT(*) FILTER(WHERE status NOT IN('completed', 'archived') AND type = 'lab') as labs_count,
        COUNT(*) FILTER(WHERE status NOT IN('completed', 'archived') AND type = 'document') as docs_count,
        COUNT(*) FILTER(WHERE status NOT IN('completed', 'archived') AND type = 'message') as msgs_count,
        COUNT(*) FILTER(WHERE status NOT IN('completed', 'archived') AND type = 'task') as tasks_count,
        COUNT(*) FILTER(WHERE status NOT IN('completed', 'archived') AND type = 'refill') as refills_count,
        COUNT(*) FILTER(WHERE status NOT IN('completed', 'archived') AND type IN ('portal_message', 'portal_appointment')) as portal_count
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

    let notes = notesRes.rows;

    // If it's a thread, fetch thread history and merge (excluding duplicates from internal notes if any)
    // We prioritize portal_messages for the conversation history
    if (item.type === 'portal_message' && item.reference_table === 'portal_message_threads') {
      const threadMsgs = await pool.query(`
            SELECT 
                m.id, 
                m.body as note, 
                m.created_at,
                CASE 
                    WHEN m.sender_type = 'staff' THEN u.first_name 
                    ELSE $2 
                END as first_name,
                CASE 
                    WHEN m.sender_type = 'staff' THEN u.last_name 
                    ELSE $3 
                END as last_name,
                m.sender_type
            FROM portal_messages m
            LEFT JOIN users u ON m.sender_user_id = u.id
            WHERE m.thread_id = $1
            ORDER BY m.created_at ASC
        `, [item.reference_id, item.patient_first_name, item.patient_last_name]);

      // Filter out inbox_notes that are just copies of portal messages to avoid duplication if we were listing them?
      // Actually inbox_notes are internal usually. 
      // If we want to show strict history, we use threadMsgs + internal only notes.
      const internalNotes = notes.filter(n => n.is_internal);

      // Combine and sort
      notes = [...threadMsgs.rows, ...internalNotes].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    }

    res.json({ ...item, notes });
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
      INSERT INTO inbox_items(
      type, subject, body, patient_id, priority, assigned_user_id, created_by, status
    ) VALUES($1, $2, $3, $4, $5, $6, $7, 'new')
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
      updates.push(`status = $${paramCount} `);
      params.push(status);

      if (status === 'completed') {
        updates.push(`completed_at = CURRENT_TIMESTAMP`);
        updates.push(`completed_by = '${req.user.id}'`);
      }
    }

    if (assignedUserId !== undefined) { // Allow null to unassign
      paramCount++;
      updates.push(`assigned_user_id = $${paramCount} `);
      params.push(assignedUserId);
    }

    if (priority) {
      paramCount++;
      updates.push(`priority = $${paramCount} `);
      params.push(priority);
    }

    if (updates.length === 0) return res.json({});

    params.push(id);
    const query = `UPDATE inbox_items SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $${params.length} RETURNING * `;

    const result = await pool.query(query, params);

    // Propagate completion to original orders/docs if applicable
    if (status === 'completed' && result.rows[0].reference_id) {
      const item = result.rows[0];
      if (item.reference_table === 'orders') {
        await pool.query("UPDATE orders SET reviewed = true, reviewed_at = CURRENT_TIMESTAMP, reviewed_by = $1 WHERE id = $2", [req.user.id, item.reference_id]);
      } else if (item.reference_table === 'documents') {
        await pool.query("UPDATE documents SET reviewed = true, reviewed_at = CURRENT_TIMESTAMP, reviewed_by = $1 WHERE id = $2", [req.user.id, item.reference_id]);
      } else if (item.reference_table === 'portal_messages') {
        await pool.query("UPDATE portal_messages SET read_at = CURRENT_TIMESTAMP WHERE id = $1", [item.reference_id]);
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
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { note, isExternal = false } = req.body;

    await client.query('BEGIN');

    const result = await client.query(`
      INSERT INTO inbox_notes(item_id, user_id, user_name, note, is_internal)
      VALUES($1, $2, $3, $4, $5)
      RETURNING *
    `, [id, req.user.id, `${req.user.first_name} ${req.user.last_name}`, note, !isExternal]);

    // If external or a portal message reply, push to portal_messages
    const itemRes = await client.query('SELECT * FROM inbox_items WHERE id = $1', [id]);
    const item = itemRes.rows[0];

    if (item && isExternal && item.type === 'portal_message') {
      let threadId = null;

      if (item.reference_table === 'portal_messages') {
        // Legacy support
        const msgRes = await client.query('SELECT thread_id FROM portal_messages WHERE id = $1', [item.reference_id]);
        if (msgRes.rows.length > 0) threadId = msgRes.rows[0].thread_id;
      } else if (item.reference_table === 'portal_message_threads') {
        // New support
        threadId = item.reference_id;
      }

      if (threadId) {
        await client.query(`
          INSERT INTO portal_messages (thread_id, sender_user_id, sender_id, sender_type, body)
          VALUES ($1, $2, $2, 'staff', $3)
        `, [threadId, req.user.id, note]);

        await client.query(`
          UPDATE portal_message_threads 
          SET last_message_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP 
          WHERE id = $1
        `, [threadId]);

        // Mark messages as read
        await client.query("UPDATE portal_messages SET read_at = CURRENT_TIMESTAMP WHERE thread_id = $1 AND sender_portal_account_id IS NOT NULL", [threadId]);

        // Mark inbox item as read/handled? 
        // Actually, if we reply, we usually keep it open until we click "Done".
        // But we should mark it as "read" so it doesn't look like "new" (bold).
        await client.query("UPDATE inbox_items SET status = 'read', updated_at = CURRENT_TIMESTAMP WHERE id = $1", [id]);
      }
    }

    await client.query('COMMIT');
    res.json(result.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error adding note:', error);
    res.status(500).json({ error: 'Failed' });
  } finally {
    client.release();
  }
});

// POST /:id/approve-appointment - Approve portal appointment request and auto-schedule
router.post('/:id/approve-appointment', async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { providerId, appointmentDate, appointmentTime, duration = 30 } = req.body;

    if (!providerId || !appointmentDate || !appointmentTime) {
      return res.status(400).json({ error: 'Provider, date, and time are required' });
    }

    await client.query('BEGIN');

    // 1. Get the inbox item and verify it's a portal_appointment
    const itemRes = await client.query('SELECT * FROM inbox_items WHERE id = $1', [id]);
    if (itemRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Item not found' });
    }

    const item = itemRes.rows[0];
    if (item.type !== 'portal_appointment' || item.reference_table !== 'portal_appointment_requests') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Item is not an appointment request' });
    }

    // 2. Get the portal_appointment_request for patient_id and appointment_type
    const requestRes = await client.query('SELECT * FROM portal_appointment_requests WHERE id = $1', [item.reference_id]);
    if (requestRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Appointment request not found' });
    }
    const request = requestRes.rows[0];

    // 3. Create the actual appointment
    await client.query(`
      INSERT INTO appointments (patient_id, provider_id, appointment_date, appointment_time, duration, appointment_type, status, created_by, notes)
      VALUES ($1, $2, $3, $4, $5, $6, 'scheduled', $7, $8)
    `, [request.patient_id, providerId, appointmentDate, appointmentTime, duration, request.appointment_type || 'Follow-up', req.user.id, 'Scheduled from portal request: ' + (request.reason || '')]);

    // 4. Update the portal_appointment_request as approved
    await client.query(`
      UPDATE portal_appointment_requests 
      SET status = 'approved', processed_by = $1, processed_at = CURRENT_TIMESTAMP 
      WHERE id = $2
    `, [req.user.id, item.reference_id]);

    // 5. Mark the inbox item as completed
    await client.query(`
      UPDATE inbox_items 
      SET status = 'completed', completed_at = CURRENT_TIMESTAMP, completed_by = $1, updated_at = CURRENT_TIMESTAMP 
      WHERE id = $2
    `, [req.user.id, id]);

    await client.query('COMMIT');
    res.json({ success: true, message: 'Appointment scheduled successfully' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error approving appointment:', error);
    res.status(500).json({ error: 'Failed to approve appointment' });
  } finally {
    client.release();
  }
});

module.exports = router;
