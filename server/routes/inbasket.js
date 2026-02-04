const express = require('express');
const pool = require('../db');
const { authenticate, requireRole, logAudit } = require('../middleware/auth');
const { enrichWithPatientNames, getPatientDisplayName } = require('../services/patientNameUtils');
const emailService = require('../services/emailService');

const router = express.Router();
router.use(authenticate);

// --- HELPER: Sync Logic ---
// Syncs external items (orders, documents) into the inbox_items table
// This ensures we have a unified, real-table representation for everything
// Schema self-healing state
const ensuredSchemas = new Set();

async function ensureSchema(client, schemaName) {
  if (ensuredSchemas.has(schemaName)) return;

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
                completed_by UUID REFERENCES users(id),
                clinic_id UUID,
                visit_method VARCHAR(20) DEFAULT 'office'
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

    // Stable Syncing: Ensure we don't duplicate active items and can use ON CONFLICT
    await db.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_inbox_active_reference 
        ON inbox_items(reference_id, reference_table) 
        WHERE status != 'completed'
    `);

    // 3. Self-healing migration for portal_appointment_requests
    // This ensures that existing schemas get the provider_id column we recently added.
    try {
      await db.query(`
            DO $$ 
            BEGIN 
                IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'portal_appointment_requests') THEN
                    ALTER TABLE portal_appointment_requests ADD COLUMN IF NOT EXISTS provider_id UUID REFERENCES users(id);
                    ALTER TABLE portal_appointment_requests ADD COLUMN IF NOT EXISTS visit_method VARCHAR(20) DEFAULT 'office';
                    ALTER TABLE portal_appointment_requests ADD COLUMN IF NOT EXISTS processed_by UUID REFERENCES users(id);
                    ALTER TABLE portal_appointment_requests ADD COLUMN IF NOT EXISTS processed_at TIMESTAMP WITH TIME ZONE;
                    ALTER TABLE portal_appointment_requests ADD COLUMN IF NOT EXISTS denial_reason TEXT;
                    
                    -- Update status constraint to allow our app statuses
                    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'portal_appointment_requests_status_check') THEN
                        ALTER TABLE portal_appointment_requests DROP CONSTRAINT portal_appointment_requests_status_check;
                    END IF;
                    ALTER TABLE portal_appointment_requests ADD CONSTRAINT portal_appointment_requests_status_check 
                        CHECK (status IN ('pending', 'approved', 'denied', 'cancelled', 'pending_patient', 'confirmed', 'declined'));
                END IF;
                IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'inbox_items') THEN
                    ALTER TABLE inbox_items ADD COLUMN IF NOT EXISTS visit_method VARCHAR(20) DEFAULT 'office';
                    ALTER TABLE inbox_items ADD COLUMN IF NOT EXISTS clinic_id UUID;
                END IF;
                IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'appointments') THEN
                    ALTER TABLE appointments ADD COLUMN IF NOT EXISTS visit_method VARCHAR(20) DEFAULT 'office';
                    ALTER TABLE appointments ADD COLUMN IF NOT EXISTS clinic_id UUID;
                    -- Update appointment type constraint to allow Telehealth Visit
                    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'appointments_appointment_type_check') THEN
                        ALTER TABLE appointments DROP CONSTRAINT appointments_appointment_type_check;
                    END IF;
                    ALTER TABLE appointments ADD CONSTRAINT appointments_appointment_type_check 
                        CHECK (appointment_type IN ('Follow-up', 'New Patient', 'Sick Visit', 'Physical', 'Telehealth Visit', 'Other'));
                END IF;

                -- Add clinic_id to all relevant tables for multi-tenancy consistency
                IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'orders') THEN
                    ALTER TABLE orders ADD COLUMN IF NOT EXISTS clinic_id UUID;
                END IF;
                IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'documents') THEN
                    ALTER TABLE documents ADD COLUMN IF NOT EXISTS clinic_id UUID;
                END IF;
                IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'visits') THEN
                    ALTER TABLE visits ADD COLUMN IF NOT EXISTS clinic_id UUID;
                    -- Also ensure cosignature columns exist for the new workflow
                    ALTER TABLE visits ADD COLUMN IF NOT EXISTS assigned_attending_id UUID REFERENCES users(id);
                    ALTER TABLE visits ADD COLUMN IF NOT EXISTS cosigned_at TIMESTAMP WITH TIME ZONE;
                    ALTER TABLE visits ADD COLUMN IF NOT EXISTS cosigned_by UUID REFERENCES users(id);
                    ALTER TABLE visits ADD COLUMN IF NOT EXISTS attestation_text TEXT;
                    ALTER TABLE visits ADD COLUMN IF NOT EXISTS authorship_model VARCHAR(50);
                END IF;
                IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'portal_appointment_requests') THEN
                    ALTER TABLE portal_appointment_requests ADD COLUMN IF NOT EXISTS clinic_id UUID;
                END IF;
                IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'patients') THEN
                    ALTER TABLE patients ADD COLUMN IF NOT EXISTS clinic_id UUID;
                END IF;
                IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'messages') THEN
                    ALTER TABLE messages ADD COLUMN IF NOT EXISTS clinic_id UUID;
                END IF;
            END $$;
        `);
    } catch (e) {
      console.warn('Self-healing migration failed (visit_method):', e.message);
    }

  } catch (error) {
    console.error('Error ensuring inbasket schema:', error);
    // Don't throw, let the query fail naturally if table doesn't exist, 
    // but at least we tried our best.
  }

  ensuredSchemas.add(schemaName);
}

async function syncInboxItems(tenantId, schema, providedClient = null) {
  const client = providedClient || await pool.connect();
  const shouldRelease = !providedClient;

  try {
    if (schema && !providedClient) {
      // Set the search path strictly to the tenant schema first, then public
      await client.query(`SET search_path TO ${schema}, public`);
    }

    // [MOD] Re-enabling ensureSchema with a run-once cache to prevent deadlocks
    await ensureSchema(client, schema || 'public');

    // 1. Sync Lab Orders
    await client.query(`
    INSERT INTO inbox_items (
      id, tenant_id, patient_id, type, priority, status, 
      subject, body, reference_id, reference_table, 
      created_by, assigned_user_id, clinic_id, created_at, updated_at
    )
    SELECT 
      gen_random_uuid(), $1, patient_id, 'lab', 
      CASE WHEN (order_payload->>'priority') = 'stat' THEN 'stat' ELSE 'normal' END,
      'new',
      COALESCE(order_payload->>'test_name', 'Lab Result'),
      'New lab result ready for review',
      id, 'orders',
      ordered_by, ordered_by, clinic_id, created_at, created_at
    FROM orders 
    WHERE order_type = 'lab' 
      AND (status = 'completed' OR result_value IS NOT NULL)
      AND (reviewed IS NULL OR reviewed = false)
    ON CONFLICT (reference_id, reference_table) WHERE status != 'completed' DO NOTHING
  `, [tenantId]);

    // 2. Sync Imaging Orders
    await client.query(`
    INSERT INTO inbox_items (
      id, tenant_id, patient_id, type, priority, status, 
      subject, body, reference_id, reference_table, 
      created_by, assigned_user_id, clinic_id, created_at, updated_at
    )
    SELECT 
      gen_random_uuid(), $1, patient_id, 'imaging', 'normal',
      'new',
      COALESCE(order_payload->>'study_name', 'Imaging Result'),
      'New imaging result ready for review',
      id, 'orders',
      ordered_by, ordered_by, clinic_id, created_at, created_at
    FROM orders 
    WHERE order_type = 'imaging'
    AND (status = 'completed' OR result_value IS NOT NULL)
    AND (reviewed IS NULL OR reviewed = false)
    ON CONFLICT (reference_id, reference_table) WHERE status != 'completed' DO NOTHING
  `, [tenantId]);

    // 3. Sync Documents (Only if they have a clinical doc_type or are tagged as 'clinical')
    // Background uploads without a type are often administrative noise.
    await client.query(`
    INSERT INTO inbox_items (
      id, tenant_id, patient_id, type, priority, status, 
      subject, body, reference_id, reference_table, 
      created_by, clinic_id, created_at, updated_at
    )
    SELECT 
      gen_random_uuid(), $1, patient_id, 'document', 'normal',
      'new',
      filename,
      COALESCE(doc_type, 'Document Upload'),
      id, 'documents',
      uploader_id, clinic_id, created_at, created_at
    FROM documents
    WHERE (reviewed IS NULL OR reviewed = false)
      AND (doc_type IS NOT NULL AND doc_type NOT IN ('other', 'administrative', 'background_upload'))
    ON CONFLICT (reference_id, reference_table) WHERE status != 'completed' DO NOTHING
  `, [tenantId]);

    // 4. Sync Referrals
    await client.query(`
    INSERT INTO inbox_items (
      id, tenant_id, patient_id, type, priority, status, 
      subject, body, reference_id, reference_table, 
      created_by, clinic_id, created_at, updated_at
    )
    SELECT 
      gen_random_uuid(), $1, patient_id, 'referral', 'normal',
      'new',
      'Referral: ' || COALESCE(recipient_name, recipient_specialty, 'New Referral'),
      reason,
      id, 'referrals',
      created_by, clinic_id, created_at, created_at
    FROM referrals
    WHERE (status IS NULL OR status = 'pending' OR status = 'new')
    ON CONFLICT (reference_id, reference_table) WHERE status != 'completed' DO NOTHING
  `, [tenantId]);

    // 5. [DISABLED] Sync Unsigned/Preliminary Notes (Co-signing)
    // User requested removal: "i dont want to have notifications of tasks already done... Just use documents for efax incoming"
    /*
    await client.query(`
    INSERT INTO inbox_items (
      id, tenant_id, patient_id, type, priority, status, 
      subject, body, reference_id, reference_table, 
      assigned_user_id, clinic_id, created_at, updated_at
    )
    SELECT 
      gen_random_uuid(), $1, patient_id, 
      CASE WHEN status = 'preliminary' THEN 'cosignature_required' ELSE 'note' END,
      'normal',
      'new',
      CASE WHEN status = 'preliminary' THEN 'Cosignature Required: ' || COALESCE(visit_type, 'Office Visit') ELSE 'Sign Note: ' || COALESCE(visit_type, 'Office Visit') END,
      CASE WHEN status = 'preliminary' THEN 'Preliminary note pending review' ELSE 'Visit dated ' || visit_date END,
      id, 'visits',
      CASE WHEN status = 'preliminary' AND assigned_attending_id IS NOT NULL THEN assigned_attending_id ELSE provider_id END, 
      clinic_id, created_at, created_at
    FROM visits
    WHERE (status = 'draft' AND note_signed_at IS NULL) OR status = 'preliminary'
    ON CONFLICT (reference_id, reference_table) WHERE status != 'completed' 
    DO UPDATE SET 
        type = EXCLUDED.type,
        assigned_user_id = EXCLUDED.assigned_user_id,
        clinic_id = EXCLUDED.clinic_id,
        subject = EXCLUDED.subject,
        body = EXCLUDED.body,
        updated_at = CURRENT_TIMESTAMP
    `, [tenantId]);
    */

    // CLEANUP: Remove any existing "Sign Note" or "Cosignature" clutter from the active inbox
    await client.query(`
      DELETE FROM inbox_items 
      WHERE type IN ('note', 'cosignature_required') 
        AND status != 'completed'
    `);

    // 6. Sync Old Messages/Tasks
    await client.query(`
    INSERT INTO inbox_items (
      id, tenant_id, patient_id, type, priority, status, 
      subject, body, reference_id, reference_table, 
      assigned_user_id, created_by, clinic_id, created_at, updated_at,
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
      to_user_id, from_user_id, clinic_id, created_at, created_at,
      CASE WHEN task_status = 'completed' THEN created_at ELSE NULL END
    FROM messages
    WHERE NOT EXISTS (
        SELECT 1 FROM inbox_items i2 
        WHERE i2.reference_id = messages.id AND i2.reference_table = 'messages'
    )
    ON CONFLICT (reference_id, reference_table) WHERE status != 'completed' DO NOTHING
  `, [tenantId]);

    // NEW: Cleanup administrative clutter that might have leaked in or was already there
    // This removes standard registration logs and administrative documents from the main list by marking them completed
    await client.query(`
      UPDATE inbox_items
      SET status = 'completed', updated_at = CURRENT_TIMESTAMP
      WHERE (
        (type = 'document' AND body IN ('other', 'profile_photo', 'background_upload', 'administrative'))
        OR type = 'new_patient_registration'
      )
      AND status = 'new'
    `);

    // 7. Sync Portal Message Threads (Grouped by Patient - "Closed Loop")
    // FIRST: Cleanup any pre-existing duplicates (one item per patient for portal messages)
    await client.query(`
      DELETE FROM inbox_items a
      USING inbox_items b
      WHERE a.type = 'portal_message' 
        AND b.type = 'portal_message'
        AND a.patient_id = b.patient_id
        AND a.status != 'completed'
        AND b.status != 'completed'
        AND a.created_at < b.created_at
    `);

    // UPDATE existing active items with latest message across ALL patient threads
    await client.query(`
      UPDATE inbox_items
      SET 
        body = sub.latest_body,
        subject = sub.latest_subject,
        updated_at = sub.latest_at,
        reference_id = sub.latest_thread_id,
        status = 'new'
      FROM (
        SELECT 
          t.patient_id,
          MAX(t.updated_at) as latest_at,
          (
            SELECT t4.subject 
            FROM portal_message_threads t4 
            WHERE t4.patient_id = t.patient_id 
            ORDER BY t4.updated_at DESC LIMIT 1
          ) as latest_subject,
          (
            SELECT m.body 
            FROM portal_messages m 
            JOIN portal_message_threads t2 ON m.thread_id = t2.id 
            WHERE t2.patient_id = t.patient_id 
              AND m.sender_portal_account_id IS NOT NULL 
            ORDER BY m.created_at DESC LIMIT 1
          ) as latest_body,
          (
            SELECT t3.id 
            FROM portal_message_threads t3 
            WHERE t3.patient_id = t.patient_id 
            ORDER BY t3.updated_at DESC LIMIT 1
          ) as latest_thread_id
        FROM portal_message_threads t
        WHERE EXISTS (
            SELECT 1 FROM portal_messages m 
            WHERE m.thread_id = t.id 
              AND m.sender_portal_account_id IS NOT NULL 
              AND m.read_at IS NULL
        )
        GROUP BY t.patient_id
      ) sub
      WHERE inbox_items.patient_id = sub.patient_id 
        AND inbox_items.type = 'portal_message'
        AND inbox_items.status != 'completed'
        AND (inbox_items.status != 'archived' OR sub.latest_at > inbox_items.updated_at)
    `);

    // INSERT new items for patients who don't have an active portal_message item yet
    await client.query(`
    INSERT INTO inbox_items(
      tenant_id, patient_id, type, priority, status,
      subject, body, reference_id, reference_table,
      assigned_user_id, created_at, updated_at
    )
    SELECT DISTINCT ON (t.patient_id)
      $1, t.patient_id, 
      'portal_message',
      'normal', 'new',
      (SELECT subject FROM portal_message_threads t4 WHERE t4.patient_id = t.patient_id ORDER BY t4.updated_at DESC LIMIT 1),
      (SELECT body FROM portal_messages m2 JOIN portal_message_threads t2 ON m2.thread_id = t2.id WHERE t2.patient_id = t.patient_id AND m2.sender_portal_account_id IS NOT NULL ORDER BY m2.created_at DESC LIMIT 1),
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
    AND NOT EXISTS (
        SELECT 1 FROM inbox_items i2 
        WHERE i2.patient_id = t.patient_id 
          AND i2.type = 'portal_message'
          AND i2.status != 'completed'
    )
    ORDER BY t.patient_id, t.updated_at DESC
    `, [tenantId]);

    // CLEANUP: If a thread no longer has unread messages, we don't necessarily delete it 
    // unless we want it to DISAPPEAR from In-Basket. Usually, we keep it as 'read' 
    // until someone marks it 'completed'.


    // 8. [DISABLED] Sync Portal Appointment Requests
    // Handled in a separate dedicated module now, not in the general inbox.
    /*
    await client.query(`
    INSERT INTO inbox_items(
      id, tenant_id, patient_id, type, priority, status,
      subject, body, reference_id, reference_table,
      assigned_user_id, clinic_id, created_at, updated_at, visit_method
    )
    SELECT
      gen_random_uuid(), $1, p.id, 'portal_appointment', 
      CASE WHEN ar.status = 'declined' THEN 'high' ELSE 'normal' END, 
      'new',
      CASE WHEN ar.status = 'declined' THEN 'DECLINED SUGGESTIONS: ' || appointment_type ELSE 'Portal Appt Req: ' || appointment_type END,
      'Preferred Date: ' || preferred_date || ' (' || preferred_time_range || ')\nReason: ' || COALESCE(reason, 'N/A'),
      ar.id, 'portal_appointment_requests',
      COALESCE(ar.provider_id, p.primary_care_provider), ar.clinic_id, ar.created_at, ar.created_at, ar.visit_method
    FROM portal_appointment_requests ar
    JOIN patients p ON ar.patient_id = p.id
    WHERE ar.status IN ('pending', 'declined')
    ON CONFLICT (reference_id, reference_table) WHERE status != 'completed' 
    DO UPDATE SET 
        priority = EXCLUDED.priority,
        subject = EXCLUDED.subject,
        visit_method = EXCLUDED.visit_method, 
        updated_at = CURRENT_TIMESTAMP,
        status = 'new' -- Re-open if it was archived/read but now declined
    `, [tenantId]);
    */

    // CLEANUP: Remove any existing Portal Appointments from the inbox table 
    // to avoid confusing the "Total" count
    await client.query(`
      DELETE FROM inbox_items 
      WHERE type = 'portal_appointment' 
        AND status != 'completed'
    `);

  } finally {
    if (shouldRelease) {
      client.release();
    }
  }
}

// --- ROUTES ---

// GET / - List items (with sync)
router.get('/', async (req, res) => {
  try {
    const { status = 'new', type, assignedTo } = req.query;
    const tenantId = req.clinic?.id || null;
    const schema = req.clinic?.schema_name || 'public';
    const client = req.dbClient || pool;

    // Trigger sync first - always run since we use schema-based multi-tenancy
    await syncInboxItems(tenantId, schema, req.dbClient);

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
      } else if (status === 'archived') {
        paramCount++;
        query += ` AND i.status = $${paramCount} `;
        params.push('archived');
      } else if (status === 'new' || status === 'read') {
        paramCount++;
        query += ` AND i.status = $${paramCount} `;
        params.push(status);
      } else {
        // Default active view: everything not completed/archived
        query += ` AND i.status NOT IN('completed', 'archived')`;
      }
    } else {
      // Default: everything not completed/archived
      query += ` AND i.status NOT IN('completed', 'archived')`;
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
    const tenantId = req.clinic?.id || null;
    const schema = req.clinic?.schema_name || 'public';
    const client = req.dbClient || pool;

    await syncInboxItems(tenantId, schema, req.dbClient);

    const counts = await client.query(`
      SELECT
        COUNT(*) FILTER(WHERE status NOT IN ('completed', 'archived')) as all_count,
        COUNT(*) FILTER(WHERE status NOT IN ('completed', 'archived') AND assigned_user_id = $1) as my_count,
        COUNT(*) FILTER(WHERE status NOT IN ('completed', 'archived') AND type = 'lab') as labs_count,
        COUNT(*) FILTER(WHERE status NOT IN ('completed', 'archived') AND type = 'imaging') as imaging_count,
        COUNT(*) FILTER(WHERE status NOT IN ('completed', 'archived') AND type = 'document') as docs_count,
        COUNT(*) FILTER(WHERE status NOT IN ('completed', 'archived') AND type = 'message') as msgs_count,
        COUNT(*) FILTER(WHERE status NOT IN ('completed', 'archived') AND type = 'task') as tasks_count,
        COUNT(*) FILTER(WHERE status NOT IN ('completed', 'archived') AND type = 'refill') as refills_count,
        COUNT(*) FILTER(WHERE status NOT IN ('completed', 'archived') AND type = 'portal_message') as portal_count
      FROM inbox_items
    `, [req.user.id]);

    res.json(counts.rows[0]);
  } catch (error) {
    console.error('Error fetching stats:', error.message, error.stack);
    res.status(500).json({ error: 'Failed to fetch inbasket statistics', details: error.message });
  }
});

// GET /:id - Details with threading
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const client = req.dbClient || pool;

    // 1. Get Item
    const itemRes = await client.query(`
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

    // If it's a portal message, fetch ALL message history for this patient across all threads
    if (item.type === 'portal_message') {
      const threadMsgs = await client.query(`
            SELECT 
                m.id, 
                m.body as note, 
                m.created_at,
                t.subject as thread_subject,
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
            JOIN portal_message_threads t ON m.thread_id = t.id
            LEFT JOIN users u ON m.sender_user_id = u.id
            WHERE t.patient_id = $1
            ORDER BY m.created_at ASC
        `, [item.patient_id, item.patient_first_name, item.patient_last_name]);

      const internalNotes = notes.filter(n => n.is_internal);
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
    const client = req.dbClient || pool;

    const result = await client.query(`
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
    const client = req.dbClient || pool;

    const result = await client.query(query, params);

    // Propagate completion to original orders/docs if applicable
    if (status === 'completed' && result.rows[0].reference_id) {
      const item = result.rows[0];
      if (item.reference_table === 'orders') {
        await client.query("UPDATE orders SET reviewed = true, reviewed_at = CURRENT_TIMESTAMP, reviewed_by = $1 WHERE id = $2", [req.user.id, item.reference_id]);
      } else if (item.reference_table === 'documents') {
        await client.query("UPDATE documents SET reviewed = true, reviewed_at = CURRENT_TIMESTAMP, reviewed_by = $1 WHERE id = $2", [req.user.id, item.reference_id]);
      } else if (item.reference_table === 'portal_messages') {
        await client.query("UPDATE portal_messages SET read_at = CURRENT_TIMESTAMP WHERE id = $1", [item.reference_id]);
      } else if (item.reference_table === 'portal_message_threads') {
        await client.query("UPDATE portal_messages SET read_at = CURRENT_TIMESTAMP WHERE thread_id = $1 AND sender_portal_account_id IS NOT NULL AND read_at IS NULL", [item.reference_id]);
      }
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating item:', error);
    res.status(500).json({ error: 'Failed' });
  }
});

// DELETE /:id - Delete/Archive an item (Soft Delete for Audit)
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Commercial Grade: Soft Delete (Archive) instead of permanent removal
    // This preserves the record for audit purposes
    const client = req.dbClient || pool;
    await client.query("UPDATE inbox_items SET status = 'archived', updated_at = CURRENT_TIMESTAMP WHERE id = $1", [id]);

    // Audit Log
    try {
      await logAudit(req.user.id, 'inbox.delete', 'inbox_item', id, {
        action: 'archive',
        reason: 'User archived conversation',
        timestamp: new Date().toISOString()
      }, req.ip);
    } catch (auditErr) {
      console.warn('Failed to log audit for inbox delete:', auditErr);
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting item:', error);
    res.status(500).json({ error: 'Failed to delete item' });
  }
});

// POST /:id/notes - Add note/reply
router.post('/:id/notes', async (req, res) => {
  const client = req.dbClient || pool;
  const isDedicatedClient = req.dbClient ? true : false;
  try {
    const { id } = req.params;
    const { note, isExternal = false } = req.body;

    await client.query('BEGIN');

    // Check if item exists first
    const itemRes = await client.query('SELECT * FROM inbox_items WHERE id = $1', [id]);
    const item = itemRes.rows[0];

    if (!item) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Item not found' });
    }

    const result = await client.query(`
      INSERT INTO inbox_notes(item_id, user_id, user_name, note, is_internal)
      VALUES($1, $2, $3, $4, $5)
      RETURNING *
    `, [id, req.user.id, `${req.user.first_name || ''} ${req.user.last_name || ''}`.trim() || req.user.email, note, !isExternal]);

    // If external or a portal message reply, push to portal_messages
    if (isExternal && (item.type === 'portal_message' || item.type === 'portal_appointment')) {
      let threadId = null;

      if (item.type === 'portal_message') {
        if (item.reference_table === 'portal_messages') {
          // Legacy support
          const msgRes = await client.query('SELECT thread_id FROM portal_messages WHERE id = $1', [item.reference_id]);
          if (msgRes.rows.length > 0) threadId = msgRes.rows[0].thread_id;
        } else if (item.reference_table === 'portal_message_threads') {
          // New support
          threadId = item.reference_id;
        }

        // Validate thread exists
        if (threadId) {
          const threadCheck = await client.query('SELECT id FROM portal_message_threads WHERE id = $1', [threadId]);
          if (threadCheck.rows.length === 0) {
            console.warn(`Thread ${threadId} not found for inbox item ${id}. Skipping portal sync.`);
            threadId = null; // Prevent FK violation
          }
        }
      } else if (item.type === 'portal_appointment') {
        // Find or create an appointment thread for this patient
        const existingThread = await client.query(
          "SELECT id FROM portal_message_threads WHERE patient_id = $1 AND subject ILIKE 'Appointment Support%' ORDER BY created_at DESC LIMIT 1",
          [item.patient_id]
        );

        if (existingThread.rows.length > 0) {
          threadId = existingThread.rows[0].id;
        } else {
          const newThread = await client.query(`
            INSERT INTO portal_message_threads (patient_id, subject, last_message_at, updated_at)
            VALUES ($1, $2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            RETURNING id
          `, [item.patient_id, 'Appointment Support: ' + (item.subject || 'Visit Request')]);
          threadId = newThread.rows[0].id;
        }
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

        // Mark inbox item as read/handled
        await client.query("UPDATE inbox_items SET status = 'read', updated_at = CURRENT_TIMESTAMP WHERE id = $1", [id]);

        // Trigger Email Notification (non-blocking)
        try {
          const patientRes = await client.query('SELECT first_name, last_name, email FROM patients WHERE id = $1', [item.patient_id]);
          const p = patientRes.rows[0];
          if (p && p.email) {
            emailService.sendNewMessageNotification(p.email, `${p.first_name} ${p.last_name}`);
          }
        } catch (emailErr) {
          console.warn('Failed to send portal message notification email:', emailErr);
        }
      }
    } else if (item && item.status === 'new') {
      // Mark as read even for internal notes
      await client.query("UPDATE inbox_items SET status = 'read', updated_at = CURRENT_TIMESTAMP WHERE id = $1", [id]);
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
  const client = req.dbClient || pool;
  const isDedicatedClient = req.dbClient ? true : false;
  try {
    const { id } = req.params;
    const { providerId, appointmentDate, appointmentTime, duration = 30, visitMethod } = req.body;

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
      INSERT INTO appointments (patient_id, provider_id, appointment_date, appointment_time, duration, appointment_type, status, created_by, notes, visit_method)
      VALUES ($1, $2, $3, $4, $5, $6, 'scheduled', $7, $8, $9)
    `, [request.patient_id, providerId, appointmentDate, appointmentTime, duration, (visitMethod === 'telehealth' ? 'Telehealth Visit' : (request.appointment_type || 'Follow-up')), req.user.id, 'Scheduled from portal request: ' + (request.reason || ''), visitMethod || request.visit_method || 'office']);

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
    if (client.query) await client.query('ROLLBACK');
    console.error('Error approving appointment:', error);
    res.status(500).json({ error: 'Failed to approve appointment' });
  } finally {
    if (!isDedicatedClient && client.release) {
      client.release();
    }
  }
});

