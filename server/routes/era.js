const express = require('express');
const router = express.Router();
const multer = require('multer');
const { authenticate } = require('../middleware/auth');
const { requirePermission } = require('../services/authorization');
const eraService = require('../services/eraService');

// Configure multer for file upload
const storage = multer.memoryStorage();
const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

router.use(authenticate);

/**
 * GET /api/era
 * List ERA files
 */
router.get('/', requirePermission('billing:view'), async (req, res) => {
    try {
        const tenantId = req.user.tenant_id || 'default';
        const status = req.query.status || null;
        const files = await eraService.getERAFiles(tenantId, status);
        res.json(files);
    } catch (e) {
        console.error('Error fetching ERA files:', e);
        res.status(500).json({ error: e.message });
    }
});

/**
 * GET /api/era/:id
 * Get ERA file details with claims and lines
 */
router.get('/:id', requirePermission('billing:view'), async (req, res) => {
    try {
        const details = await eraService.getERADetails(req.params.id);
        if (!details) {
            return res.status(404).json({ error: 'ERA file not found' });
        }
        res.json(details);
    } catch (e) {
        console.error('Error fetching ERA details:', e);
        res.status(500).json({ error: e.message });
    }
});

/**
 * POST /api/era/upload
 * Upload and parse ERA file
 */
router.post('/upload', requirePermission('billing:edit'), upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const content = req.file.buffer.toString('utf-8');
        const filename = req.file.originalname;
        const tenantId = req.user.tenant_id || 'default';

        const eraFile = await eraService.uploadERA(filename, content, req.user.id, tenantId);

        res.status(201).json(eraFile);
    } catch (e) {
        console.error('Error uploading ERA:', e);
        res.status(500).json({ error: e.message });
    }
});

/**
 * POST /api/era/:id/match
 * Manually match ERA claim to database claim
 */
router.post('/:eraClaimId/match', requirePermission('billing:edit'), async (req, res) => {
    try {
        const { claimId } = req.body;
        if (!claimId) {
            return res.status(400).json({ error: 'claimId required' });
        }

        const result = await eraService.manualMatch(req.params.eraClaimId, claimId);
        res.json(result);
    } catch (e) {
        console.error('Error matching ERA claim:', e);
        res.status(500).json({ error: e.message });
    }
});

/**
 * POST /api/era/:id/post
 * Post ERA payments and adjustments
 */
router.post('/:id/post', requirePermission('billing:edit'), async (req, res) => {
    try {
        const result = await eraService.postERA(req.params.id, req.user.id);
        res.json(result);
    } catch (e) {
        console.error('Error posting ERA:', e);
        res.status(500).json({ error: e.message });
    }
});

/**
 * POST /api/era/:id/void
 * Void/Reverse ERA posting
 */
router.post('/:id/void', requirePermission('billing:edit'), async (req, res) => {
    try {
        const { reason } = req.body;
        const result = await eraService.voidERA(req.params.id, req.user.id, reason);
        res.json(result);
    } catch (e) {
        console.error('Error voiding ERA:', e);
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
