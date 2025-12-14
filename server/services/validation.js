/**
 * Validation Service
 * 
 * Provides validation utilities for:
 * - NPI (National Provider Identifier) validation
 * - DEA (Drug Enforcement Administration) number validation
 * - Controlled substance schedule validation
 * - Prescription workflow validation
 */

const axios = require('axios');

// NPI Registry API
const NPI_API_URL = process.env.NPI_API_URL || 'https://npiregistry.cms.hhs.gov/api';

/**
 * Validate NPI (National Provider Identifier)
 * NPI format: 10 digits, first digit is 1 or 2
 * Uses Luhn algorithm check digit
 * @param {string} npi - NPI to validate
 * @returns {Object} {valid: boolean, error?: string}
 */
function validateNPI(npi) {
  if (!npi || typeof npi !== 'string') {
    return { valid: false, error: 'NPI is required' };
  }

  // Remove any spaces or dashes
  const cleaned = npi.replace(/[\s-]/g, '');

  // Must be exactly 10 digits
  if (!/^\d{10}$/.test(cleaned)) {
    return { valid: false, error: 'NPI must be exactly 10 digits' };
  }

  // First digit must be 1 or 2
  if (cleaned[0] !== '1' && cleaned[0] !== '2') {
    return { valid: false, error: 'NPI must start with 1 or 2' };
  }

  // Luhn algorithm check
  if (!luhnCheck(cleaned)) {
    return { valid: false, error: 'NPI failed Luhn algorithm check' };
  }

  return { valid: true };
}

/**
 * Validate DEA (Drug Enforcement Administration) number
 * Format: 2 letters + 7 digits, uses check digit algorithm
 * @param {string} dea - DEA number to validate
 * @returns {Object} {valid: boolean, error?: string}
 */
function validateDEA(dea) {
  if (!dea || typeof dea !== 'string') {
    return { valid: false, error: 'DEA number is required' };
  }

  // Remove spaces and convert to uppercase
  const cleaned = dea.replace(/\s/g, '').toUpperCase();

  // Format: 2 letters followed by 7 digits
  if (!/^[A-Z]{2}\d{7}$/.test(cleaned)) {
    return { valid: false, error: 'DEA number must be 2 letters followed by 7 digits' };
  }

  // Check digit validation
  const firstLetter = cleaned[0];
  const secondLetter = cleaned[1];
  const digits = cleaned.substring(2);
  
  // First letter must be A, B, F, M, P, or R
  const validFirstLetters = ['A', 'B', 'F', 'M', 'P', 'R'];
  if (!validFirstLetters.includes(firstLetter)) {
    return { valid: false, error: `Invalid DEA prefix. Must be one of: ${validFirstLetters.join(', ')}` };
  }

  // Second letter should match prescriber's last name initial (optional check)
  // Check digit algorithm
  const sum = parseInt(digits[0]) + 
              parseInt(digits[2]) + 
              parseInt(digits[4]) + 
              (parseInt(digits[1]) + parseInt(digits[3]) + parseInt(digits[5])) * 2;
  const checkDigit = sum % 10;
  const providedCheckDigit = parseInt(digits[6]);

  if (checkDigit !== providedCheckDigit) {
    return { valid: false, error: 'DEA check digit validation failed' };
  }

  return { valid: true };
}

/**
 * Verify NPI exists in NPI Registry
 * @param {string} npi - NPI to verify
 * @returns {Promise<Object>} {valid: boolean, verified: boolean, data?: object}
 */
async function verifyNPI(npi) {
  const validation = validateNPI(npi);
  if (!validation.valid) {
    return { valid: false, verified: false, error: validation.error };
  }

  try {
    const response = await axios.get(NPI_API_URL, {
      params: {
        version: '2.1',
        number: npi
      },
      timeout: 5000
    });

    const results = response.data?.results;
    if (!results || results.length === 0) {
      return { valid: true, verified: false, error: 'NPI not found in registry' };
    }

    return {
      valid: true,
      verified: true,
      data: {
        npi: results[0].number,
        name: results[0].basic?.organization_name || 
              `${results[0].basic?.first_name || ''} ${results[0].basic?.last_name || ''}`.trim(),
        type: results[0].enumeration_type,
        status: results[0].basic?.status,
        taxonomy: results[0].taxonomies?.[0]?.desc
      }
    };

  } catch (error) {
    console.error('NPI verification error:', error.message);
    return { valid: true, verified: false, error: 'Could not verify NPI with registry' };
  }
}

/**
 * Check if controlled substance prescription requires DEA
 * @param {string} schedule - Controlled substance schedule (C-II, C-III, C-IV, C-V)
 * @param {string} deaNumber - Prescriber's DEA number
 * @returns {Object} {requiresDEA: boolean, error?: string}
 */
