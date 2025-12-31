const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const feeSheetService = require('../services/feeSheetService');
const billingService = require('../services/billingService');
const { requirePermission } = require('../services/authorization');

router.use(authenticate);

/**
 * GET /api/fee-sheet/price/:codeType/:code
 * Gets the price for a code given a price level
 * NOTE: This must come BEFORE /:visitId to avoid conflict
 */
router.get('/price/:codeType/:code', requirePermission('billing:view'), async (req, res) => {
    try {
        const { codeType, code } = req.params;
        const { priceLevel } = req.query;

        const price = await billingService.getPrice(codeType, code, priceLevel);
        res.json({ price });
    } catch (error) {
        console.error('Error fetching price:', error);
        res.status(500).json({ error: 'Failed to fetch price' });
    }
});

/**
 * GET /api/fee-sheet/:visitId
 * Loads all billing and product items for an encounter
 */
router.get('/:visitId', requirePermission('billing:view'), async (req, res) => {
    try {
        const { visitId } = req.params;
        const data = await feeSheetService.loadItems(visitId);
        res.json(data);
    } catch (error) {
        console.error('Error loading fee sheet:', error);
        res.status(500).json({ error: 'Failed to load fee sheet data' });
    }
});

/**
 * POST /api/fee-sheet/:visitId/save
 * Saves the fee sheet items
 */
router.post('/:visitId/save', requirePermission('billing:edit'), async (req, res) => {
    try {
        const { visitId } = req.params;
        const { patientId, bill, prod, providerId, copay, paymentMethod, checksum } = req.body;

        const result = await feeSheetService.save({
            visitId,
            patientId,
            bill,
            prod,
            providerId,
            userId: req.user.id,
            copay,
            paymentMethod,
            expectedChecksum: checksum
        });

        res.json(result);
    } catch (error) {
        console.error('Error saving fee sheet:', error);
        if (error.code === 'CONCURRENCY_ERROR') {
            return res.status(409).json({ error: error.message, code: 'CONCURRENCY_ERROR' });
        }
        if (error.code === 'INSUFFICIENT_STOCK') {
            return res.status(400).json({ error: error.message, code: 'INSUFFICIENT_STOCK' });
        }
        res.status(500).json({ error: 'Failed to save fee sheet data' });
    }
});

module.exports = router;