// POST /:id/deny-appointment - Deny portal appointment request
router.post('/:id/deny-appointment', async (req, res) => {
  const client = req.dbClient || pool;
  const isDedicatedClient = req.dbClient ? true : false;
  try {
    const { id } = req.params;
    const { reason } = req.body;

    await client.query('BEGIN');

    // Get the inbox item
    const itemRes = await client.query('SELECT * FROM inbox_items WHERE id = $1', [id]);
    if (itemRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Item not found' });
    }

    const item = itemRes.rows[0];

    // Update the portal_appointment_request as denied
    let patientEmail = null;
    let patientName = null;
    let preferredDate = null;

    if (item.reference_table === 'portal_appointment_requests') {
      // Get patient info for notification
      const requestInfo = await client.query(`
        SELECT r.preferred_date, p.first_name, p.last_name, ppa.email
        FROM portal_appointment_requests r
        JOIN patients p ON r.patient_id = p.id
        JOIN patient_portal_accounts ppa ON r.portal_account_id = ppa.id
        WHERE r.id = $1
      `, [item.reference_id]);

      if (requestInfo.rows.length > 0) {
        patientEmail = requestInfo.rows[0].email;
        patientName = `${requestInfo.rows[0].first_name} ${requestInfo.rows[0].last_name}`;
        preferredDate = requestInfo.rows[0].preferred_date;
      }

      await client.query(`
        UPDATE portal_appointment_requests 
        SET status = 'denied', processed_by = $1, processed_at = CURRENT_TIMESTAMP, denial_reason = $3
        WHERE id = $2
      `, [req.user.id, item.reference_id, reason || null]);
    }

    // Mark the inbox item as completed
    await client.query(`
      UPDATE inbox_items 
      SET status = 'completed', completed_at = CURRENT_TIMESTAMP, completed_by = $1, updated_at = CURRENT_TIMESTAMP 
      WHERE id = $2
    `, [req.user.id, id]);

    await client.query('COMMIT');

    // Send email notification to patient (after commit so we don't block on email)
    if (patientEmail) {
      try {
        const clinicName = req.clinic?.display_name || 'Your Healthcare Provider';
        const formattedDate = preferredDate ? new Date(preferredDate).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : 'your requested date';

        await emailService._send(
          patientEmail,
          `Appointment Request Update - ${clinicName}`,
          `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #1e40af;">Appointment Request Update</h2>
              <p>Dear ${patientName},</p>
              <p>We regret to inform you that your appointment request for <strong>${formattedDate}</strong> could not be accommodated at this time.</p>
              ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ''}
              <p>Please log in to your patient portal to request an alternative appointment time, or contact our office directly.</p>
              <p style="margin-top: 30px;">Thank you for your understanding,<br><strong>${clinicName}</strong></p>
            </div>
          `
        );
        console.log(`[Inbasket] Denial notification sent to ${patientEmail}`);
      } catch (emailErr) {
        console.warn('[Inbasket] Failed to send denial email:', emailErr.message);
      }
    }
    res.json({ success: true, message: 'Appointment request denied' });
  } catch (error) {
    if (client.query) await client.query('ROLLBACK');
    console.error('Error denying appointment:', error);
    res.status(500).json({ error: 'Failed to deny appointment' });
  } finally {
    if (!isDedicatedClient && client.release) {
      client.release();
    }
  }
});

