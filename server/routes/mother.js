const express = require('express');
const MotherReadService = require('../mother/MotherReadService');
const MotherWriteService = require('../mother/MotherWriteService');
const DocumentStoreService = require('../mother/DocumentStoreService');
const { authenticate } = require('../middleware/auth');
const { requirePermission } = require('../services/authorization');

const router = express.Router();

// Apply authentication
router.use(authenticate);

/**
 * GET /api/mother/patient/:id/state
 * Returns the current derived state (vitals, meds, problems, etc)
 */
router.get('/patient/:id/state', requirePermission('patients:view_chart'), async (req, res) => {
    try {
        const state = await MotherReadService.getPatientState(req.user.clinic_id, req.params.id);
        res.json(state);
    } catch (err) {
        res.status(500).json({ error: 'Failed to retrieve patient state' });
    }
});

/**
 * GET /api/mother/patient/:id/timeline
 * Returns the immutable event timeline
 */
router.get('/patient/:id/timeline', requirePermission('patients:view_chart'), async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 50;
        const offset = parseInt(req.query.offset) || 0;
        const timeline = await MotherReadService.getPatientTimeline(req.user.clinic_id, req.params.id, limit, offset);
        res.json(timeline);
    } catch (err) {
        res.status(500).json({ error: 'Failed to retrieve timeline' });
    }
});

/**
 * GET /api/mother/patient/:id/summary
 * Returns demographics + current state + recent events
 */
router.get('/patient/:id/summary', requirePermission('patients:view_chart'), async (req, res) => {
    try {
        const summary = await MotherReadService.getPatientSummary(req.user.clinic_id, req.params.id);
        res.json(summary);
    } catch (err) {
        res.status(500).json({ error: 'Failed to retrieve patient summary' });
    }
});

/**
 * GET /api/mother/patient/:id/ai-context
 * Alias for summary, optimized for AI agents
 */
router.get('/patient/:id/ai-context', requirePermission('patients:view_chart'), async (req, res) => {
    try {
        const summary = await MotherReadService.getPatientSummary(req.user.clinic_id, req.params.id);
        res.json(summary);
    } catch (err) {
        res.status(500).json({ error: 'Failed to retrieve AI context' });
    }
});

/**
 * POST /api/mother/patient/:id/vitals
 */
router.post('/patient/:id/vitals', requirePermission('vitals:write'), async (req, res) => {
    try {
        const result = await MotherWriteService.recordVital(req.user.clinic_id, req.params.id, req.body.encounter_id, req.body, req.user.id);
        res.status(201).json(result);
    } catch (err) {
        res.status(500).json({ error: 'Failed to record vitals' });
    }
});

/**
 * POST /api/mother/patient/:id/medications
 */
router.post('/patient/:id/medications', requirePermission('meds:prescribe'), async (req, res) => {
    try {
        const result = await MotherWriteService.addMedication(req.user.clinic_id, req.params.id, req.body.encounter_id, req.body, req.user.id);
        res.status(201).json(result);
    } catch (err) {
        res.status(500).json({ error: 'Failed to add medication' });
    }
});

/**
 * POST /api/mother/patient/:id/diagnoses
 */
router.post('/patient/:id/diagnoses', requirePermission('phm:write'), async (req, res) => {
    try {
        const result = await MotherWriteService.addDiagnosis(req.user.clinic_id, req.params.id, req.body.encounter_id, req.body, req.user.id);
        res.status(201).json(result);
    } catch (err) {
        res.status(500).json({ error: 'Failed to add diagnosis' });
    }
});

/**
 * GET /api/mother/patient/:id/documents
 */
router.get('/patient/:id/documents', requirePermission('patients:view_chart'), async (req, res) => {
    try {
        const { query } = req.query;
        if (query) {
            const results = await MotherReadService.searchDocuments(req.user.clinic_id, req.params.id, query);
            return res.json(results);
        }
        // Default to listing all docs for patient via DocumentStoreService or the ledger
        // For now, use search with empty query if not implemented otherwise
        const results = await MotherReadService.searchDocuments(req.user.clinic_id, req.params.id, "");
        res.json(results);
    } catch (err) {
        res.status(500).json({ error: 'Failed to retrieve documents' });
    }
});

module.exports = router;
