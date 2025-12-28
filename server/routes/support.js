const express = require('express');
const router = express.Router();
const SupportService = require('../services/supportService');
const { authenticate } = require('../middleware/auth');
const { sanitizeInput } = require('../middleware/security');

// Create Support Ticket
router.post('/tickets', authenticate, sanitizeInput, async (req, res) => {
    try {
        // Get clinic ID from various possible sources
        const clinicId = req.user.clinic_id || req.user.clinicId || req.clinic?.id || null;

        console.log('[Support] Creating ticket for user:', req.user.email, 'clinic:', clinicId);

        const ticket = await SupportService.createTicket({
            clinicId: clinicId,
            email: req.user.email,
            role: req.user.role || req.user.role_name,
            userAgent: req.headers['user-agent']
        }, req.body);

        res.status(201).json(ticket);
    } catch (err) {
        console.error('Create Ticket Error:', err);
        res.status(500).json({ error: 'Failed to create support ticket' });
    }
});

module.exports = router;
