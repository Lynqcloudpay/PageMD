const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { requirePermission } = require('../services/authorization');
const claimSubmissionService = require('../services/claimSubmissionService');

router.use(authenticate);

/**
 * GET /api/claim-submissions
 * List all claim submission batches
 */
router.get('/', requirePermission('billing:view'), async (req, res) => {
    try {
        const tenantId = req.user.tenant_id || 'default';
        const submissions = await claimSubmissionService.getSubmissions(tenantId);
        res.json(submissions);
    } catch (e) {
        console.error('Error fetching submissions:', e);
        res.status(500).json({ error: e.message });
    }
});

/**
 * GET /api/claim-submissions/:id
 * Get submission details with items
 */
router.get('/:id', requirePermission('billing:view'), async (req, res) => {
    try {
        const submission = await claimSubmissionService.getSubmissionDetails(req.params.id);
        if (!submission) {
            return res.status(404).json({ error: 'Submission not found' });
        }
        res.json(submission);
    } catch (e) {
        console.error('Error fetching submission:', e);
        res.status(500).json({ error: e.message });
    }
});

/**
 * GET /api/claim-submissions/:id/x12
 * Download X12 content
 */
router.get('/:id/x12', requirePermission('billing:view'), async (req, res) => {
    try {
        const submission = await claimSubmissionService.getSubmissionDetails(req.params.id);
        if (!submission || !submission.x12_content) {
            return res.status(404).json({ error: 'X12 not found' });
        }

        res.setHeader('Content-Type', 'text/plain');
        res.setHeader('Content-Disposition', `attachment; filename="batch_${req.params.id}.837"`);
        res.send(submission.x12_content);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

/**
 * POST /api/claim-submissions
 * Create new submission batch
 */
router.post('/', requirePermission('billing:edit'), async (req, res) => {
    try {
        const { claimIds } = req.body;

        if (!claimIds || !Array.isArray(claimIds) || claimIds.length === 0) {
            return res.status(400).json({ error: 'claimIds array required' });
        }

        const tenantId = req.user.tenant_id || 'default';
        const submission = await claimSubmissionService.createBatch(claimIds, req.user.id, tenantId);

        res.status(201).json(submission);
    } catch (e) {
        console.error('Error creating submission:', e);
        res.status(500).json({ error: e.message });
    }
});

/**
 * POST /api/claim-submissions/:id/generate
 * Generate X12 for batch
 */
router.post('/:id/generate', requirePermission('billing:edit'), async (req, res) => {
    try {
        const options = req.body.options || {};

        // Add clinic config from env or settings
        options.npi = options.npi || process.env.CLINIC_NPI;
        options.taxId = options.taxId || process.env.CLINIC_TAX_ID;
        options.billingProviderName = options.billingProviderName || process.env.CLINIC_NAME;

        const x12Content = await claimSubmissionService.generateX12(req.params.id, options);

        res.json({
            success: true,
            x12Length: x12Content.length,
            preview: x12Content.substring(0, 500) + '...'
        });
    } catch (e) {
        console.error('Error generating X12:', e);
        res.status(500).json({ error: e.message });
    }
});

/**
 * POST /api/claim-submissions/:id/submit
 * Submit batch to clearinghouse
 */
router.post('/:id/submit', requirePermission('billing:edit'), async (req, res) => {
    try {
        const tenantId = req.user.tenant_id || 'default';
        const result = await claimSubmissionService.submitBatch(req.params.id, tenantId);

        res.json(result);
    } catch (e) {
        console.error('Error submitting batch:', e);
        res.status(502).json({ error: 'Submission failed', details: e.message });
    }
});

/**
 * POST /api/claim-submissions/resubmit/:claimId
 * Resubmit a single claim (creates new version)
 */
router.post('/resubmit/:claimId', requirePermission('billing:edit'), async (req, res) => {
    try {
        const batch = await claimSubmissionService.resubmitClaim(req.params.claimId, req.user.id);
        res.json(batch);
    } catch (e) {
        console.error('Error resubmitting claim:', e);
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
