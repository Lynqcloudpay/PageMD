/**
 * Phase 2 API Endpoints - Add these to server/routes/superbills.js
 * Insert after the /void endpoint (around line 635)
 */

/**
 * POST /api/superbills/:id/ready
 * Mark superbill as READY (clinician → billing handoff)
 */
router.post('/:id/ready', requirePermission('charting:edit'), async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        const check = await pool.query('SELECT status FROM superbills WHERE id = $1', [id]);
        if (check.rows.length === 0) return res.status(404).json({ error: 'Superbill not found' });
        if (check.rows[0].status !== 'DRAFT') {
            return res.status(400).json({ error: 'Only DRAFT superbills can be marked READY' });
        }

        const result = await pool.query(
            `UPDATE superbills 
             SET status = 'READY', ready_at = NOW(), ready_by = $2, updated_at = NOW() 
             WHERE id = $1 RETURNING *`,
            [id, userId]
        );

        await logAudit(userId, 'mark_ready', 'superbill', id, {}, req.ip);
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error marking ready:', error);
        res.status(500).json({ error: 'Failed to mark ready' });
    }
});

/**
 * POST /api/superbills/:id/unready
 * Return superbill to DRAFT from READY
 */
router.post('/:id/unready', requirePermission('charting:edit'), async (req, res) => {
    try {
        const { id } = req.params;

        const check = await pool.query('SELECT status FROM superbills WHERE id = $1', [id]);
        if (check.rows.length === 0) return res.status(404).json({ error: 'Superbill not found' });
        if (check.rows[0].status !== 'READY') {
            return res.status(400).json({ error: 'Only READY superbills can be returned to DRAFT' });
        }

        const result = await pool.query(
            `UPDATE superbills 
             SET status = 'DRAFT', ready_at = NULL, ready_by = NULL, updated_at = NOW() 
             WHERE id = $1 RETURNING *`,
            [id]
        );

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error unmarking:', error);
        res.status(500).json({ error: 'Failed to unmark' });
    }
});

// ============================================================================
// ALSO UPDATE THE PATCH ENDPOINT (around line 350) to allow these new fields:
// ============================================================================

/**
 * In the PATCH /api/superbills/:id endpoint, add these fields to the allowed list:
 */
const allowedFields = [
    'service_date_from',
    'service_date_to',
    'place_of_service',
    'rendering_provider_id',
    'billing_provider_id',
    'facility_location_id',
    'insurance_provider_override',  // NEW - Phase 2
    'insurance_id_override',         // NEW - Phase 2
    'authorization_number',          // NEW - Phase 2
    'billing_notes',                 // NEW - Phase 2
    'denial_reason',                 // NEW - Phase 2
    'claim_status',                  // NEW - Phase 2
    'submitted_at',                  // NEW - Phase 2
    'paid_at',                       // NEW - Phase 2
    'paid_amount'                    // NEW - Phase 2
];

// Build dynamic UPDATE query based on what fields are present in req.body
