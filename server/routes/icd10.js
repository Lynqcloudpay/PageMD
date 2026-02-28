const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authenticate } = require('../middleware/auth');

// Search ICD-10 codes
// GET /api/icd10/search?q=...&limit=20
// Search ICD-10 codes
// GET /api/icd10/search?q=...&limit=20
router.get('/search', authenticate, async (req, res) => {
    try {
        const { q, limit = 20 } = req.query;
        const searchTerm = q ? q.trim() : '';

        // Performance Optimization: If no query, return user favorites or common codes
        if (!searchTerm || searchTerm.length < 1) {
            const defaults = await pool.query(`
                SELECT c.id, c.code, c.description, c.is_billable,
                       COALESCE(u.use_count, 0) as use_count
                FROM icd10_codes c
                LEFT JOIN icd10_usage u ON c.id = u.icd10_id AND u.user_id = $1
                WHERE c.is_active = true
                ORDER BY u.use_count DESC NULLS LAST, c.code ASC
                LIMIT $2
            `, [req.user.id, limit]);
            return res.json(defaults.rows);
        }

        // Prepare TS query (handles partial words)
        const tsQuery = searchTerm.split(/\s+/)
            .filter(t => t.length > 0)
            .map(t => `${t.replace(/'/g, "''")}:*`)
            .join(' & ');

        const results = await pool.query(`
            WITH search_results AS (
                SELECT 
                    id, code, description, is_billable, keywords,
                    COALESCE(u.use_count, 0) as use_count,
                    similarity(description, $1) as desc_sim,
                    similarity(code, $1) as code_sim,
                    CASE 
                        WHEN code ILIKE $1 || '%' THEN 1.0
                        WHEN keywords ILIKE '%' || $1 || '%' THEN 0.95
                        WHEN description ILIKE '%' || $1 || '%' THEN 0.8
                        ELSE ts_rank_cd(search_vector, to_tsquery('english', $2))
                    END as match_weight
                FROM icd10_codes c
                LEFT JOIN icd10_usage u ON c.id = u.icd10_id AND u.user_id = $4
                WHERE is_active = true
                  AND (
                    code ILIKE $1 || '%'
                    OR description ILIKE '%' || $1 || '%'
                    OR keywords ILIKE '%' || $1 || '%'
                    OR (length($1) > 2 AND search_vector @@ to_tsquery('english', $2))
                  )
            )
            SELECT * FROM search_results
            ORDER BY 
                (code ILIKE $1) DESC,
                (keywords ILIKE '%' || $1 || '%') DESC,
                match_weight DESC,
                use_count DESC,
                (desc_sim + code_sim) DESC
            LIMIT $3
        `, [searchTerm, tsQuery, limit, req.user.id]);

        if (results.rows.length === 0) {
            const { searchFallback } = require('../utils/icd10-fallback');
            const fallback = searchFallback(searchTerm);
            return res.json(fallback.map(f => ({
                id: f.code,
                code: f.code,
                description: f.description,
                is_billable: f.billable,
                use_count: 0
            })));
        }

        res.json(results.rows);
    } catch (error) {
        console.error('Error searching ICD-10:', error);
        // Extreme fallback on error
        const { searchFallback } = require('../utils/icd10-fallback');
        return res.json(searchFallback(req.query.q).map(f => ({
            id: f.code,
            code: f.code,
            description: f.description,
            is_billable: f.billable,
            use_count: 0
        })));
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
            -- Update user-specific usage
            INSERT INTO icd10_usage (user_id, icd10_id, use_count, last_used)
            VALUES ($1, $2, 1, CURRENT_TIMESTAMP)
            ON CONFLICT (user_id, icd10_id) DO UPDATE SET
                use_count = icd10_usage.use_count + 1,
                last_used = CURRENT_TIMESTAMP;

            -- Update global usage ranking
            UPDATE icd10_codes SET usage_count = usage_count + 1 WHERE id = $2;
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
