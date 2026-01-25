/**
 * Clinical Tasks API Routes
 * Handles task creation, assignment, and status management
 */

const express = require('express');
const pool = require('../db');
const { authenticate } = require('../middleware/auth');
const { enrichWithPatientNames } = require('../services/patientNameUtils');

const router = express.Router();
router.use(authenticate);

// Task Categories
const TASK_CATEGORIES = [
    'follow_up',
    'call_patient',
    'schedule',
    'documentation',
    'lab_review',
    'referral',
    'prior_auth',
    'other'
];

// GET /tasks - List tasks with filters
router.get('/', async (req, res) => {
    try {
        const {
            assigned_to,
            assigned_by,
            status = 'open',
            category,
            patient_id,
            include_completed = false
        } = req.query;

        let query = `
      SELECT 
        t.*,
        u_to.first_name as assigned_to_first_name,
        u_to.last_name as assigned_to_last_name,
        u_by.first_name as assigned_by_first_name,
        u_by.last_name as assigned_by_last_name,
        p.first_name as patient_first_name,
        p.last_name as patient_last_name,
        p.mrn as patient_mrn
      FROM clinical_tasks t
      LEFT JOIN users u_to ON t.assigned_to = u_to.id
      LEFT JOIN users u_by ON t.assigned_by = u_by.id
      LEFT JOIN patients p ON t.patient_id = p.id
      WHERE 1=1
    `;

        const params = [];
        let paramCount = 0;

        // Filter by assignment
        if (assigned_to === 'me') {
            paramCount++;
            query += ` AND t.assigned_to = $${paramCount}`;
            params.push(req.user.id);
        } else if (assigned_to) {
            paramCount++;
            query += ` AND t.assigned_to = $${paramCount}`;
            params.push(assigned_to);
        }

        if (assigned_by === 'me') {
            paramCount++;
            query += ` AND t.assigned_by = $${paramCount}`;
            params.push(req.user.id);
        } else if (assigned_by) {
            paramCount++;
            query += ` AND t.assigned_by = $${paramCount}`;
            params.push(assigned_by);
        }

        // Filter by status
        if (status && status !== 'all') {
            paramCount++;
            query += ` AND t.status = $${paramCount}`;
            params.push(status);
        } else if (!include_completed) {
            query += ` AND t.status NOT IN ('completed', 'cancelled')`;
        }

        // Filter by category
        if (category && category !== 'all') {
            paramCount++;
            query += ` AND t.category = $${paramCount}`;
            params.push(category);
        }

        // Filter by patient
        if (patient_id) {
            paramCount++;
            query += ` AND t.patient_id = $${paramCount}`;
            params.push(patient_id);
        }

        // Order by priority and due date
        query += ` ORDER BY 
      CASE t.priority 
        WHEN 'stat' THEN 1 
        WHEN 'urgent' THEN 2 
        ELSE 3 
      END,
      t.due_date ASC NULLS LAST,
      t.created_at DESC
      LIMIT 200
    `;

        const result = await pool.query(query, params);

        // Enrich with decrypted patient names
        const enriched = await enrichWithPatientNames(result.rows, 'patient_id');

        res.json(enriched);
    } catch (error) {
        console.error('Error fetching tasks:', error);
        res.status(500).json({ error: 'Failed to fetch tasks' });
    }
});

