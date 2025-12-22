const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authenticate } = require('../middleware/auth');

// 1. Search Orders Catalog
// GET /api/orders/search?q=...&type=LAB&limit=20
router.get('/search', authenticate, async (req, res) => {
    try {
        const { q, type, limit = 20 } = req.query;
        if (!q || q.trim().length < 1) {
            return res.json([]);
        }

        const searchTerm = q.trim();
        const searchWords = searchTerm.split(/\s+/).filter(t => t.length > 0);
        const tsQuery = searchWords.map(t => `${t.replace(/'/g, "''")}:*`).join(' & ');

        const results = await pool.query(`
            SELECT 
                c.*,
                COALESCE(u.use_count, 0) as use_count,
                (f.catalog_id IS NOT NULL) as is_favorite
            FROM orders_catalog c
            LEFT JOIN orders_usage u ON c.id = u.catalog_id AND u.user_id = $4
            LEFT JOIN orders_favorites f ON c.id = f.catalog_id AND f.user_id = $4
            WHERE c.is_active = true
              AND ($5::text IS NULL OR c.type = $5::order_catalog_type)
              AND (
                c.name ILIKE $1 || '%'
                OR $1 = ANY(c.synonyms)
                OR to_tsvector('english', 
                    c.name || ' ' || 
                    array_to_string(c.synonyms, ' ') || ' ' || 
                    COALESCE(c.category, '')
                ) @@ to_tsquery('english', $2)
                OR c.name ILIKE '%' || $1 || '%'
              )
            ORDER BY 
                (c.name ILIKE $1 || '%') DESC,
                ($1 = ANY(c.synonyms)) DESC,
                ts_rank_cd(to_tsvector('english', c.name), to_tsquery('english', $2)) DESC,
                use_count DESC,
                c.name ASC
            LIMIT $3
        `, [searchTerm, tsQuery, limit, req.user.id, type || null]);

        res.json(results.rows);
    } catch (error) {
        console.error('Error searching orders:', error);
        res.status(500).json({ error: 'Failed to search orders' });
    }
});

// 2. Favorites
router.get('/favorites', authenticate, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT c.*, true as is_favorite
            FROM orders_catalog c
            JOIN orders_favorites f ON c.id = f.catalog_id
            WHERE f.user_id = $1 AND c.is_active = true
            ORDER BY c.name ASC
        `, [req.user.id]);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching favorites:', error);
        res.status(500).json({ error: 'Failed to fetch favorites' });
    }
});

router.post('/favorites', authenticate, async (req, res) => {
    try {
        const { catalog_id } = req.body;
        await pool.query(`
            INSERT INTO orders_favorites (user_id, catalog_id)
            VALUES ($1, $2)
            ON CONFLICT DO NOTHING
        `, [req.user.id, catalog_id]);
        res.json({ success: true });
    } catch (error) {
        console.error('Error adding favorite:', error);
        res.status(500).json({ error: 'Failed to add favorite' });
    }
});

router.delete('/favorites/:catalog_id', authenticate, async (req, res) => {
    try {
        const { catalog_id } = req.params;
        await pool.query(`
            DELETE FROM orders_favorites
            WHERE user_id = $1 AND catalog_id = $2
        `, [req.user.id, catalog_id]);
        res.json({ success: true });
    } catch (error) {
        console.error('Error removing favorite:', error);
        res.status(500).json({ error: 'Failed to remove favorite' });
    }
});

// 3. Tracking & Recent
router.post('/track', authenticate, async (req, res) => {
    try {
        const { catalog_id } = req.body;
        await pool.query(`
            INSERT INTO orders_usage (user_id, catalog_id, use_count, last_used)
            VALUES ($1, $2, 1, CURRENT_TIMESTAMP)
            ON CONFLICT (user_id, catalog_id) DO UPDATE SET
                use_count = orders_usage.use_count + 1,
                last_used = CURRENT_TIMESTAMP
        `, [req.user.id, catalog_id]);
        res.json({ success: true });
    } catch (error) {
        console.error('Error tracking usage:', error);
        res.status(500).json({ error: 'Failed to track usage' });
    }
});

router.get('/recent', authenticate, async (req, res) => {
    try {
        const { type, limit = 10 } = req.query;
        const result = await pool.query(`
            SELECT c.*, (f.catalog_id IS NOT NULL) as is_favorite
            FROM orders_catalog c
            JOIN orders_usage u ON c.id = u.catalog_id
            LEFT JOIN orders_favorites f ON c.id = f.catalog_id AND f.user_id = $1
            WHERE u.user_id = $1 AND c.is_active = true
              AND ($3::text IS NULL OR c.type = $3::order_catalog_type)
            ORDER BY u.last_used DESC
            LIMIT $2
        `, [req.user.id, limit, type || null]);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching recent orders:', error);
        res.status(500).json({ error: 'Failed to fetch recent orders' });
    }
});

// 4. Visit Orders Integration
router.post('/visit/:visitId', authenticate, async (req, res) => {
    try {
        const { visitId } = req.params;
        const { catalog_id, patient_id, diagnosis_icd10_ids, order_details, priority } = req.body;

        const result = await pool.query(`
            INSERT INTO visit_orders (
                visit_id, patient_id, ordering_provider_id, catalog_id, 
                diagnosis_icd10_ids, order_details, priority, status
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'PENDING')
            RETURNING *
        `, [visitId, patient_id, req.user.id, catalog_id, JSON.stringify(diagnosis_icd10_ids || []), JSON.stringify(order_details || {}), priority || 'ROUTINE']);

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Error creating visit order:', error);
        res.status(500).json({ error: 'Failed to create visit order' });
    }
});

router.get('/visit/:visitId', authenticate, async (req, res) => {
    try {
        const { visitId } = req.params;
        const result = await pool.query(`
            SELECT vo.*, c.name, c.type, c.category, c.loinc_code,
                   u.first_name as provider_first_name, u.last_name as provider_last_name
            FROM visit_orders vo
            JOIN orders_catalog c ON vo.catalog_id = c.id
            LEFT JOIN users u ON vo.ordering_provider_id = u.id
            WHERE vo.visit_id = $1
            ORDER BY vo.created_at DESC
        `, [visitId]);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching visit orders:', error);
        res.status(500).json({ error: 'Failed to fetch visit orders' });
    }
});

router.patch('/instance/:id', authenticate, async (req, res) => {
    try {
        const { id } = req.params;
        const { status, priority, order_details, diagnosis_icd10_ids } = req.body;

        const updates = [];
        const values = [];
        let idx = 1;

        if (status) {
            updates.push(`status = $${idx++}`);
            values.push(status);
            if (status === 'SIGNED') {
                updates.push(`signed_at = CURRENT_TIMESTAMP`);
            } else if (status === 'SENT') {
                updates.push(`sent_at = CURRENT_TIMESTAMP`);
            }
        }
        if (priority) {
            updates.push(`priority = $${idx++}`);
            values.push(priority);
        }
        if (order_details) {
            updates.push(`order_details = $${idx++}`);
            values.push(JSON.stringify(order_details));
        }
        if (diagnosis_icd10_ids) {
            updates.push(`diagnosis_icd10_ids = $${idx++}`);
            values.push(JSON.stringify(diagnosis_icd10_ids));
        }

        if (updates.length === 0) return res.status(400).json({ error: 'No updates provided' });

        values.push(id);
        const result = await pool.query(`
            UPDATE visit_orders 
            SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
            WHERE id = $${idx}
            RETURNING *
        `, values);

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error updating visit order:', error);
        res.status(500).json({ error: 'Failed to update visit order' });
    }
});

module.exports = router;
