/**
 * DoseSpot Service
 * 
 * Business logic layer for DoseSpot ePrescribing integration:
 * - Patient/prescriber vendor mapping
 * - Prescription lifecycle management
 * - Status synchronization
 * - Audit logging
 */

const pool = require('../../../db');
const DoseSpotClient = require('./DoseSpotClient');
const { safeLogger } = require('../../../middleware/phiRedaction');

class DoseSpotService {
  constructor() {
    // Only initialize if provider is set to dosespot
    if (process.env.EPRESCRIBE_PROVIDER === 'dosespot') {
      this.client = new DoseSpotClient({
        baseURL: process.env.DOSESPOT_BASE_URL,
        clientId: process.env.DOSESPOT_CLIENT_ID,
        clientSecret: process.env.DOSESPOT_CLIENT_SECRET,
        clinicId: process.env.DOSESPOT_CLINIC_ID,
        webhookSecret: process.env.DOSESPOT_WEBHOOK_SECRET
      });
    } else {
      this.client = null;
      console.warn('[DoseSpotService] EPRESCRIBE_PROVIDER is not set to "dosespot", service disabled');
    }
  }

  /**
   * Check if service is enabled
   * @returns {boolean}
   */
  isEnabled() {
    return this.client !== null && process.env.EPRESCRIBE_PROVIDER === 'dosespot';
  }

  /**
   * Get or create vendor ID mapping
   * @param {string} entityType - 'patient', 'user', 'pharmacy', 'prescription'
   * @param {string} entityId - Internal entity ID
   * @returns {Promise<string|null>} Vendor ID or null
   */
  async getVendorId(entityType, entityId) {
    if (!this.isEnabled()) return null;

    const client = await pool.connect();
    try {
      const result = await client.query(
        `SELECT vendor_id FROM eprescribe_id_map 
         WHERE entity_type = $1 AND entity_id = $2 AND vendor = 'dosespot'`,
        [entityType, entityId]
      );

      return result.rows[0]?.vendor_id || null;
    } finally {
      client.release();
    }
  }

  /**
   * Store vendor ID mapping
   * @param {string} entityType - 'patient', 'user', 'pharmacy', 'prescription'
   * @param {string} entityId - Internal entity ID
   * @param {string} vendorId - DoseSpot vendor ID
   * @returns {Promise<void>}
   */
  async storeVendorId(entityType, entityId, vendorId) {
    if (!this.isEnabled()) return;

    const client = await pool.connect();
    try {
      await client.query(
        `INSERT INTO eprescribe_id_map (entity_type, entity_id, vendor, vendor_id)
         VALUES ($1, $2, 'dosespot', $3)
         ON CONFLICT (entity_type, entity_id, vendor) 
         DO UPDATE SET vendor_id = $3, updated_at = CURRENT_TIMESTAMP`,
        [entityType, entityId, vendorId]
      );
    } finally {
      client.release();
    }
  }

  /**
   * Ensure patient exists in DoseSpot and return vendor ID
   * @param {string} patientId - Internal patient ID
   * @returns {Promise<string>} Vendor patient ID
   */
  async ensureVendorPatient(patientId) {
    if (!this.isEnabled()) {
      throw new Error('DoseSpot service is not enabled');
    }

    // Check if mapping exists
    let vendorId = await this.getVendorId('patient', patientId);
    if (vendorId) {
      return vendorId;
    }

    // Fetch patient data
    const client = await pool.connect();
    try {
      const result = await client.query(
        `SELECT id, first_name, last_name, date_of_birth, gender, 
                phone, email, address_line1, address_line2, city, state, zip
         FROM patients WHERE id = $1`,
        [patientId]
      );

      if (result.rows.length === 0) {
        throw new Error(`Patient not found: ${patientId}`);
      }

      const patient = result.rows[0];

      // Create/update patient in DoseSpot
      const vendorResponse = await this.client.ensurePatient({
        id: patient.id,
        first_name: patient.first_name,
        last_name: patient.last_name,
        date_of_birth: patient.date_of_birth,
        gender: patient.gender,
        phone: patient.phone,
        email: patient.email,
        address_line1: patient.address_line1,
        address_line2: patient.address_line2,
        city: patient.city,
        state: patient.state,
        zip: patient.zip
      });

      vendorId = vendorResponse.vendor_id;

      // Store mapping
      await this.storeVendorId('patient', patientId, vendorId);

      return vendorId;
    } finally {
      client.release();
    }
  }

