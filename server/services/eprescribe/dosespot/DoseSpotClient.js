/**
 * DoseSpot HTTP Client
 * 
 * Production-grade HTTP client for DoseSpot ePrescribing API with:
 * - Strict timeouts
 * - Retry on transient errors (429/5xx)
 * - Idempotency keys for send operations
 * - Structured logging (no PHI in logs)
 * - OAuth2 authentication
 */

const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

class DoseSpotClient {
  constructor(config) {
    this.baseURL = config.baseURL || process.env.DOSESPOT_BASE_URL;
    this.clientId = config.clientId || process.env.DOSESPOT_CLIENT_ID;
    this.clientSecret = config.clientSecret || process.env.DOSESPOT_CLIENT_SECRET;
    this.clinicId = config.clinicId || process.env.DOSESPOT_CLINIC_ID;
    this.webhookSecret = config.webhookSecret || process.env.DOSESPOT_WEBHOOK_SECRET;
    
    // Timeout configuration
    this.timeout = config.timeout || 30000; // 30 seconds
    this.retryMaxAttempts = config.retryMaxAttempts || 3;
    this.retryDelay = config.retryDelay || 1000; // 1 second base delay
    
    // OAuth token cache
    this.accessToken = null;
    this.tokenExpiresAt = null;
    
    // Create axios instance with defaults
    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: this.timeout,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });

    // Request interceptor for auth
    this.client.interceptors.request.use(
      async (config) => {
        // Add auth token if available
        if (this.accessToken && this.tokenExpiresAt && Date.now() < this.tokenExpiresAt) {
          config.headers.Authorization = `Bearer ${this.accessToken}`;
        } else {
          await this.authenticate();
          if (this.accessToken) {
            config.headers.Authorization = `Bearer ${this.accessToken}`;
          }
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor for retries
    this.client.interceptors.response.use(
      (response) => response,
      async (error) => {
        const config = error.config;
        
        // Don't retry if already retried or not a retryable error
        if (config.__retryCount >= this.retryMaxAttempts) {
          return Promise.reject(error);
        }

        // Retry on 429 (rate limit) or 5xx errors
        if (error.response && (
          error.response.status === 429 ||
          (error.response.status >= 500 && error.response.status < 600)
        )) {
          config.__retryCount = config.__retryCount || 0;
          config.__retryCount += 1;

          // Exponential backoff
          const delay = this.retryDelay * Math.pow(2, config.__retryCount - 1);
          
          // Log retry (no PHI)
          console.log(`[DoseSpot] Retrying request (attempt ${config.__retryCount}/${this.retryMaxAttempts}) after ${delay}ms`, {
            url: config.url,
            method: config.method,
            status: error.response?.status
          });

          await new Promise(resolve => setTimeout(resolve, delay));
          
          // Refresh token if expired
          if (error.response?.status === 401) {
            await this.authenticate();
          }
          
          return this.client(config);
        }

        return Promise.reject(error);
      }
    );
  }

  /**
   * Authenticate with DoseSpot OAuth2
   * @returns {Promise<string>} Access token
   */
  async authenticate() {
    try {
      const response = await axios.post(
        `${this.baseURL}/oauth/token`,
        {
          grant_type: 'client_credentials',
          client_id: this.clientId,
          client_secret: this.clientSecret,
          scope: 'eprescribe'
        },
        {
          timeout: this.timeout,
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );

      this.accessToken = response.data.access_token;
      // Set expiration (subtract 60 seconds for safety margin)
      const expiresIn = (response.data.expires_in || 3600) - 60;
      this.tokenExpiresAt = Date.now() + (expiresIn * 1000);

      console.log('[DoseSpot] Authentication successful');
      return this.accessToken;
    } catch (error) {
      console.error('[DoseSpot] Authentication failed:', {
        status: error.response?.status,
        message: error.message
      });
      throw new Error('DoseSpot authentication failed');
    }
  }

  /**
   * Generate idempotency key for send operations
   * @returns {string}
   */
  generateIdempotencyKey() {
    return `ds-${uuidv4()}`;
  }

  /**
   * Log request/response (no PHI)
   * @param {string} method - HTTP method
   * @param {string} endpoint - API endpoint
   * @param {number} status - HTTP status code
   * @param {Error} error - Error if any
   */
  logRequest(method, endpoint, status, error = null) {
    const logData = {
      provider: 'dosespot',
      method,
      endpoint,
      status,
      timestamp: new Date().toISOString()
    };

    if (error) {
      logData.error = {
        message: error.message,
        code: error.code
      };
      console.error('[DoseSpot] Request failed:', logData);
    } else {
      console.log('[DoseSpot] Request successful:', logData);
    }
  }

  /**
   * Get Single Sign-On URL for embedded prescribing UI
   * @param {Object} params - SSO parameters
   * @param {string} params.userId - Internal user ID
   * @param {string} params.patientId - Internal patient ID
   * @param {string} params.returnUrl - Return URL after completion
   * @returns {Promise<{url: string, token: string}>}
   */
  async getSingleSignOnUrl({ userId, patientId, returnUrl }) {
    try {
      const response = await this.client.post('/api/v1/sso/url', {
        clinic_id: this.clinicId,
        user_id: userId,
        patient_id: patientId,
        return_url: returnUrl || `${process.env.FRONTEND_URL || 'https://bemypcp.com'}/patient/${patientId}`,
        mode: 'embedded' // Embedded iframe mode
      });

      this.logRequest('POST', '/api/v1/sso/url', response.status);
      return response.data;
    } catch (error) {
      this.logRequest('POST', '/api/v1/sso/url', error.response?.status, error);
      throw error;
    }
  }

  /**
   * Ensure patient exists in DoseSpot (create or update)
   * @param {Object} patientData - Patient data
   * @returns {Promise<{vendor_id: string}>}
   */
  async ensurePatient(patientData) {
    try {
      const response = await this.client.post('/api/v1/patients', {
        clinic_id: this.clinicId,
        external_id: patientData.id,
        first_name: patientData.first_name,
        last_name: patientData.last_name,
        date_of_birth: patientData.date_of_birth,
        gender: patientData.gender,
        phone: patientData.phone,
        email: patientData.email,
        address: {
          line1: patientData.address_line1,
          line2: patientData.address_line2,
          city: patientData.city,
          state: patientData.state,
          zip: patientData.zip
        }
      });

      this.logRequest('POST', '/api/v1/patients', response.status);
      return { vendor_id: response.data.patient_id || response.data.id };
    } catch (error) {
      this.logRequest('POST', '/api/v1/patients', error.response?.status, error);
      throw error;
    }
  }

  /**
   * Ensure prescriber exists in DoseSpot (create or update)
   * @param {Object} prescriberData - Prescriber data
   * @returns {Promise<{vendor_id: string}>}
   */
  async ensurePrescriber(prescriberData) {
    try {
      const response = await this.client.post('/api/v1/prescribers', {
        clinic_id: this.clinicId,
        external_id: prescriberData.id,
        first_name: prescriberData.first_name,
        last_name: prescriberData.last_name,
        npi: prescriberData.npi,
        dea: prescriberData.dea_number,
        license_number: prescriberData.license_number,
        license_state: prescriberData.license_state,
        email: prescriberData.email,
        phone: prescriberData.phone
      });

      this.logRequest('POST', '/api/v1/prescribers', response.status);
      return { vendor_id: response.data.prescriber_id || response.data.id };
    } catch (error) {
      this.logRequest('POST', '/api/v1/prescribers', error.response?.status, error);
      throw error;
    }
  }

  /**
   * Search pharmacies
   * @param {string} query - Search query
   * @param {Object} location - Optional location {latitude, longitude, radius}
   * @returns {Promise<Array>}
   */
  async searchPharmacies(query, location = null) {
    try {
      const params = {
        clinic_id: this.clinicId,
        query
      };

      if (location) {
        params.latitude = location.latitude;
        params.longitude = location.longitude;
        params.radius = location.radius || 25; // miles
      }

      const response = await this.client.get('/api/v1/pharmacies/search', { params });
      this.logRequest('GET', '/api/v1/pharmacies/search', response.status);
      return response.data.pharmacies || response.data || [];
    } catch (error) {
      this.logRequest('GET', '/api/v1/pharmacies/search', error.response?.status, error);
      throw error;
    }
  }

  /**
   * Search medications
   * @param {string} query - Search query
   * @returns {Promise<Array>}
   */
  async searchMedications(query) {
    try {
      const response = await this.client.get('/api/v1/medications/search', {
        params: {
          clinic_id: this.clinicId,
          query
        }
      });
      this.logRequest('GET', '/api/v1/medications/search', response.status);
      return response.data.medications || response.data || [];
    } catch (error) {
      this.logRequest('GET', '/api/v1/medications/search', error.response?.status, error);
      throw error;
    }
  }

  /**
   * Create prescription draft in DoseSpot
   * @param {Object} prescriptionData - Prescription data
   * @returns {Promise<{vendor_message_id: string}>}
   */
  async createPrescriptionDraft(prescriptionData) {
    try {
      const idempotencyKey = this.generateIdempotencyKey();
      const response = await this.client.post('/api/v1/prescriptions/draft', {
        clinic_id: this.clinicId,
        patient_id: prescriptionData.patient_vendor_id,
        prescriber_id: prescriptionData.prescriber_vendor_id,
        medication: prescriptionData.medication,
        sig: prescriptionData.sig,
        quantity: prescriptionData.quantity,
        days_supply: prescriptionData.days_supply,
        refills: prescriptionData.refills,
        pharmacy_id: prescriptionData.pharmacy_vendor_id
      }, {
        headers: {
          'Idempotency-Key': idempotencyKey
        }
      });

      this.logRequest('POST', '/api/v1/prescriptions/draft', response.status);
      return {
        vendor_message_id: response.data.prescription_id || response.data.id,
        vendor_payload: response.data
      };
    } catch (error) {
      this.logRequest('POST', '/api/v1/prescriptions/draft', error.response?.status, error);
      throw error;
    }
  }

  /**
   * Send prescription
   * @param {string} prescriptionVendorId - DoseSpot prescription ID
   * @param {string} idempotencyKey - Optional idempotency key
   * @returns {Promise<{status: string, vendor_message_id: string}>}
   */
  async sendPrescription(prescriptionVendorId, idempotencyKey = null) {
    try {
      const key = idempotencyKey || this.generateIdempotencyKey();
      const response = await this.client.post(
        `/api/v1/prescriptions/${prescriptionVendorId}/send`,
        {
          clinic_id: this.clinicId
        },
        {
          headers: {
            'Idempotency-Key': key
          }
        }
      );

      this.logRequest('POST', `/api/v1/prescriptions/${prescriptionVendorId}/send`, response.status);
      return {
        status: response.data.status || 'SENT',
        vendor_message_id: prescriptionVendorId,
        vendor_payload: response.data
      };
    } catch (error) {
      this.logRequest('POST', `/api/v1/prescriptions/${prescriptionVendorId}/send`, error.response?.status, error);
      throw error;
    }
  }

  /**
   * Cancel prescription
   * @param {string} prescriptionVendorId - DoseSpot prescription ID
   * @param {string} reason - Cancellation reason
   * @returns {Promise<{status: string}>}
   */
  async cancelPrescription(prescriptionVendorId, reason) {
    try {
      const response = await this.client.post(
        `/api/v1/prescriptions/${prescriptionVendorId}/cancel`,
        {
          clinic_id: this.clinicId,
          reason: reason || 'Prescriber request'
        }
      );

      this.logRequest('POST', `/api/v1/prescriptions/${prescriptionVendorId}/cancel`, response.status);
      return {
        status: response.data.status || 'CANCELLED',
        vendor_payload: response.data
      };
    } catch (error) {
      this.logRequest('POST', `/api/v1/prescriptions/${prescriptionVendorId}/cancel`, error.response?.status, error);
      throw error;
    }
  }

  /**
   * Get prescription status
   * @param {string} prescriptionVendorId - DoseSpot prescription ID
   * @returns {Promise<{status: string, details: Object}>}
   */
  async getPrescriptionStatus(prescriptionVendorId) {
    try {
      const response = await this.client.get(
        `/api/v1/prescriptions/${prescriptionVendorId}/status`,
        {
          params: {
            clinic_id: this.clinicId
          }
        }
      );

      this.logRequest('GET', `/api/v1/prescriptions/${prescriptionVendorId}/status`, response.status);
      return {
        status: response.data.status,
        details: response.data
      };
    } catch (error) {
      this.logRequest('GET', `/api/v1/prescriptions/${prescriptionVendorId}/status`, error.response?.status, error);
      throw error;
    }
  }

  /**
   * Verify webhook signature
   * @param {string} payload - Webhook payload
   * @param {string} signature - Webhook signature
   * @returns {boolean}
   */
  verifyWebhookSignature(payload, signature) {
    // Implement HMAC verification based on DoseSpot webhook docs
    // For now, return true if webhook secret is configured
    if (!this.webhookSecret) {
      console.warn('[DoseSpot] Webhook secret not configured, skipping signature verification');
      return true;
    }

    // TODO: Implement actual HMAC verification
    // const crypto = require('crypto');
    // const expectedSignature = crypto
    //   .createHmac('sha256', this.webhookSecret)
    //   .update(payload)
    //   .digest('hex');
    // return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));

    return true; // Placeholder
  }
}

module.exports = DoseSpotClient;

