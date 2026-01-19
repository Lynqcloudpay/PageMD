/**
 * Patient Name Utility Service
 * 
 * Provides a single, consistent way to get patient display names
 * that ALWAYS returns the correct decrypted/formatted name.
 * 
 * This utility prevents encrypted PHI from ever being displayed to users.
 */

const { decryptPatientPHI, PHI_FIELDS } = require('./patientEncryptionService');
const pool = require('../db');

/**
 * Check if a string looks like it's encrypted (base64 gibberish)
 * @param {string} value - Value to check
 * @returns {boolean} True if likely encrypted
 */
function looksEncrypted(value) {
    if (typeof value !== 'string' || !value) return false;

    // Encrypted values are typically:
    // 1. Longer than 20 characters
    // 2. Pure base64 characters (A-Za-z0-9+/=)
    // 3. Don't contain spaces (real names have spaces)
    return value.length > 30 &&
        /^[A-Za-z0-9+/=]+$/.test(value) &&
        !value.includes(' ');
}

/**
 * Safely get patient display name, with encryption detection failsafe
 * @param {object} patient - Patient object (may have encrypted or decrypted fields)
 * @returns {string} Safe display name (never returns encrypted gibberish)
 */
function getPatientDisplayName(patient) {
    if (!patient) return 'Unknown Patient';

    // Check for pre-computed display_name first
    if (patient.display_name && !looksEncrypted(patient.display_name)) {
        return patient.display_name;
    }

    // Check for full_name
    if (patient.full_name && !looksEncrypted(patient.full_name)) {
        return patient.full_name;
    }

    // Build from first_name + last_name
    const firstName = patient.first_name || patient.patient_first_name || '';
    const lastName = patient.last_name || patient.patient_last_name || '';

    // Check if names look encrypted
    if (looksEncrypted(firstName) || looksEncrypted(lastName)) {
        console.warn('[PatientNameUtils] Detected encrypted name being displayed!', {
            patientId: patient.id || patient.patient_id,
            firstNameLength: firstName.length,
            lastNameLength: lastName.length
        });
        return 'Patient Name Loading...'; // Safe fallback
    }

    const fullName = `${firstName} ${lastName}`.trim();
    return fullName || 'Unknown Patient';
}

/**
 * Fetch patient with decrypted PHI for display
 * This is the ONLY safe way to get patient data for API responses
 * @param {string} patientId - Patient UUID
 * @returns {Promise<object>} Patient with decrypted PHI
 */
async function getPatientForDisplay(patientId) {
    const result = await pool.query(
        `SELECT * FROM patients WHERE id = $1`,
        [patientId]
    );

    if (result.rows.length === 0) {
        return null;
    }

    // ALWAYS decrypt before returning
    return decryptPatientPHI(result.rows[0]);
}

/**
 * Get just the patient name fields (decrypted) for efficient joins
 * Use this when you only need the name, not full patient data
 * @param {string} patientId - Patient UUID
 * @returns {Promise<{first_name: string, last_name: string, display_name: string}>}
 */
async function getPatientNameFields(patientId) {
    const result = await pool.query(
        `SELECT id, first_name, last_name, encryption_metadata FROM patients WHERE id = $1`,
        [patientId]
    );

    if (result.rows.length === 0) {
        return { first_name: '', last_name: '', display_name: 'Unknown Patient' };
    }

    const decrypted = await decryptPatientPHI(result.rows[0]);
    return {
        first_name: decrypted.first_name || '',
        last_name: decrypted.last_name || '',
        display_name: getPatientDisplayName(decrypted)
    };
}

/**
 * Batch decrypt patient names for a list of records that have patient_id
 * @param {Array} records - Records with patient_id field
 * @returns {Promise<Map<string, object>>} Map of patient_id -> {first_name, last_name, display_name}
 */
async function batchGetPatientNames(patientIds) {
    if (!patientIds || patientIds.length === 0) {
        return new Map();
    }

    // Deduplicate
    const uniqueIds = [...new Set(patientIds.filter(Boolean))];

    const result = await pool.query(
        `SELECT id, first_name, last_name, dob, mrn, encryption_metadata 
     FROM patients 
     WHERE id = ANY($1)`,
        [uniqueIds]
    );

    const nameMap = new Map();

    for (const row of result.rows) {
        const decrypted = await decryptPatientPHI(row);
        nameMap.set(row.id, {
            first_name: decrypted.first_name || '',
            last_name: decrypted.last_name || '',
            display_name: getPatientDisplayName(decrypted),
            dob: decrypted.dob,
            mrn: decrypted.mrn
        });
    }

    return nameMap;
}

/**
 * Enrich records with decrypted patient names
 * Use this to post-process query results that include patient_id
 * @param {Array} records - Records with patient_id field
 * @param {string} idField - Name of the patient ID field (default: 'patient_id')
 * @returns {Promise<Array>} Records with patientName and patient name fields populated
 */
async function enrichWithPatientNames(records, idField = 'patient_id') {
    if (!records || records.length === 0) {
        return records;
    }

    const patientIds = records.map(r => r[idField]).filter(Boolean);
    const nameMap = await batchGetPatientNames(patientIds);

    return records.map(record => {
        const patientId = record[idField];
        const names = nameMap.get(patientId) || { display_name: 'Unknown Patient', first_name: '', last_name: '', dob: '', mrn: '' };

        return {
            ...record,
            patientName: names.display_name,
            patient_first_name: names.first_name,
            patient_last_name: names.last_name,
            patient_dob: names.dob,
            patient_mrn: names.mrn
        };
    });
}

module.exports = {
    looksEncrypted,
    getPatientDisplayName,
    getPatientForDisplay,
    getPatientNameFields,
    batchGetPatientNames,
    enrichWithPatientNames,
};