  /**
   * Ensure prescriber exists in DoseSpot and return vendor ID
   * @param {string} userId - Internal user ID
   * @returns {Promise<string>} Vendor prescriber ID
   */
  async ensureVendorPrescriber(userId) {
    if (!this.isEnabled()) {
      throw new Error('DoseSpot service is not enabled');
    }

    // Check if mapping exists
    let vendorId = await this.getVendorId('user', userId);
    if (vendorId) {
      return vendorId;
    }

    // Fetch user data
    const client = await pool.connect();
    try {
      const result = await client.query(
        `SELECT id, first_name, last_name, npi, dea_number, 
                license_number, license_state, email, phone
         FROM users WHERE id = $1`,
        [userId]
      );

      if (result.rows.length === 0) {
        throw new Error(`User not found: ${userId}`);
      }

      const user = result.rows[0];

      // Create/update prescriber in DoseSpot
      const vendorResponse = await this.client.ensurePrescriber({
        id: user.id,
        first_name: user.first_name,
        last_name: user.last_name,
        npi: user.npi,
        dea_number: user.dea_number,
        license_number: user.license_number,
        license_state: user.license_state,
        email: user.email,
        phone: user.phone
      });

      vendorId = vendorResponse.vendor_id;

      // Store mapping
      await this.storeVendorId('user', userId, vendorId);

      return vendorId;
    } finally {
      client.release();
    }
  }

  /**
   * Get Single Sign-On URL for embedded prescribing UI
   * @param {Object} params - SSO parameters
   * @param {string} params.userId - Internal user ID
   * @param {string} params.patientId - Internal patient ID
   * @param {string} params.returnUrl - Optional return URL
   * @returns {Promise<{url: string, token?: string}>}
   */
  async getSingleSignOnUrl({ userId, patientId, returnUrl }) {
    if (!this.isEnabled()) {
      throw new Error('DoseSpot service is not enabled');
    }

    // Ensure patient and prescriber exist in DoseSpot
    await this.ensureVendorPatient(patientId);
    await this.ensureVendorPrescriber(userId);

    // Get SSO URL
    const ssoData = await this.client.getSingleSignOnUrl({
      userId,
      patientId,
      returnUrl
    });

    return {
      url: ssoData.url || ssoData.sso_url,
      token: ssoData.token
    };
  }

  /**
   * Search pharmacies
   * @param {string} query - Search query
   * @param {Object} location - Optional location {latitude, longitude, radius}
   * @returns {Promise<Array>}
   */
  async searchPharmacies(query, location = null) {
    if (!this.isEnabled()) {
      throw new Error('DoseSpot service is not enabled');
    }

    return await this.client.searchPharmacies(query, location);
  }

  /**
   * Search medications
   * @param {string} query - Search query
   * @returns {Promise<Array>}
   */
  async searchMedications(query) {
    if (!this.isEnabled()) {
      throw new Error('DoseSpot service is not enabled');
    }

    return await this.client.searchMedications(query);
  }

