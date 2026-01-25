/**
 * E-Prescribing API Routes (DoseSpot Integration)
 * 
 * Handles:
 * - SSO URL generation for embedded prescribing UI
 * - Prescription management (draft, send, cancel)
 * - Pharmacy and medication search
 * - Status synchronization
 * - Webhook handling
 */

const express = require('express');
const { authenticate, logAudit } = require('../middleware/auth');
const { requirePermission } = require('../services/authorization');
const rateLimit = require('express-rate-limit');
const getEPrescribeService = require('../services/eprescribe/EPrescribeService');
const pool = require('../db');
const { safeLogger } = require('../middleware/phiRedaction');
const featureGuard = require('../middleware/featureGuard');

const router = express.Router();
router.use(authenticate);
router.use(featureGuard('eprescribe'));

// Middleware to check for prescribing lock
const checkPrescribeLock = (req, res, next) => {
  if (req.clinic?.prescribing_locked && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    logAudit(
      req.user?.id || null,
      'prescribing_access_blocked',
      'eprescribe',
      null,
      {
        reason: 'Prescribing Lock Active',
        path: req.path,
        method: req.method
      },
      req.ip,
      req.get('user-agent'),
      'failure'
    );
    return res.status(403).json({
      error: 'e-Prescribing is currently locked for this clinic by platform administrators for compliance reasons.',
      code: 'PRESCRIBING_LOCKED'
    });
  }
  next();
};

router.use(checkPrescribeLock);

// Rate limiting for ePrescribe endpoints (stricter than general API)
const eprescribeRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // 50 requests per window
  message: 'Too many ePrescribing requests, please try again later.',
  standardHeaders: true,
  legacyHeaders: false
});

router.use(eprescribeRateLimit);

/**
 * GET /api/eprescribe/status
 * Check if ePrescribing is enabled
 */
router.get('/status', async (req, res) => {
  try {
    const service = getEPrescribeService();
    const provider = service.getProvider();
    const isDoseSpotEnabled = service.isDoseSpotEnabled();

    res.json({
      enabled: isDoseSpotEnabled || provider === 'internal',
      provider: provider,
      dosespotEnabled: isDoseSpotEnabled,
      epcsEnabled: service.isEPCSEnabled()
    });
  } catch (error) {
    safeLogger.error('[ePrescribe] Status check failed', { error: error.message });
    res.status(500).json({ error: 'Failed to check ePrescribing status' });
  }
});

/**
 * POST /api/eprescribe/session
 * Get Single Sign-On URL for embedded prescribing UI
 * Requires: clinician or admin role
 */
