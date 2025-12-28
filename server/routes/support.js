const express = require('express');
const router = express.Router();
const SupportService = require('../services/supportService');
const { authenticate } = require('../middleware/auth');
const { sanitizeInput } = require('../middleware/security');

// Create Support Ticket
router.post('/tickets', authenticate, sanitizeInput, async (req, res) => {
    try {
        const ticket = await SupportService.createTicket({
            clinicId: req.user.clinicId, // Assumes authenticate middleware populates this
            email: req.user.email,
            role: req.user.role,
            userAgent: req.headers['user-agent']
        }, req.body);

        res.status(201).json(ticket);
    } catch (err) {
        console.error('Create Ticket Error:', err);
        res.status(500).json({ error: 'Failed to create support ticket' });
    }
});

module.exports = router;
