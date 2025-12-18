/**
 * Timezone utilities for clinic operations
 * All dates should be computed in clinic timezone (America/New_York)
 */

/**
 * Get today's date in clinic timezone (America/New_York)
 * Returns a Date object set to midnight in the clinic timezone
 */
function getTodayInClinicTimezone() {
  // Get current time in America/New_York
  const now = new Date();
  const clinicTimezone = 'America/New_York';
  
  // Format: YYYY-MM-DD in clinic timezone
  const dateStr = now.toLocaleDateString('en-US', {
    timeZone: clinicTimezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  
  // Parse back to Date object (this will be in local server timezone, but date part is correct)
  const [month, day, year] = dateStr.split('/');
  const clinicDate = new Date(`${year}-${month}-${day}T00:00:00`);
  
  return clinicDate;
}

/**
 * Get today's date as a DATE string (YYYY-MM-DD) in clinic timezone
 */
function getTodayDateString() {
  const today = getTodayInClinicTimezone();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Convert a date to clinic timezone date string
 */
function toClinicDateString(date) {
  if (!date) return null;
  
  const d = date instanceof Date ? date : new Date(date);
  const clinicTimezone = 'America/New_York';
  
  const dateStr = d.toLocaleDateString('en-US', {
    timeZone: clinicTimezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  
  const [month, day, year] = dateStr.split('/');
  return `${year}-${month}-${day}`;
}

module.exports = {
  getTodayInClinicTimezone,
  getTodayDateString,
  toClinicDateString
};



