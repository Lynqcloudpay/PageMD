const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

// Get all macros
router.get('/', async (req, res) => {
    try {
        const { category, traineeRole } = req.query;
        let query = 'SELECT * FROM macros WHERE (user_id = $1 OR user_id IS NULL)';
        const params = [req.user.id];

        if (category) {
            params.push(category);
            query += ` AND category = $${params.length}`;
        }

        if (traineeRole) {
            // For attestations, we might filter by the trainee's role
            // e.g. "I have reviewed the Resident's note..."
            // For now, simple category filtering is enough as the data includes trainee role in the name
        }

        const result = await pool.query(query + ' ORDER BY name ASC', params);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching macros:', error);
        res.status(500).json({ error: 'Failed to fetch macros' });
    }
});

// Update macro
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { name, content, category } = req.body;

        const result = await pool.query(
            'UPDATE macros SET name = $1, content = $2, category = $3, updated_at = NOW() WHERE id = $4 AND user_id = $5 RETURNING *',
            [name, content, category, id, req.user.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Macro not found or unauthorized' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error updating macro:', error);
        res.status(500).json({ error: 'Failed to update macro' });
    }
});

router.post('/', async (req, res) => {
    try {
        console.log('[Macros] Request received');
        console.log('[Macros] User:', { id: req.user?.id, email: req.user?.email });
        console.log('[Macros] Body:', req.body);

        const { name, content, category } = req.body;

        if (!req.user || !req.user.id) {
            console.error('[Macros] Missing user ID');
            return res.status(401).json({ error: 'User not authenticated' });
        }

        const result = await pool.query(
            'INSERT INTO macros (name, content, category, user_id) VALUES ($1, $2, $3, $4) RETURNING *',
            [name, content, category, req.user.id]
        );

        console.log('[Macros] Insert successful:', result.rows[0].id);
        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('[Macros] Error creating macro:', error);
        console.error('[Macros] Stack trace:', error.stack);
        res.status(500).json({
            error: 'Failed to create macro',
            details: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

// Delete macro
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const result = await pool.query(
            'DELETE FROM macros WHERE id = $1 AND user_id = $2 RETURNING *',
            [id, req.user.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Macro not found or unauthorized' });
        }

        res.json({ message: 'Macro deleted successfully' });
    } catch (error) {
        console.error('Error deleting macro:', error);
        res.status(500).json({ error: 'Failed to delete macro' });
    }
});

module.exports = router;
