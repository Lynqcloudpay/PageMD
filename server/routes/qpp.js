const express = require('express');
const router = express.Router();
const pool = require('../db');
const { audit } = require('../services/auditService');
const mipsComputationService = require('../services/mipsComputationService');

// Middleware to ensure user is admin
const isAdmin = (req, res, next) => {
    if (req.user && (req.user.role === 'admin' || req.user.role === 'super_admin' || req.user.isAdmin)) {
        return next();
    }
    return res.status(403).json({ error: 'Access denied. Admin required.' });
};

// 1. Get Quality Measures Library
router.get('/measures', async (req, res) => {
    try {
        const { year } = req.query;
        const result = await pool.query(
            'SELECT * FROM qpp_measures WHERE performance_year = $1 AND is_active = true ORDER BY category, qpp_id',
            [year || 2026]
        );
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching QPP measures:', error);
        res.status(500).json({ error: 'Failed to fetch measures' });
    }
});

// 2. Get Specialty Packs
router.get('/packs', async (req, res) => {
    try {
        const { year } = req.query;
        const result = await pool.query(
            'SELECT * FROM specialty_packs WHERE performance_year = $1 AND is_active = true ORDER BY specialty',
            [year || 2026]
        );
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching specialty packs:', error);
        res.status(500).json({ error: 'Failed to fetch packs' });
    }
});

// 3. Get Scoreboard for a Pack
router.get('/scoreboard/:packId', async (req, res) => {
    try {
        const { packId } = req.params;

        // Fetch the pack details
        const packRes = await pool.query('SELECT * FROM specialty_packs WHERE id = $1', [packId]);
        if (packRes.rows.length === 0) return res.status(404).json({ error: 'Pack not found' });
        const pack = packRes.rows[0];

        // Fetch measures in this pack
        const measuresRes = await pool.query(
            'SELECT * FROM qpp_measures WHERE id = ANY($1)',
            [pack.measure_ids.concat(pack.ia_ids || [], pack.pi_ids || [])]
        );

        // Fetch current provider scores for these measures
        const scoresRes = await pool.query(
            'SELECT * FROM provider_measure_scores WHERE measure_id = ANY($1)',
            [pack.measure_ids]
        );

        // Fetch attestations for this clinic
        const attestRes = await pool.query(
            'SELECT * FROM tenant_attestations WHERE measure_id = ANY($1)',
            [pack.ia_ids.concat(pack.pi_ids || [])]
        );

        res.json({
            pack,
            measures: measuresRes.rows,
            scores: scoresRes.rows,
            attestations: attestRes.rows
        });
    } catch (error) {
        console.error('Error fetching scoreboard:', error);
        res.status(500).json({ error: 'Failed to fetch scoreboard' });
    }
});

// 4. Submit Attestation
router.post('/attest', isAdmin, async (req, res) => {
    try {
        const { measureId, year, isAttested, notes, evidenceLinks } = req.body;
        const clinicId = req.user.tenantId || req.user.clinicId || '00000000-0000-0000-0000-000000000000'; // Fallback if no tenant context

        const result = await pool.query(
            `INSERT INTO tenant_attestations (
                clinic_id, measure_id, performance_year, is_attested, 
                attested_by, attested_at, notes, evidence_links
            ) VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, $6, $7)
            ON CONFLICT (clinic_id, measure_id, performance_year) DO UPDATE SET
                is_attested = EXCLUDED.is_attested,
                attested_by = EXCLUDED.attested_by,
                attested_at = CURRENT_TIMESTAMP,
                notes = EXCLUDED.notes,
                evidence_links = EXCLUDED.evidence_links
            RETURNING *`,
            [clinicId, measureId, year, isAttested, req.user.id, notes, evidenceLinks || []]
        );

        await audit({
            userId: req.user.id,
            action: 'MIPS_ATTESTATION',
            resource: 'qpp_measures',
            resourceId: measureId,
            details: { isAttested, year }
        });

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error submitting attestation:', error);
        res.status(500).json({ error: 'Failed to submit attestation' });
    }
});

// 5. Trigger Computation
router.post('/compute', isAdmin, async (req, res) => {
    try {
        const { packId, providerId, year } = req.body;

        let providers = [];
        if (providerId) {
            providers = [providerId];
        } else {
            // Fetch all active clinical providers
            const provRes = await pool.query("SELECT id FROM users WHERE role IN ('clinician', 'doctor', 'provider') AND is_active = true");
            providers = provRes.rows.map(r => r.id);
        }

        let measures = [];
        if (packId) {
            const packRes = await pool.query('SELECT measure_ids FROM specialty_packs WHERE id = $1', [packId]);
            if (packRes.rows.length > 0) {
                measures = packRes.rows[0].measure_ids;
            }
        } else {
            // Compute all active quality measures
            const measRes = await pool.query("SELECT id FROM qpp_measures WHERE category = 'QUALITY' AND performance_year = $1", [year || 2026]);
            measures = measRes.rows.map(r => r.id);
        }

        const results = [];
        for (const p of providers) {
            for (const m of measures) {
                try {
                    const result = await mipsComputationService.computeMeasure(p, m, year || 2026);
                    if (result) results.push({ provider: p, measure: m, ...result });
                } catch (err) {
                    console.error(`Failed to compute ${m} for ${p}:`, err.message);
                }
            }
        }

        await audit({
            userId: req.user.id,
            action: 'MIPS_COMPUTATION_TRIGGER',
            resource: 'specialty_packs',
            resourceId: packId,
            details: { count: results.length, year }
        });

        res.json({ message: 'Computation complete', resultsCount: results.length });
    } catch (error) {
        console.error('Error triggering computation:', error);
        res.status(500).json({ error: 'Failed to trigger computation' });
    }
});

module.exports = router;