function validateControlledSubstancePrescription(schedule, deaNumber) {
  if (!schedule) {
    return { requiresDEA: false };
  }

  // All controlled substances require DEA number
  if (['C-II', 'C-III', 'C-IV', 'C-V'].includes(schedule)) {
    if (!deaNumber) {
      return {
        requiresDEA: true,
        error: `Schedule ${schedule} controlled substance requires a valid DEA number`
      };
    }

    const deaValidation = validateDEA(deaNumber);
    if (!deaValidation.valid) {
      return {
        requiresDEA: true,
        error: `Invalid DEA number for controlled substance prescription: ${deaValidation.error}`
      };
    }

    return { requiresDEA: true, valid: true };
  }

  return { requiresDEA: false };
}

/**
 * Validate prescription sig (instructions)
 * @param {Object} sig - Structured sig object
 * @returns {Object} {valid: boolean, error?: string, parsed?: object}
 */
function validatePrescriptionSig(sig) {
  if (!sig) {
    return { valid: false, error: 'Prescription instructions are required' };
  }

  const errors = [];

  // Check required fields
  if (!sig.dose || !sig.dose.trim()) {
    errors.push('Dose is required');
  }

  if (!sig.frequency || !sig.frequency.trim()) {
    errors.push('Frequency is required');
  }

  if (!sig.route || !sig.route.trim()) {
    errors.push('Route is required');
  }

  // Validate dose format (number + unit)
  if (sig.dose && !/^\d+(\.\d+)?\s*(MG|MCG|G|ML|IU|MEQ|TAB|CAP|PUFF|DROP|SPRAY|UNIT)\b/i.test(sig.dose)) {
    errors.push('Dose format is invalid. Use format like "10 MG" or "1 TAB"');
  }

  if (errors.length > 0) {
    return { valid: false, error: errors.join('; ') };
  }

  return { valid: true };
}

/**
 * Validate prescription quantity
 * @param {number} quantity - Quantity to validate
 * @param {string} unit - Unit of measurement
 * @returns {Object} {valid: boolean, error?: string}
 */
function validatePrescriptionQuantity(quantity, unit = 'EA') {
  if (!quantity || isNaN(quantity) || quantity <= 0) {
    return { valid: false, error: 'Quantity must be a positive number' };
  }

  if (!Number.isInteger(quantity)) {
    return { valid: false, error: 'Quantity must be a whole number' };
  }

  // Reasonable upper limit
  if (quantity > 9999) {
    return { valid: false, error: 'Quantity exceeds maximum allowed (9999)' };
  }

  return { valid: true };
}

/**
 * Validate prescription refills
 * @param {number} refills - Number of refills
 * @param {string} schedule - Controlled substance schedule (if applicable)
 * @returns {Object} {valid: boolean, error?: string}
 */
function validatePrescriptionRefills(refills, schedule = null) {
  if (refills === null || refills === undefined || isNaN(refills)) {
    return { valid: false, error: 'Refills must be a number' };
  }

  if (refills < 0 || refills > 11) {
    return { valid: false, error: 'Refills must be between 0 and 11' };
  }

  // Schedule II controlled substances cannot have refills
  if (schedule === 'C-II' && refills > 0) {
    return { valid: false, error: 'Schedule II controlled substances cannot have refills' };
  }

  return { valid: true };
}

/**
 * Luhn algorithm check for NPI validation
 * @param {string} number - Number to check
 * @returns {boolean} True if valid
 */
function luhnCheck(number) {
  const digits = number.split('').map(Number).reverse();
  let sum = 0;

  for (let i = 0; i < digits.length; i++) {
    let digit = digits[i];
    
    // Double every other digit starting from second
    if (i % 2 === 1) {
      digit *= 2;
      if (digit > 9) {
        digit -= 9;
      }
    }
    
    sum += digit;
  }

  return sum % 10 === 0;
}

/**
 * Format NPI for display (adds space: 1234567890 -> 1234567890)
 */
function formatNPI(npi) {
  if (!npi) return '';
  const cleaned = npi.replace(/[\s-]/g, '');
  if (cleaned.length === 10) {
    return cleaned; // Keep as 10 digits
  }
  return cleaned;
}

/**
 * Format DEA for display (adds space: AB1234567 -> AB 1234567)
 */
function formatDEA(dea) {
  if (!dea) return '';
  const cleaned = dea.replace(/\s/g, '').toUpperCase();
  if (cleaned.length === 9) {
    return `${cleaned.substring(0, 2)} ${cleaned.substring(2)}`;
  }
  return cleaned;
}

module.exports = {
  validateNPI,
  validateDEA,
  verifyNPI,
  validateControlledSubstancePrescription,
  validatePrescriptionSig,
  validatePrescriptionQuantity,
  validatePrescriptionRefills,
  formatNPI,
  formatDEA
};