  /**
   * Create prescription draft
   * @param {Object} prescriptionData - Prescription data
   * @returns {Promise<{prescriptionId: string, vendorMessageId: string}>}
   */
  async createPrescriptionDraft(prescriptionData) {
    if (!this.isEnabled()) {
      throw new Error('DoseSpot service is not enabled');
    }

    const client = await pool.connect();
    try {
      // Get vendor IDs
      const patientVendorId = await this.ensureVendorPatient(prescriptionData.patientId);
      const prescriberVendorId = await this.ensureVendorPrescriber(prescriptionData.prescriberUserId);

      // Create draft in DoseSpot
      const vendorResponse = await this.client.createPrescriptionDraft({
        patient_vendor_id: patientVendorId,
        prescriber_vendor_id: prescriberVendorId,
        medication: prescriptionData.medicationDisplay || prescriptionData.medicationName,
        sig: prescriptionData.sig,
        quantity: prescriptionData.quantity,
        days_supply: prescriptionData.daysSupply,
        refills: prescriptionData.refills,
        pharmacy_vendor_id: prescriptionData.pharmacyVendorId || null
      });

      // Store prescription in our database
      const result = await client.query(
        `INSERT INTO prescriptions (
          patient_id, prescriber_user_id, prescriber_id,
          medication_name, sig, quantity, days_supply, refills,
          status, vendor_message_id, vendor_payload, created_by
        ) VALUES ($1, $2, $2, $3, $4, $5, $6, $7, 'DRAFT', $8, $9, $10)
        RETURNING id`,
        [
          prescriptionData.patientId,
          prescriptionData.prescriberUserId,
          prescriptionData.medicationDisplay || prescriptionData.medicationName,
          prescriptionData.sig,
          prescriptionData.quantity,
          prescriptionData.daysSupply,
          prescriptionData.refills,
          vendorResponse.vendor_message_id,
          JSON.stringify(vendorResponse.vendor_payload),
          prescriptionData.prescriberUserId
        ]
      );

      const prescriptionId = result.rows[0].id;

      // Store vendor mapping
      await this.storeVendorId('prescription', prescriptionId, vendorResponse.vendor_message_id);

      return {
        prescriptionId,
        vendorMessageId: vendorResponse.vendor_message_id
      };
    } finally {
      client.release();
    }
  }

  /**
   * Send prescription
   * @param {string} prescriptionId - Internal prescription ID
   * @returns {Promise<{status: string}>}
   */
  async sendPrescription(prescriptionId) {
    if (!this.isEnabled()) {
      throw new Error('DoseSpot service is not enabled');
    }

    const client = await pool.connect();
    try {
      // Get prescription and vendor ID
      const prescResult = await client.query(
        `SELECT id, vendor_message_id, status FROM prescriptions WHERE id = $1`,
        [prescriptionId]
      );

      if (prescResult.rows.length === 0) {
        throw new Error(`Prescription not found: ${prescriptionId}`);
      }

      const prescription = prescResult.rows[0];
      const vendorId = prescription.vendor_message_id || await this.getVendorId('prescription', prescriptionId);

      if (!vendorId) {
        throw new Error(`Vendor ID not found for prescription: ${prescriptionId}`);
      }

      // Send via DoseSpot
      const vendorResponse = await this.client.sendPrescription(vendorId);

      // Update prescription status
      await client.query(
        `UPDATE prescriptions 
         SET status = $1, vendor_payload = $2, sent_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
         WHERE id = $3`,
        [
          vendorResponse.status,
          JSON.stringify(vendorResponse.vendor_payload),
          prescriptionId
        ]
      );

      return {
        status: vendorResponse.status
      };
    } finally {
      client.release();
    }
  }

  /**
   * Cancel prescription
   * @param {string} prescriptionId - Internal prescription ID
   * @param {string} reason - Cancellation reason
   * @returns {Promise<{status: string}>}
   */
  async cancelPrescription(prescriptionId, reason) {
    if (!this.isEnabled()) {
      throw new Error('DoseSpot service is not enabled');
    }

    const client = await pool.connect();
    try {
      // Get prescription and vendor ID
      const prescResult = await client.query(
        `SELECT id, vendor_message_id FROM prescriptions WHERE id = $1`,
        [prescriptionId]
      );

      if (prescResult.rows.length === 0) {
        throw new Error(`Prescription not found: ${prescriptionId}`);
      }

      const prescription = prescResult.rows[0];
      const vendorId = prescription.vendor_message_id || await this.getVendorId('prescription', prescriptionId);

      if (!vendorId) {
        throw new Error(`Vendor ID not found for prescription: ${prescriptionId}`);
      }

      // Cancel via DoseSpot
      const vendorResponse = await this.client.cancelPrescription(vendorId, reason);

      // Update prescription status
      await client.query(
        `UPDATE prescriptions 
         SET status = $1, vendor_payload = $2, updated_at = CURRENT_TIMESTAMP
         WHERE id = $3`,
        [
          vendorResponse.status,
          JSON.stringify(vendorResponse.vendor_payload),
          prescriptionId
        ]
      );

      return {
        status: vendorResponse.status
      };
    } finally {
      client.release();
    }
  }

