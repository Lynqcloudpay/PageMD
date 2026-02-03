/**
 * API v1 Router
 * 
 * Mounts all v1 API endpoints with OAuth authentication,
 * rate limiting, and idempotency support.
 */

const express = require('express');
const { authenticateOAuth, hybridAuth } = require('../../../middleware/oauthAuth');
const { rateLimitByApp } = require('../../../middleware/rateLimitByApp');
const { idempotency } = require('../../../middleware/idempotency');
const { requestIdMiddleware } = require('../../../utils/apiResponse');

const router = express.Router();

// Apply request ID middleware
router.use(requestIdMiddleware);

// Apply hybrid auth (accepts both internal JWT and OAuth tokens)
router.use(hybridAuth);

// Apply rate limiting for OAuth requests
router.use(rateLimitByApp);

// Apply idempotency for POST/PATCH requests
router.use(idempotency);

// Mount v1 endpoints
router.use('/patients', require('./patients'));
router.use('/appointments', require('./appointments'));
router.use('/encounters', require('./encounters'));
router.use('/documents', require('./documents'));
router.use('/webhooks', require('./webhooks'));

// Health check for v1 API
router.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        version: 'v1',
        timestamp: new Date().toISOString(),
        request_id: res.requestId
    });
});

// List available scopes
router.get('/scopes', (req, res) => {
    res.json({
        data: [
            { scope: 'patient.read', description: 'Read patient demographics and records' },
            { scope: 'patient.write', description: 'Create and update patient records' },
            { scope: 'appointment.read', description: 'Read appointment data' },
            { scope: 'appointment.write', description: 'Create and update appointments' },
            { scope: 'encounter.read', description: 'Read encounter/visit data' },
            { scope: 'encounter.write', description: 'Create and update encounters' },
            { scope: 'document.read', description: 'Read clinical documents' },
            { scope: 'document.write', description: 'Upload clinical documents' },
            { scope: 'medication.read', description: 'Read medication data' },
            { scope: 'medication.write', description: 'Create prescriptions' },
            { scope: 'webhook.manage', description: 'Manage webhook subscriptions' },
            { scope: 'ai.use', description: 'Use AI capabilities' }
        ],
        request_id: res.requestId
    });
});

module.exports = router;