// POST /:id/suggest-slots - Send alternative time slots to patient (stored on request, not via messages)
router.post('/:id/suggest-slots', async (req, res) => {
  const client = req.dbClient || pool;
  const isDedicatedClient = req.dbClient ? true : false;
  try {
    const { id } = req.params;
    const { slots } = req.body; // Array of {date, time}

    if (!slots || slots.length === 0) {
      return res.status(400).json({ error: 'At least one slot is required' });
    }

    await client.query('BEGIN');

    // Get the inbox item
    const itemRes = await client.query('SELECT * FROM inbox_items WHERE id = $1', [id]);
    if (itemRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Item not found' });
    }

    const item = itemRes.rows[0];

    // Store suggested slots on the portal_appointment_request
    if (item.reference_table === 'portal_appointment_requests') {
      await client.query(`
        UPDATE portal_appointment_requests 
        SET suggested_slots = $1, status = 'pending_patient'
        WHERE id = $2
      `, [JSON.stringify(slots), item.reference_id]);
    }

    // Mark inbox as pending patient (not completed - waiting for response)
    await client.query(`
      UPDATE inbox_items 
      SET status = 'pending_patient', updated_at = CURRENT_TIMESTAMP 
      WHERE id = $1
    `, [id]);

    await client.query('COMMIT');
    res.json({ success: true, message: 'Slots sent to patient' });
  } catch (error) {
    if (client.query) await client.query('ROLLBACK');
    console.error('Error suggesting slots:', error);
    res.status(500).json({ error: 'Failed to suggest slots' });
  } finally {
    if (!isDedicatedClient && client.release) {
      client.release();
    }
  }
});

