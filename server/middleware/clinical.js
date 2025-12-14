const pool = require('../db');

// Clinical decision support - Drug interaction checker
const checkDrugInteractions = async (patientId, newMedications) => {
  try {
    // Get current medications
    const currentMeds = await pool.query(
      'SELECT medication_name FROM medications WHERE patient_id = $1 AND active = true',
      [patientId]
    );

    const currentMedNames = currentMeds.rows.map(m => m.medication_name.toLowerCase());
    const newMedNames = Array.isArray(newMedications) 
      ? newMedications.map(m => (typeof m === 'string' ? m : m.name).toLowerCase())
      : [newMedications.toLowerCase()];

    // Simple interaction check (in production, use a drug interaction API)
    const interactions = [];
    const knownInteractions = {
      'warfarin': ['aspirin', 'ibuprofen', 'naproxen'],
      'digoxin': ['furosemide', 'hydrochlorothiazide'],
      'lithium': ['furosemide', 'hydrochlorothiazide'],
    };

    for (const newMed of newMedNames) {
      for (const [drug, contraindicated] of Object.entries(knownInteractions)) {
        if (newMed.includes(drug.toLowerCase()) || drug.toLowerCase().includes(newMed)) {
          for (const currentMed of currentMedNames) {
            if (contraindicated.some(ci => currentMed.includes(ci.toLowerCase()) || ci.toLowerCase().includes(currentMed))) {
              interactions.push({
                severity: 'high',
                message: `Potential interaction between ${newMed} and ${currentMed}`,
                drugs: [newMed, currentMed]
              });
            }
          }
        }
      }
    }

    return interactions;
  } catch (error) {
    console.error('Error checking drug interactions:', error);
    return [];
  }
};

// Allergy checker
const checkAllergies = async (patientId, medicationName) => {
  try {
    const allergies = await pool.query(
      'SELECT allergen, reaction FROM allergies WHERE patient_id = $1 AND active = true',
      [patientId]
    );

    const medNameLower = medicationName.toLowerCase();
    const allergyMatches = allergies.rows.filter(allergy => 
      medNameLower.includes(allergy.allergen.toLowerCase()) || 
      allergy.allergen.toLowerCase().includes(medNameLower)
    );

    return allergyMatches.map(allergy => ({
      severity: 'high',
      message: `Patient has allergy to ${allergy.allergen}: ${allergy.reaction || 'Unknown reaction'}`,
      allergen: allergy.allergen,
      reaction: allergy.reaction
    }));
  } catch (error) {
    console.error('Error checking allergies:', error);
    return [];
  }
};

// Duplicate medication checker
const checkDuplicateMedications = async (patientId, medicationName) => {
  try {
    const existing = await pool.query(
      'SELECT medication_name FROM medications WHERE patient_id = $1 AND active = true AND LOWER(medication_name) = LOWER($2)',
      [patientId, medicationName]
    );

    if (existing.rows.length > 0) {
      return [{
        severity: 'medium',
        message: `Patient is already taking ${medicationName}`,
        medication: medicationName
      }];
    }

    return [];
  } catch (error) {
    console.error('Error checking duplicate medications:', error);
    return [];
  }
};

// Comprehensive clinical check
const performClinicalChecks = async (patientId, medicationName, medicationData = {}) => {
  const warnings = [];
  
  // Check allergies
  const allergyWarnings = await checkAllergies(patientId, medicationName);
  warnings.push(...allergyWarnings);
  
  // Check duplicates
  const duplicateWarnings = await checkDuplicateMedications(patientId, medicationName);
  warnings.push(...duplicateWarnings);
  
  // Check drug interactions
  const interactionWarnings = await checkDrugInteractions(patientId, [medicationName]);
  warnings.push(...interactionWarnings);
  
  return warnings;
};

module.exports = {
  checkDrugInteractions,
  checkAllergies,
  checkDuplicateMedications,
  performClinicalChecks,
};

















