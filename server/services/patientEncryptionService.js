/**
 * Patient PHI Encryption Service
 * 
 * Handles encryption/decryption of PHI fields in patient records
 * Uses envelope encryption via encryptionService
 * 
 * NOTE: Encryption is disabled in development mode (NODE_ENV !== 'production')
 * to allow the app to function without full KMS setup.
 * In production, ENABLE_PHI_ENCRYPTION=true must be set.
 */

const encryptionService = require('./encryptionService');

// Check if encryption is enabled
// Encryption is now DISABLED by default - must explicitly set ENABLE_PHI_ENCRYPTION=true
// This prevents data corruption when KMS isn't properly configured
const ENCRYPTION_ENABLED = process.env.ENABLE_PHI_ENCRYPTION === 'true';

// Fields that contain PHI and should be encrypted
// NOTE: Date fields (dob, insurance_subscriber_dob) are NOT included because
// encryption produces strings that can't be stored in DATE columns.
// To encrypt dates, the columns would need to be changed to TEXT type.
const PHI_FIELDS = [
  'first_name', 'last_name', 'middle_name', 'name_suffix', 'preferred_name',
  // 'dob', 'date_of_birth' - Excluded: DATE columns can't store encrypted strings
  'phone', 'phone_secondary', 'phone_cell', 'phone_work',
  'email', 'email_secondary',
  'address_line1', 'address_line2', 'city', 'state', 'zip', 'country',
  'ssn', 'social_security_number',
  'insurance_id', 'insurance_subscriber_name',
  // 'insurance_subscriber_dob' - Excluded: DATE column
  'emergency_contact_name', 'emergency_contact_phone', 'emergency_contact_address',
  'pharmacy_address', 'pharmacy_phone'
];

// Fields that can remain in plaintext (for search/indexing)
// These are less sensitive or needed for queries
const PLAINTEXT_FIELDS = [
  'mrn', // Medical Record Number - needed for lookup
  'id', 'created_at', 'updated_at', 'primary_care_provider',
  'insurance_provider', 'pharmacy_name', 'pharmacy_npi'
];

/**
 * Encrypt PHI fields in patient object
 * @param {object} patient - Patient object with PHI fields
 * @returns {Promise<object>} Patient object with encrypted PHI fields
 */
async function encryptPatientPHI(patient) {
  if (!patient || typeof patient !== 'object') {
    return patient;
  }

  // Skip encryption in development mode unless explicitly enabled
  if (!ENCRYPTION_ENABLED) {
    console.log('[PHI Encryption] Skipping encryption (development mode)');
    return patient;
  }

  const encrypted = { ...patient };
  const encryptionMetadata = {};

  // Encrypt each PHI field
  for (const field of PHI_FIELDS) {
    const value = patient[field];

    if (value !== null && value !== undefined && value !== '') {
      try {
        const encryptedData = await encryptionService.encryptFieldToBase64(String(value));
        encrypted[field] = encryptedData.ciphertext;
        encryptionMetadata[field] = encryptedData.metadata;
      } catch (error) {
        console.error(`Error encrypting field ${field}:`, error);
        // Check if encryption is enabled - if not, allow plaintext
        const encryptionEnabled = process.env.ENABLE_PHI_ENCRYPTION === 'true';

        if (encryptionEnabled && process.env.NODE_ENV === 'production') {
          // Only fail hard if encryption is explicitly enabled in production
          throw new Error(`Failed to encrypt PHI field: ${field}`);
        }
        // Otherwise, log warning and continue with plaintext
        console.warn(`[PHI Encryption] Encryption failed for ${field}, storing as plaintext. Error: ${error.message}`);
        encrypted[field] = value; // Store as plaintext if encryption fails
      }
    }
  }

  // Store encryption metadata as JSONB
  if (Object.keys(encryptionMetadata).length > 0) {
    encrypted.encryption_metadata = encryptionMetadata;
  }

  return encrypted;
}

/**
 * Decrypt PHI fields in patient object
 * @param {object} patient - Patient object with encrypted PHI fields
 * @returns {Promise<object>} Patient object with decrypted PHI fields
 */
async function decryptPatientPHI(patient) {
  if (!patient || typeof patient !== 'object') {
    return patient;
  }

  const decrypted = { ...patient };
  const encryptionMetadata = patient.encryption_metadata || {};

  // Decrypt each PHI field
  for (const field of PHI_FIELDS) {
    const encryptedValue = patient[field];

    // Only attempt decryption if:
    // 1. Field has a value
    // 2. Encryption metadata exists for this field (indicating it was encrypted)
    // 3. The value looks like encrypted data (base64 string, not plaintext)
    if (encryptedValue && encryptionMetadata[field]) {
      try {
        // Check if value looks encrypted (base64 string, typically longer)
        // Plaintext names/addresses are usually shorter and don't look like base64
        const isLikelyEncrypted = typeof encryptedValue === 'string' &&
          encryptedValue.length > 20 &&
          /^[A-Za-z0-9+/=]+$/.test(encryptedValue);

        if (isLikelyEncrypted) {
          const decryptedValue = await encryptionService.decryptFieldFromBase64(
            encryptedValue,
            encryptionMetadata[field]
          );
          decrypted[field] = decryptedValue;
        }
        // If it doesn't look encrypted, leave it as-is (it's plaintext)
      } catch (error) {
        console.error(`Error decrypting field ${field}:`, error);
        // If decryption fails and we have metadata, the data might be corrupted
        // But if there's no metadata, it's just plaintext - leave it as-is
        if (encryptionMetadata[field]) {
          // Only null out if we expected it to be encrypted
          decrypted[field] = null;
        }
        // Otherwise, leave the plaintext value as-is
      }
    }
    // If no encryption metadata, field is plaintext - leave it as-is
  }

  // Remove encryption metadata from response
  delete decrypted.encryption_metadata;

  return decrypted;
}

/**
 * Decrypt multiple patient records
 * @param {Array<object>} patients - Array of patient objects
 * @returns {Promise<Array<object>>} Array of decrypted patient objects
 */
async function decryptPatientsPHI(patients) {
  if (!Array.isArray(patients)) {
    return patients;
  }

  return Promise.all(patients.map(patient => decryptPatientPHI(patient)));
}

/**
 * Check if a field should be encrypted
 * @param {string} fieldName - Field name to check
 * @returns {boolean} True if field should be encrypted
 */
function isPHIField(fieldName) {
  return PHI_FIELDS.includes(fieldName);
}

/**
 * Prepare patient data for database insertion (encrypt PHI)
 * @param {object} patientData - Patient data from request
 * @returns {Promise<object>} Patient data with encrypted PHI
 */
async function preparePatientForStorage(patientData) {
  return encryptPatientPHI(patientData);
}

/**
 * Prepare patient data for API response (decrypt PHI)
 * @param {object} patientData - Patient data from database
 * @returns {Promise<object>} Patient data with decrypted PHI
 */
async function preparePatientForResponse(patientData) {
  return decryptPatientPHI(patientData);
}

module.exports = {
  encryptPatientPHI,
  decryptPatientPHI,
  decryptPatientsPHI,
  isPHIField,
  preparePatientForStorage,
  preparePatientForResponse,
  PHI_FIELDS,
  PLAINTEXT_FIELDS
};

