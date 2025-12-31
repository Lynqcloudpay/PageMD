/**
 * Patient Name Utilities - Frontend Safeguards
 * 
 * These utilities ensure patient names are NEVER displayed as encrypted gibberish.
 * They provide a last line of defense in case the backend returns encrypted PHI.
 */

/**
 * Check if a string looks like encrypted data (base64 gibberish)
 * @param {string} value - Value to check
 * @returns {boolean} True if the value appears to be encrypted
 */
export function looksEncrypted(value) {
    if (typeof value !== 'string' || !value) return false;

    // Encrypted values are typically:
    // 1. Longer than 30 characters (real names rarely exceed this)
    // 2. Pure base64 characters (A-Za-z0-9+/=)
    // 3. Don't contain spaces (real names usually have spaces)
    // 4. May contain '+' or '/' (common in base64)
    return (
        value.length > 30 &&
        /^[A-Za-z0-9+/=]+$/.test(value) &&
        !value.includes(' ')
    );
}

/**
 * Safely get patient display name with encryption detection
 * ALWAYS use this function when displaying patient names to users.
 * 
 * @param {object} patient - Patient object from API
 * @returns {string} Safe display name (never returns encrypted gibberish)
 */
export function getPatientDisplayName(patient) {
    if (!patient) return 'Unknown Patient';

    // Try pre-computed display_name first
    if (patient.display_name && !looksEncrypted(patient.display_name)) {
        return patient.display_name;
    }

    // Try patientName (used in some API responses)
    if (patient.patientName && !looksEncrypted(patient.patientName)) {
        return patient.patientName;
    }

    // Try full_name
    if (patient.full_name && !looksEncrypted(patient.full_name)) {
        return patient.full_name;
    }

    // Try name (simple format)
    if (patient.name && !looksEncrypted(patient.name)) {
        return patient.name;
    }

    // Build from first_name + last_name
    const firstName = patient.first_name || patient.patient_first_name || '';
    const lastName = patient.last_name || patient.patient_last_name || '';

    // Check if either name component looks encrypted
    if (looksEncrypted(firstName) || looksEncrypted(lastName)) {
        console.error('[PatientNameUtils] Encrypted name detected in frontend!', {
            patientId: patient.id || patient.patient_id,
            firstNameLength: firstName.length,
            lastNameLength: lastName.length,
            firstNameSample: firstName.substring(0, 10) + '...',
        });
        return 'Patient Name Loading...';
    }

    const fullName = `${firstName} ${lastName}`.trim();
    return fullName || 'Unknown Patient';
}

/**
 * Format patient name from first/last components
 * @param {string} firstName - First name
 * @param {string} lastName - Last name
 * @returns {string} Formatted name or fallback
 */
export function formatPatientName(firstName, lastName) {
    if (looksEncrypted(firstName) || looksEncrypted(lastName)) {
        console.error('[PatientNameUtils] Encrypted name detected in formatPatientName');
        return 'Patient Name Loading...';
    }

    const full = `${firstName || ''} ${lastName || ''}`.trim();
    return full || 'Unknown Patient';
}

/**
 * Get patient initials for avatar display
 * @param {object} patient - Patient object
 * @returns {string} Up to 2 character initials
 */
export function getPatientInitials(patient) {
    if (!patient) return '??';

    const name = getPatientDisplayName(patient);

    if (name === 'Unknown Patient' || name === 'Patient Name Loading...') {
        return '??';
    }

    const parts = name.split(' ').filter(Boolean);
    if (parts.length >= 2) {
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    } else if (parts.length === 1) {
        return parts[0].substring(0, 2).toUpperCase();
    }

    return '??';
}