  /**
   * Sync prescription status from DoseSpot
   * @param {string} prescriptionId - Internal prescription ID
   * @returns {Promise<{status: string}>}
   */
  async syncPrescriptionStatus(prescriptionId) {
    if (!this.isEnabled()) {
      throw new Error('DoseSpot service is not enabled');
    }

    const client = await pool.connect();
    try {
      // Get prescription and vendor ID
      const prescResult = await client.query(
        `SELECT id, vendor_message_id FROM prescriptions WHERE id = $1`,
        [prescriptionId]
      );

      if (prescResult.rows.length === 0) {
        throw new Error(`Prescription not found: ${prescriptionId}`);
      }

      const prescription = prescResult.rows[0];
      const vendorId = prescription.vendor_message_id || await this.getVendorId('prescription', prescriptionId);

      if (!vendorId) {
        throw new Error(`Vendor ID not found for prescription: ${prescriptionId}`);
      }

      // Get status from DoseSpot
      const vendorResponse = await this.client.getPrescriptionStatus(vendorId);

      // Update prescription status
      await client.query(
        `UPDATE prescriptions 
         SET status = $1, vendor_payload = $2, updated_at = CURRENT_TIMESTAMP
         WHERE id = $3`,
        [
          vendorResponse.status,
          JSON.stringify(vendorResponse.details),
          prescriptionId
        ]
      );

      return {
        status: vendorResponse.status
      };
    } finally {
      client.release();
    }
  }

  /**
   * Handle webhook from DoseSpot
   * @param {Object} payload - Webhook payload
   * @param {string} signature - Webhook signature
   * @returns {Promise<void>}
   */
  async handleWebhook(payload, signature) {
    if (!this.isEnabled()) {
      throw new Error('DoseSpot service is not enabled');
    }

    // Verify signature
    if (!this.client.verifyWebhookSignature(JSON.stringify(payload), signature)) {
      throw new Error('Invalid webhook signature');
    }

    const client = await pool.connect();
    try {
      // Handle different webhook event types
      const eventType = payload.event_type || payload.type;
      const vendorPrescriptionId = payload.prescription_id || payload.id;

      // Find internal prescription ID
      const mappingResult = await client.query(
        `SELECT entity_id FROM eprescribe_id_map 
         WHERE vendor = 'dosespot' AND vendor_id = $1 AND entity_type = 'prescription'`,
        [vendorPrescriptionId]
      );

      if (mappingResult.rows.length === 0) {
        safeLogger.warn('[DoseSpot] Webhook received for unknown prescription', { vendor_id: vendorPrescriptionId });
        return;
      }

      const prescriptionId = mappingResult.rows[0].entity_id;

      // Update prescription based on event
      switch (eventType) {
        case 'prescription_sent':
        case 'sent':
          await client.query(
            `UPDATE prescriptions SET status = 'SENT', sent_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
            [prescriptionId]
          );
          break;

        case 'prescription_cancelled':
        case 'cancelled':
          await client.query(
            `UPDATE prescriptions SET status = 'CANCELLED', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
            [prescriptionId]
          );
          break;

        case 'prescription_filled':
        case 'filled':
          await client.query(
            `UPDATE prescriptions SET status = 'ready', filled_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
            [prescriptionId]
          );
          break;

        case 'prescription_error':
        case 'error':
          await client.query(
            `UPDATE prescriptions SET status = 'ERROR', transmission_error = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
            [payload.error_message || payload.message, prescriptionId]
          );
          break;

        default:
          safeLogger.warn('[DoseSpot] Unknown webhook event type', { event_type: eventType });
      }
    } finally {
      client.release();
    }
  }
}

// Singleton instance
let instance = null;

function getDoseSpotService() {
  if (!instance) {
    instance = new DoseSpotService();
  }
  return instance;
}

module.exports = getDoseSpotService;