// GET /tasks/stats - Get task statistics
router.get('/stats', async (req, res) => {
    try {
        const userId = req.user.id;

        const stats = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'open' AND assigned_to = $1) as my_open,
        COUNT(*) FILTER (WHERE status = 'open' AND assigned_by = $1) as assigned_by_me,
        COUNT(*) FILTER (WHERE status = 'open' AND priority IN ('stat', 'urgent') AND assigned_to = $1) as urgent,
        COUNT(*) FILTER (WHERE status = 'open' AND due_date < CURRENT_TIMESTAMP AND assigned_to = $1) as overdue,
        COUNT(*) FILTER (WHERE status = 'completed' AND completed_at > CURRENT_DATE - INTERVAL '7 days' AND assigned_to = $1) as completed_week
      FROM clinical_tasks
    `, [userId]);

        res.json(stats.rows[0] || {});
    } catch (error) {
        console.error('Error fetching task stats:', error);
        res.status(500).json({ error: 'Failed to fetch stats' });
    }
});

// GET /tasks/:id - Get single task
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const result = await pool.query(`
      SELECT 
        t.*,
        u_to.first_name as assigned_to_first_name,
        u_to.last_name as assigned_to_last_name,
        u_by.first_name as assigned_by_first_name,
        u_by.last_name as assigned_by_last_name,
        p.first_name as patient_first_name,
        p.last_name as patient_last_name,
        p.mrn as patient_mrn,
        p.dob as patient_dob
      FROM clinical_tasks t
      LEFT JOIN users u_to ON t.assigned_to = u_to.id
      LEFT JOIN users u_by ON t.assigned_by = u_by.id
      LEFT JOIN patients p ON t.patient_id = p.id
      WHERE t.id = $1
    `, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Task not found' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error fetching task:', error);
        res.status(500).json({ error: 'Failed to fetch task' });
    }
});

// POST /tasks - Create new task
router.post('/', async (req, res) => {
    try {
        const {
            title,
            description,
            patient_id,
            assigned_to,
            category = 'other',
            priority = 'routine',
            due_date,
            source_inbox_item_id
        } = req.body;

        if (!title || !assigned_to) {
            return res.status(400).json({ error: 'Title and assigned_to are required' });
        }

        const result = await pool.query(`
      INSERT INTO clinical_tasks 
        (title, description, patient_id, assigned_to, assigned_by, category, priority, due_date, source_inbox_item_id)
      VALUES 
        ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `, [title, description, patient_id, assigned_to, req.user.id, category, priority, due_date, source_inbox_item_id]);

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Error creating task:', error);
        res.status(500).json({ error: 'Failed to create task' });
    }
});

// PUT /tasks/:id - Update task
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { title, description, assigned_to, category, priority, due_date, status, notes } = req.body;

        const updates = [];
        const params = [];
        let paramCount = 0;

        if (title !== undefined) {
            paramCount++;
            updates.push(`title = $${paramCount}`);
            params.push(title);
        }
        if (description !== undefined) {
            paramCount++;
            updates.push(`description = $${paramCount}`);
            params.push(description);
        }
        if (assigned_to !== undefined) {
            paramCount++;
            updates.push(`assigned_to = $${paramCount}`);
            params.push(assigned_to);
        }
        if (category !== undefined) {
            paramCount++;
            updates.push(`category = $${paramCount}`);
            params.push(category);
        }
        if (priority !== undefined) {
            paramCount++;
            updates.push(`priority = $${paramCount}`);
            params.push(priority);
        }
        if (due_date !== undefined) {
            paramCount++;
            updates.push(`due_date = $${paramCount}`);
            params.push(due_date);
        }
        if (status !== undefined) {
            paramCount++;
            updates.push(`status = $${paramCount}`);
            params.push(status);

            // If completing, set completion fields
            if (status === 'completed') {
                updates.push(`completed_at = CURRENT_TIMESTAMP`);
                paramCount++;
                updates.push(`completed_by = $${paramCount}`);
                params.push(req.user.id);
            }
        }
        if (notes !== undefined) {
            paramCount++;
            updates.push(`notes = $${paramCount}`);
            params.push(notes);
        }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'No fields to update' });
        }

        paramCount++;
        params.push(id);

        const result = await pool.query(`
      UPDATE clinical_tasks 
      SET ${updates.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `, params);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Task not found' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error updating task:', error);
        res.status(500).json({ error: 'Failed to update task' });
    }
});

// PUT /tasks/:id/complete - Quick complete action
router.put('/:id/complete', async (req, res) => {
    try {
        const { id } = req.params;
        const { notes } = req.body;

        const result = await pool.query(`
      UPDATE clinical_tasks 
      SET status = 'completed', completed_at = CURRENT_TIMESTAMP, completed_by = $1, notes = COALESCE($2, notes)
      WHERE id = $3
      RETURNING *
    `, [req.user.id, notes, id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Task not found' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error completing task:', error);
        res.status(500).json({ error: 'Failed to complete task' });
    }
});

// DELETE /tasks/:id - Soft delete (archive)
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const result = await pool.query(`
      UPDATE clinical_tasks 
      SET status = 'cancelled'
      WHERE id = $1
      RETURNING id
    `, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Task not found' });
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting task:', error);
        res.status(500).json({ error: 'Failed to delete task' });
    }
});

module.exports = router;