router.post('/session', requirePermission('meds:prescribe'), async (req, res) => {
  const dbClient = req.dbClient || pool;

  try {
    const { patientId, returnUrl } = req.body;
    const userId = req.user.id;

    if (!patientId) {
      return res.status(400).json({ error: 'Patient ID is required' });
    }

    // Verify patient access
    const patientCheck = await dbClient.query(
      `SELECT id FROM patients WHERE id = $1`,
      [patientId]
    );

    if (patientCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    const service = getEPrescribeService();

    if (!service.isDoseSpotEnabled()) {
      return res.status(503).json({ error: 'DoseSpot e-prescribing service is not enabled. Set EPRESCRIBE_PROVIDER=dosespot' });
    }

    // Get SSO URL
    const ssoData = await service.getSingleSignOnUrl({
      userId,
      patientId,
      returnUrl
    });

    // Log audit
    try {
      await logAudit(userId, 'eprescribe_session_created', 'eprescribe', null, {
        patientId,
        action: 'sso_url_generated'
      }, req.ip, req.get('user-agent'));
    } catch (auditError) {
      safeLogger.warn('[ePrescribe] Audit log failed', { error: auditError.message });
    }

    res.json({
      url: ssoData.url,
      token: ssoData.token
    });
  } catch (error) {
    safeLogger.error('[ePrescribe] Session creation failed', {
      error: error.message,
      userId: req.user.id
    });
    res.status(500).json({ error: 'Failed to create ePrescribing session' });
  }
});

/**
 * GET /api/eprescribe/patient/:id/prescriptions
 * Get prescriptions for a patient
 * Requires: patient access permission
 */
router.get('/patient/:id/prescriptions', requirePermission('prescriptions:view'), async (req, res) => {
  const dbClient = req.dbClient || pool;

  try {
    const { id: patientId } = req.params;
    const userId = req.user.id;

    // Verify patient access (same logic as notes)
    console.log('[DEBUG] Fetching prescriptions for patient:', patientId, 'User:', userId);
    const patientCheck = await dbClient.query(
      `SELECT id FROM patients WHERE id = $1`,
      [patientId]
    );

    if (patientCheck.rows.length === 0) {
      console.log('[DEBUG] Patient not found');
      return res.status(404).json({ error: 'Patient not found' });
    }

    // Get prescriptions
    const result = await dbClient.query(
      `SELECT 
        p.id, p.patient_id, p.prescriber_id as prescriber_user_id, p.medication_name, p.sig,
        p.quantity, p.days_supply, p.refills, p.status, p.transmission_id as vendor_message_id,
        p.sig_structured as vendor_payload, p.sent_at, p.filled_at, p.created_at, p.updated_at,
        u.first_name || ' ' || u.last_name as prescriber_name
       FROM prescriptions p
       LEFT JOIN users u ON p.prescriber_id = u.id
       WHERE p.patient_id = $1
       ORDER BY p.created_at DESC
       LIMIT 100`,
      [patientId]
    );

    res.json({
      prescriptions: result.rows.map(row => ({
        ...row,
        // Since vendor_payload is jsonb, pg driver already returns it as an object
        vendor_payload: typeof row.vendor_payload === 'string' ? JSON.parse(row.vendor_payload) : row.vendor_payload
      }))
    });
  } catch (error) {
    safeLogger.error('[ePrescribe] Failed to fetch prescriptions', {
      error: error.message,
      patientId: req.params.id
    });
    res.status(500).json({ error: 'Failed to fetch prescriptions' });
  }
});

/**
 * POST /api/eprescribe/patient/:id/prescriptions
 * Create prescription draft
 * Requires: prescriptions:create permission
 */
router.post('/patient/:id/prescriptions', requirePermission('meds:prescribe'), async (req, res) => {
  const dbClient = req.dbClient || pool;

  try {
    const { id: patientId } = req.params;
    const userId = req.user.id;
    const {
      medicationDisplay,
      medicationName,
      sig,
      quantity,
      daysSupply,
      refills,
      pharmacyVendorId
    } = req.body;

    // Validation
    if (!medicationDisplay && !medicationName) {
      return res.status(400).json({ error: 'Medication name is required' });
    }

    if (!sig) {
      return res.status(400).json({ error: 'Prescription instructions (sig) are required' });
    }

    if (!quantity || quantity <= 0) {
      return res.status(400).json({ error: 'Valid quantity is required' });
    }

    // Verify patient access
    const patientCheck = await dbClient.query(
      `SELECT id FROM patients WHERE id = $1`,
      [patientId]
    );

    if (patientCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    const service = getEPrescribeService();

    if (!service.isDoseSpotEnabled()) {
      return res.status(503).json({ error: 'DoseSpot e-prescribing service is not enabled. Set EPRESCRIBE_PROVIDER=dosespot' });
    }

    // EPCS validation for controlled substances
    if (req.body.isControlled || req.body.schedule) {
      const epcsValidation = await service.validateEPCS(
        { isControlled: req.body.isControlled, schedule: req.body.schedule },
        req.user
      );
      if (!epcsValidation.valid) {
        return res.status(400).json({ error: epcsValidation.error });
      }
    }

    // Create draft
    const result = await service.createPrescriptionDraft({
      patientId,
      prescriberUserId: userId,
      medicationDisplay: medicationDisplay || medicationName,
      medicationName: medicationName || medicationDisplay,
      sig,
      quantity: parseInt(quantity),
      daysSupply: daysSupply ? parseInt(daysSupply) : null,
      refills: refills ? parseInt(refills) : 0,
      pharmacyVendorId
    });

    // Log audit
    try {
      await logAudit(userId, 'prescription_draft_created', 'prescription', result.prescriptionId, {
        patientId,
        medication: medicationDisplay || medicationName,
        status: 'DRAFT'
      }, req.ip, req.get('user-agent'));
    } catch (auditError) {
      safeLogger.warn('[ePrescribe] Audit log failed', { error: auditError.message });
    }

    res.status(201).json({
      prescriptionId: result.prescriptionId,
      vendorMessageId: result.vendorMessageId,
      status: 'DRAFT'
    });
  } catch (error) {
    safeLogger.error('[ePrescribe] Failed to create prescription draft', {
      error: error.message,
      patientId: req.params.id,
      userId: req.user.id
    });
    res.status(500).json({ error: 'Failed to create prescription draft' });
  }
});

/**
 * POST /api/eprescribe/prescriptions/:id/send
 * Send prescription
 * Requires: prescriptions:create permission (only clinicians/admins can send)
 */
router.post('/prescriptions/:id/send', requirePermission('meds:prescribe'), async (req, res) => {
  const dbClient = req.dbClient || pool;

  try {
    const { id: prescriptionId } = req.params;
    const userId = req.user.id;

    // Verify prescription exists and user has access
    const prescCheck = await dbClient.query(
      `SELECT p.id, p.patient_id, p.status, p.prescriber_id as prescriber_user_id
       FROM prescriptions p
       WHERE p.id = $1`,
      [prescriptionId]
    );

    if (prescCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Prescription not found' });
    }

    const prescription = prescCheck.rows[0];

    // Only prescriber or admin can send
    if (prescription.prescriber_user_id !== userId && !req.user.is_admin) {
      return res.status(403).json({ error: 'Not authorized to send this prescription' });
    }

    if (prescription.status !== 'DRAFT' && prescription.status !== 'draft') {
      return res.status(400).json({ error: 'Only draft prescriptions can be sent' });
    }

    const service = getEPrescribeService();

    if (!service.isDoseSpotEnabled()) {
      return res.status(503).json({ error: 'DoseSpot e-prescribing service is not enabled' });
    }

    // Send prescription
    const result = await service.sendPrescription(prescriptionId);

    // Log audit
    try {
      await logAudit(userId, 'prescription_sent', 'prescription', prescriptionId, {
        patientId: prescription.patient_id,
        status: result.status
      }, req.ip, req.get('user-agent'));
    } catch (auditError) {
      safeLogger.warn('[ePrescribe] Audit log failed', { error: auditError.message });
    }

    res.json({
      prescriptionId,
      status: result.status
    });
  } catch (error) {
    safeLogger.error('[ePrescribe] Failed to send prescription', {
      error: error.message,
      prescriptionId: req.params.id,
      userId: req.user.id
    });
    res.status(500).json({ error: 'Failed to send prescription' });
  }
});

/**
 * POST /api/eprescribe/prescriptions/:id/cancel
 * Cancel prescription
 * Requires: prescriptions:create permission
 */
router.post('/prescriptions/:id/cancel', requirePermission('meds:prescribe'), async (req, res) => {
  const dbClient = req.dbClient || pool;

  try {
    const { id: prescriptionId } = req.params;
    const { reason } = req.body;
    const userId = req.user.id;

    // Verify prescription exists and user has access
    const prescCheck = await dbClient.query(
      `SELECT p.id, p.patient_id, p.status, p.prescriber_id as prescriber_user_id
       FROM prescriptions p
       WHERE p.id = $1`,
      [prescriptionId]
    );

    if (prescCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Prescription not found' });
    }

    const prescription = prescCheck.rows[0];

    // Only prescriber or admin can cancel
    if (prescription.prescriber_user_id !== userId && !req.user.is_admin) {
      return res.status(403).json({ error: 'Not authorized to cancel this prescription' });
    }

    const service = getEPrescribeService();

    if (!service.isDoseSpotEnabled()) {
      return res.status(503).json({ error: 'DoseSpot e-prescribing service is not enabled' });
    }

    // Cancel prescription
    const result = await service.cancelPrescription(prescriptionId, reason || 'Prescriber request');

    // Log audit
    try {
      await logAudit(userId, 'prescription_cancelled', 'prescription', prescriptionId, {
        patientId: prescription.patient_id,
        reason: reason || 'Prescriber request',
        status: result.status
      }, req.ip, req.get('user-agent'));
    } catch (auditError) {
      safeLogger.warn('[ePrescribe] Audit log failed', { error: auditError.message });
    }

    res.json({
      prescriptionId,
      status: result.status
    });
  } catch (error) {
    safeLogger.error('[ePrescribe] Failed to cancel prescription', {
      error: error.message,
      prescriptionId: req.params.id,
      userId: req.user.id
    });
    res.status(500).json({ error: 'Failed to cancel prescription' });
  }
});

/**
 * GET /api/eprescribe/pharmacies/search
 * Search pharmacies
 * Requires: prescriptions:view permission
 */
router.get('/pharmacies/search', requirePermission('prescriptions:view'), async (req, res) => {
  try {
    const { query, latitude, longitude, radius } = req.query;

    if (!query || query.length < 2) {
      return res.status(400).json({ error: 'Search query must be at least 2 characters' });
    }

    const service = getEPrescribeService();

    const location = (latitude && longitude) ? {
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude),
      radius: radius ? parseInt(radius) : 25
    } : null;

    const pharmacies = await service.searchPharmacies(query, location);

    res.json({ pharmacies });
  } catch (error) {
    safeLogger.error('[ePrescribe] Pharmacy search failed', {
      error: error.message,
      query: req.query.query
    });
    res.status(500).json({ error: 'Failed to search pharmacies' });
  }
});

/**
 * GET /api/eprescribe/medications/search
 * Search medications
 * Requires: prescriptions:view permission
 */
router.get('/medications/search', requirePermission('prescriptions:view'), async (req, res) => {
  try {
    const { query } = req.query;

    if (!query || query.length < 2) {
      return res.status(400).json({ error: 'Search query must be at least 2 characters' });
    }

    const service = getEPrescribeService();

    const medications = await service.searchMedications(query);

    res.json({ medications });
  } catch (error) {
    safeLogger.error('[ePrescribe] Medication search failed', {
      error: error.message,
      query: req.query.query
    });
    res.status(500).json({ error: 'Failed to search medications' });
  }
});

/**
 * POST /api/eprescribe/webhook
 * Handle webhook from DoseSpot (no auth required, signature verified)
 */
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const signature = req.get('X-DoseSpot-Signature') || req.get('X-Signature');
    const payload = JSON.parse(req.body.toString());

    const service = getEPrescribeService();

    if (!service.isDoseSpotEnabled()) {
      return res.status(503).json({ error: 'DoseSpot e-prescribing service is not enabled' });
    }

    // Get DoseSpot service for webhook handling
    const getDoseSpotService = require('../services/eprescribe/dosespot/DoseSpotService');
    const dosespotService = getDoseSpotService();

    // Verify signature
    if (!dosespotService.client.verifyWebhookSignature(JSON.stringify(payload), signature)) {
      return res.status(401).json({ error: 'Invalid webhook signature' });
    }

    await dosespotService.handleWebhook(payload, signature);
    res.status(200).json({ received: true });
  } catch (error) {
    safeLogger.error('[ePrescribe] Webhook handling failed', {
      error: error.message
    });
    res.status(400).json({ error: 'Webhook processing failed' });
  }
});

module.exports = router;

