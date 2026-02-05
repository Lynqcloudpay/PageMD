/**
 * E-Prescribing Service Abstraction
 * 
 * Routes prescription operations to the configured provider:
 * - 'dosespot' -> DoseSpotService
 * - 'internal' or unset -> Internal prescription engine (existing routes)
 */
const { simulate } = require('../simulationInterceptor');

// Lazy load DoseSpotService to prevent startup failures if not configured
let getDoseSpotService = null;
function getDoseSpotServiceSafe() {
  if (!getDoseSpotService) {
    try {
      getDoseSpotService = require('./dosespot/DoseSpotService');
    } catch (error) {
      console.warn('[EPrescribeService] Failed to load DoseSpotService:', error.message);
      return null;
    }
  }
  return getDoseSpotService();
}

class EPrescribeService {
  constructor() {
    this.provider = process.env.EPRESCRIBE_PROVIDER || 'internal';
    try {
      this.dosespotService = getDoseSpotServiceSafe();
    } catch (error) {
      console.warn('[EPrescribeService] DoseSpotService initialization failed:', error.message);
      this.dosespotService = null;
    }
  }

  /**
   * Get the active provider
   * @returns {string} 'dosespot' | 'internal'
   */
  getProvider() {
    return this.provider;
  }

  /**
   * Check if DoseSpot is enabled
   * @returns {boolean}
   */
  isDoseSpotEnabled() {
    return this.provider === 'dosespot' && this.dosespotService && this.dosespotService.isEnabled();
  }

  /**
   * Check if EPCS is enabled
   * @returns {boolean}
   */
  isEPCSEnabled() {
    return process.env.EPRESCRIBE_EPCS_ENABLED === 'true';
  }

  /**
   * Validate EPCS requirements for controlled substances
   * @param {Object} prescriptionData - Prescription data
   * @param {Object} prescriber - Prescriber user object
   * @returns {Promise<{valid: boolean, error?: string}>}
   */
  async validateEPCS(prescriptionData, prescriber) {
    // Only check if EPCS is enabled and medication is controlled
    if (!this.isEPCSEnabled() || !prescriptionData.isControlled) {
      return { valid: true };
    }

    // EPCS requires:
    // 1. DEA number
    if (!prescriber.dea_number && !prescriber.dea) {
      return {
        valid: false,
        error: 'DEA number is required for controlled substance prescriptions (EPCS)'
      };
    }

    // 2. EPCS enrollment (check with DoseSpot if enabled)
    if (this.isDoseSpotEnabled()) {
      try {
        // Verify prescriber is EPCS enrolled in DoseSpot
        const vendorId = await this.dosespotService.getVendorId('user', prescriber.id);
        if (!vendorId) {
          return {
            valid: false,
            error: 'Prescriber must be enrolled in EPCS before prescribing controlled substances'
          };
        }

        // TODO: Add actual EPCS enrollment check via DoseSpot API
        // For now, we assume enrollment if vendor ID exists
      } catch (error) {
        return {
          valid: false,
          error: 'Failed to verify EPCS enrollment'
        };
      }
    }

    return { valid: true };
  }

  /**
   * Get SSO URL for embedded prescribing UI
   * @param {Object} params - SSO parameters
   * @returns {Promise<{url: string, token?: string}>}
   */
  async getSingleSignOnUrl(params) {
    if (this.isDoseSpotEnabled()) {
      return await this.dosespotService.getSingleSignOnUrl(params);
    }
    throw new Error('Embedded prescribing UI only available with DoseSpot provider');
  }

  /**
   * Create prescription draft
   * Routes to appropriate provider
   * @param {Object} prescriptionData - Prescription data
   * @returns {Promise<{prescriptionId: string, vendorMessageId?: string}>}
   */
  async createPrescriptionDraft(prescriptionData) {
    const simulated = simulate('EPrescribe', 'createPrescriptionDraft', {
      prescriptionId: 'sim-' + Math.random().toString(36).substr(2, 9),
      vendorMessageId: 'sim-msg-' + Date.now()
    });
    if (simulated) return simulated;

    if (this.isDoseSpotEnabled()) {
      return await this.dosespotService.createPrescriptionDraft(prescriptionData);
    }
    // Internal engine: return null to use existing /api/prescriptions/create route
    return null;
  }

  /**
   * Send prescription
   * Routes to appropriate provider
   * @param {string} prescriptionId - Internal prescription ID
   * @returns {Promise<{status: string}>}
   */
  async sendPrescription(prescriptionId) {
    const simulated = simulate('EPrescribe', 'sendPrescription', { status: 'SENT' });
    if (simulated) return simulated;

    if (this.isDoseSpotEnabled()) {
      return await this.dosespotService.sendPrescription(prescriptionId);
    }
    // Internal engine: return null to use existing /api/prescriptions/:id/send route
    return null;
  }

  /**
   * Cancel prescription
   * Routes to appropriate provider
   * @param {string} prescriptionId - Internal prescription ID
   * @param {string} reason - Cancellation reason
   * @returns {Promise<{status: string}>}
   */
  async cancelPrescription(prescriptionId, reason) {
    if (this.isDoseSpotEnabled()) {
      return await this.dosespotService.cancelPrescription(prescriptionId, reason);
    }
    // Internal engine: just update status in DB
    const pool = require('../db');
    const client = await pool.connect();
    try {
      await client.query(
        `UPDATE prescriptions SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
        [prescriptionId]
      );
      return { status: 'CANCELLED' };
    } finally {
      client.release();
    }
  }

  /**
   * Search pharmacies
   * @param {string} query - Search query
   * @param {Object} location - Optional location
   * @returns {Promise<Array>}
   */
  async searchPharmacies(query, location) {
    if (this.isDoseSpotEnabled()) {
      return await this.dosespotService.searchPharmacies(query, location);
    }
    // Fallback to internal pharmacy service
    const pharmacyService = require('../pharmacy');
    return await pharmacyService.searchPharmacies(query, location);
  }

  /**
   * Search medications
   * @param {string} query - Search query
   * @returns {Promise<Array>}
   */
  async searchMedications(query) {
    if (this.isDoseSpotEnabled()) {
      return await this.dosespotService.searchMedications(query);
    }
    // Fallback to internal RxNorm service
    const rxnormService = require('../rxnorm');
    return await rxnormService.searchMedications(query);
  }
}

// Singleton instance
let instance = null;

function getEPrescribeService() {
  if (!instance) {
    instance = new EPrescribeService();
  }
  return instance;
}

module.exports = getEPrescribeService;

