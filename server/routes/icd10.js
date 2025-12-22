const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authenticate } = require('../middleware/auth');

// Search ICD-10 codes
// GET /api/icd10/search?q=...&limit=20
router.get('/search', authenticate, async (req, res) => {
    try {
        const { q, limit = 20 } = req.query;
        if (!q || q.trim().length < 2) {
            // Return top usage codes if search is empty/short
            const topCodes = await pool.query(`
                SELECT c.id, c.code, c.description, c.is_billable
                FROM icd10_codes c
                LEFT JOIN icd10_usage u ON c.id = u.icd10_id AND u.user_id = $1
                WHERE c.is_active = true
                ORDER BY u.use_count DESC NULLS LAST, c.code ASC
                LIMIT $2
            `, [req.user.id, limit]);
            return res.json(topCodes.rows);
        }

        const searchTerm = q.trim();
        const searchWords = searchTerm.split(/\s+/).filter(t => t.length > 0);
        const tsQuery = searchWords.map(t => `${t}:*`).join(' & ');

        const results = await pool.query(`
            SELECT 
                c.id, c.code, c.description, c.is_billable,
                (c.code = $1) as exact_code,
                (c.code ILIKE $1 || '%') as code_prefix,
                (c.description ILIKE $1 || '%') as description_prefix,
                (c.description ILIKE '%' || $1 || '%') as description_contains,
                ts_rank_cd(to_tsvector('english', c.description), to_tsquery('english', $2)) as rank,
                similarity(c.description, $1) as sim,
                COALESCE(u.use_count, 0) as use_count
            FROM icd10_codes c
            LEFT JOIN icd10_usage u ON c.id = u.icd10_id AND u.user_id = $4
            WHERE c.is_active = true
              AND (
                c.code ILIKE $1 || '%'
                OR to_tsvector('english', c.description) @@ to_tsquery('english', $2)
                OR c.description % $1
              )
            ORDER BY 
                exact_code DESC,
                code_prefix DESC,
                (c.is_billable AND c.description ILIKE $1 || '%') DESC,
                (c.is_billable AND c.description ILIKE '%' || $1 || '%') DESC,
                (c.is_billable AND ts_rank_cd(to_tsvector('english', c.description), to_tsquery('english', $2)) > 0.05) DESC,
                rank DESC,
                use_count DESC,
                LENGTH(c.description) ASC,
                sim DESC
            LIMIT $3
        `, [searchTerm, tsQuery, limit, req.user.id]);

        res.json(results.rows);
    } catch (error) {
        console.error('Error searching ICD-10:', error);
        res.status(500).json({ error: 'Failed to search ICD-10 codes' });
    }
});

// Get user's favorites
// GET /api/icd10/favorites
router.get('/favorites', authenticate, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT c.id, c.code, c.description, c.is_billable
            FROM icd10_codes c
            JOIN icd10_favorites f ON c.id = f.icd10_id
            WHERE f.user_id = $1 AND c.is_active = true
            ORDER BY c.code ASC
        `, [req.user.id]);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching favorites:', error);
        res.status(500).json({ error: 'Failed to fetch favorites' });
    }
});

// Add to favorites
// POST /api/icd10/favorites
router.post('/favorites', authenticate, async (req, res) => {
    try {
        const { icd10_id } = req.body;
        if (!icd10_id) return res.status(400).json({ error: 'icd10_id is required' });

        await pool.query(`
            INSERT INTO icd10_favorites (user_id, icd10_id)
            VALUES ($1, $2)
            ON CONFLICT (user_id, icd10_id) DO NOTHING
        `, [req.user.id, icd10_id]);

        res.json({ success: true });
    } catch (error) {
        console.error('Error adding favorite:', error);
        res.status(500).json({ error: 'Failed to add favorite' });
    }
});

// Remove from favorites
// DELETE /api/icd10/favorites/:icd10_id
router.delete('/favorites/:icd10_id', authenticate, async (req, res) => {
    try {
        const { icd10_id } = req.params;
        await pool.query(`
            DELETE FROM icd10_favorites
            WHERE user_id = $1 AND icd10_id = $2
        `, [req.user.id, icd10_id]);
        res.json({ success: true });
    } catch (error) {
        console.error('Error removing favorite:', error);
        res.status(500).json({ error: 'Failed to remove favorite' });
    }
});

// Track usage
// POST /api/icd10/track
router.post('/track', authenticate, async (req, res) => {
    try {
        const { icd10_id } = req.body;
        if (!icd10_id) return res.status(400).json({ error: 'icd10_id is required' });

        await pool.query(`
            INSERT INTO icd10_usage (user_id, icd10_id, use_count, last_used)
            VALUES ($1, $2, 1, CURRENT_TIMESTAMP)
            ON CONFLICT (user_id, icd10_id) DO UPDATE SET
                use_count = icd10_usage.use_count + 1,
                last_used = CURRENT_TIMESTAMP
        `, [req.user.id, icd10_id]);

        res.json({ success: true });
    } catch (error) {
        console.error('Error tracking usage:', error);
        res.status(500).json({ error: 'Failed to track usage' });
    }
});

// Get recent codes
// GET /api/icd10/recent
router.get('/recent', authenticate, async (req, res) => {
    try {
        const { limit = 20 } = req.query;
        const result = await pool.query(`
            SELECT c.id, c.code, c.description, c.is_billable, u.last_used
            FROM icd10_codes c
            JOIN icd10_usage u ON c.id = u.icd10_id
            WHERE u.user_id = $1 AND c.is_active = true
            ORDER BY u.last_used DESC
            LIMIT $2
        `, [req.user.id, limit]);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching recent codes:', error);
        res.status(500).json({ error: 'Failed to fetch recent codes' });
    }
});

module.exports = router;