// POST /patient-message - Initiate a new message to a patient
router.post('/patient-message', async (req, res) => {
  const client = req.dbClient || pool;
  const isDedicatedClient = req.dbClient ? true : false;
  try {
    const { patientId, subject, body } = req.body;

    if (!patientId || !body) {
      return res.status(400).json({ error: 'Patient and message body are required' });
    }

    await client.query('BEGIN');

    // 1. Find or create a thread for this patient
    // We try to find a thread with the same subject, or create a new one
    let threadId;
    let isNewThread = false;
    const existingThread = await client.query(
      "SELECT id FROM portal_message_threads WHERE patient_id = $1 AND subject = $2 AND archived = false LIMIT 1",
      [patientId, subject || 'General Inquiry']
    );

    if (existingThread.rows.length > 0) {
      threadId = existingThread.rows[0].id;
    } else {
      const newThread = await client.query(
        "INSERT INTO portal_message_threads (patient_id, subject, last_message_at, updated_at) VALUES ($1, $2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) RETURNING id",
        [patientId, subject || 'General Inquiry']
      );
      threadId = newThread.rows[0].id;
      isNewThread = true;
    }

    // 2. Insert the message
    await client.query(
      "INSERT INTO portal_messages (thread_id, sender_user_id, sender_id, sender_type, body) VALUES ($1, $2, $2, 'staff', $3)",
      [threadId, req.user.id, body]
    );

    // 3. Update thread timestamp
    await client.query(
      "UPDATE portal_message_threads SET last_message_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = $1",
      [threadId]
    );

    // 4. Create or update an inbox item so staff can see the thread in Portal Messages
    // Look for existing active inbox item for this patient's portal messages
    const existingInboxItem = await client.query(
      "SELECT id FROM inbox_items WHERE patient_id = $1 AND type = 'portal_message' AND status != 'completed' LIMIT 1",
      [patientId]
    );

    let inboxItemId;
    if (existingInboxItem.rows.length > 0) {
      inboxItemId = existingInboxItem.rows[0].id;
      // Update the existing inbox item with new message info (mark as 'read' since staff initiated)
      await client.query(`
        UPDATE inbox_items 
        SET subject = $1, body = $2, reference_id = $3, updated_at = CURRENT_TIMESTAMP, status = 'read'
        WHERE id = $4
      `, [subject || 'General Inquiry', body, threadId, inboxItemId]);
    } else {
      // Create a new inbox item (with status 'read' since it's staff-initiated, not awaiting action)
      const newItem = await client.query(`
        INSERT INTO inbox_items (
          patient_id, type, priority, status, subject, body, 
          reference_id, reference_table, created_by, assigned_user_id
        ) VALUES ($1, 'portal_message', 'normal', 'read', $2, $3, $4, 'portal_message_threads', $5, $5)
        RETURNING id
      `, [patientId, subject || 'General Inquiry', body, threadId, req.user.id]);
      inboxItemId = newItem.rows[0].id;
    }

    // Fetch the full inbox item to return to frontend
    const fullItem = await client.query(`
        SELECT i.*, p.first_name as patient_first_name, p.last_name as patient_last_name, p.dob as patient_dob, p.mrn
        FROM inbox_items i
        JOIN patients p ON i.patient_id = p.id
        WHERE i.id = $1
    `, [inboxItemId]);

    await client.query('COMMIT');

    // Trigger Email Notification (non-blocking)
    try {
      const patientRes = await client.query('SELECT first_name, last_name, email FROM patients WHERE id = $1', [patientId]);
      const p = patientRes.rows[0];
      if (p && p.email) {
        emailService.sendNewMessageNotification(p.email, `${p.first_name} ${p.last_name}`);
      }
    } catch (emailErr) {
      console.warn('Failed to send portal message notification email:', emailErr);
    }
    res.json({ success: true, item: fullItem.rows[0], threadId });
  } catch (error) {
    if (client.query) await client.query('ROLLBACK');
    console.error('Error initiating patient message:', error);
    res.status(500).json({ error: 'Failed to send message' });
  } finally {
    if (!isDedicatedClient && client.release) {
      client.release();
    }
  }
});

module.exports = { router, syncInboxItems };
