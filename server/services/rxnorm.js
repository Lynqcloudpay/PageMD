/**
 * RxNorm API Integration Service
 * 
 * Provides medication search and drug information lookup using RxNorm API.
 * RxNorm is a normalized naming system for generic and branded drugs maintained by NLM.
 * 
 * API Documentation: https://www.nlm.nih.gov/research/umls/rxnorm/docs/index.html
 * 
 * For production, you'll need to:
 * 1. Obtain API key from NLM
 * 2. Set RXNorm_API_KEY in environment variables
 * 3. Consider rate limiting and caching
 */

const axios = require('axios');
const pool = require('../db');

// RxNorm API endpoints
const RXNORM_BASE_URL = process.env.RXNORM_API_URL || 'https://rxnav.nlm.nih.gov/REST';
const USE_CACHE = process.env.RXNORM_USE_CACHE !== 'false'; // Default to true

/**
 * Search for medications by name
 * @param {string} searchTerm - Medication name or partial name
 * @param {number} maxResults - Maximum number of results to return
 * @returns {Promise<Array>} Array of medication objects
 */
async function searchMedications(searchTerm, maxResults = 20) {
  try {
    // Check cache first
    if (USE_CACHE) {
      const cached = await searchMedicationCache(searchTerm);
      if (cached && cached.length > 0) {
        console.log(`Cache hit for medication search: ${searchTerm}`);
        return cached.slice(0, maxResults);
      }
    }

    // Try RxNorm API with short timeout
    try {
      const response = await axios.get(`${RXNORM_BASE_URL}/drugs.json`, {
        params: {
          name: searchTerm
        },
        timeout: 3000 // 3 second timeout
      });

      const drugs = response.data?.drugGroup?.conceptGroup;
      if (drugs && Array.isArray(drugs)) {
        // Extract medication concepts
        const medications = [];
        for (const group of drugs) {
          if (group.conceptProperties && Array.isArray(group.conceptProperties)) {
            for (const concept of group.conceptProperties) {
              medications.push({
                rxcui: concept.rxcui,
                name: concept.name,
                synonym: concept.synonym || concept.name,
                tty: concept.tty, // Term Type
                language: concept.language
              });
            }
          }
        }

        // Cache results if found
        if (USE_CACHE && medications.length > 0) {
          await cacheMedicationSearch(searchTerm, medications);
        }

        if (medications.length > 0) {
          return medications.slice(0, maxResults);
        }
      }
    } catch (apiError) {
      console.log(`RxNorm API failed for "${searchTerm}": ${apiError.message}`);
      // Continue to fallback
    }

    // Fallback to local database
    console.log(`Using fallback for medication search: ${searchTerm}`);
    const localResults = await searchLocalMedicationDatabase(searchTerm, maxResults);
    if (localResults && localResults.length > 0) {
      console.log(`Found ${localResults.length} results in local database/fallback`);
      return localResults;
    }

    // Return empty array if nothing found
    return [];

  } catch (error) {
    console.error('Medication search error:', error.message);

    // Final fallback
    try {
      const fallbackResults = await searchLocalMedicationDatabase(searchTerm, maxResults);
      return fallbackResults || [];
    } catch (fallbackError) {
      console.error('Fallback search also failed:', fallbackError.message);
      return [];
    }
  }
}

/**
 * Get detailed medication information by RxCUI
 * @param {string} rxcui - RxNorm Concept Unique Identifier
 * @returns {Promise<Object>} Medication details
 */
async function getMedicationDetails(rxcui) {
  try {
    // Check local database cache first
    const local = await getMedicationFromDatabase(rxcui);
    if (local) {
      return local;
    }

    // Fetch from RxNorm API
    const [properties, related, ingredients] = await Promise.all([
      axios.get(`${RXNORM_BASE_URL}/rxcui/${rxcui}/properties.json`).catch(() => null),
      axios.get(`${RXNORM_BASE_URL}/rxcui/${rxcui}/related.json`, {
        params: { tty: 'SCD+SBD' } // Semantic Clinical Drug + Semantic Branded Drug
      }).catch(() => null),
      axios.get(`${RXNORM_BASE_URL}/rxcui/${rxcui}/allrelated.json`).catch(() => null)
    ]);

    const details = {
      rxcui,
      name: properties?.data?.properties?.name || null,
      tty: properties?.data?.properties?.tty || null,
      // Additional details can be extracted from responses
    };

    // Cache in local database
    if (details.name) {
      await cacheMedicationDetails(details);
    }

    return details;

  } catch (error) {
    console.error(`Error fetching medication details for RxCUI ${rxcui}:`, error.message);
    throw new Error(`Failed to get medication details: ${error.message}`);
  }
}

/**
 * Get medication strengths and forms by RxCUI
 * @param {string} rxcui - RxNorm Concept Unique Identifier
 * @returns {Promise<Array>} Array of strength/form combinations
 */
async function getMedicationStructures(rxcui) {
  try {
    const response = await axios.get(`${RXNORM_BASE_URL}/rxcui/${rxcui}/allrelated.json`, {
      params: {
        tty: 'SCD+SBD+SCDG+SBDG' // Include dose forms
      }
    });

    // Parse structures from response
    const structures = [];
    const allRelated = response.data?.allRelatedGroup?.conceptGroup;

    if (allRelated && Array.isArray(allRelated)) {
      for (const group of allRelated) {
        if (group.conceptProperties) {
          for (const concept of group.conceptProperties) {
            // Extract strength and form from name
            const parsed = parseMedicationName(concept.name);
            structures.push({
              rxcui: concept.rxcui,
              name: concept.name,
              strength: parsed.strength,
              form: parsed.form,
              tty: concept.tty
            });
          }
        }
      }
    }

    return structures;

  } catch (error) {
    console.error(`Error fetching medication structures for RxCUI ${rxcui}:`, error.message);
    return [];
  }
}

/**
 * Check for drug interactions between multiple medications
 * @param {Array<string>} rxcuis - Array of RxCUI identifiers
 * @returns {Promise<Array>} Array of interaction warnings
 */
async function checkDrugInteractions(rxcuis) {
  try {
    if (!rxcuis || rxcuis.length < 2) {
      return [];
    }

    // Check local interaction database first
    const localInteractions = await checkLocalInteractions(rxcuis);
    if (localInteractions && localInteractions.length > 0) {
      return localInteractions;
    }

    // Use RxNorm interaction API
    const rxcuisParam = rxcuis.join('+');
    const response = await axios.get(`${RXNORM_BASE_URL}/interaction/list.json`, {
      params: {
        rxcuis: rxcuisParam
      }
    });

    const interactions = [];
    const interactionPair = response.data?.fullInteractionTypeGroup?.[0]?.fullInteractionType;

    if (interactionPair && Array.isArray(interactionPair)) {
      for (const pair of interactionPair) {
        const interaction = pair.interactionPair?.[0];
        if (interaction) {
          interactions.push({
            severity: interaction.severity || 'unknown',
            description: interaction.description || 'Potential drug interaction',
            medications: pair.minConcept?.map(m => ({
              rxcui: m.rxcui,
              name: m.name
            })) || []
          });
        }
      }
    }

    return interactions;

  } catch (error) {
    console.error('Error checking drug interactions:', error.message);
    // Fallback to local check
    return await checkLocalInteractions(rxcuis) || [];
  }
}

/**
 * Parse medication name to extract strength and form
 * @param {string} name - Medication name
 * @returns {Object} Parsed {strength, form}
 */
function parseMedicationName(name) {
  // Common patterns: "LISINOPRIL 10 MG TABLET", "ATORVASTATIN 20 MG ORAL TABLET"
  const strengthMatch = name.match(/(\d+(?:\.\d+)?)\s*(MG|MCG|G|ML|IU|MEQ)\b/i);
  const formMatch = name.match(/(TABLET|CAPSULE|SOLUTION|SUSPENSION|CREAM|OINTMENT|INJECTION|POWDER|LIQUID|SPRAY|DROPS)\b/i);

  return {
    strength: strengthMatch ? `${strengthMatch[1]} ${strengthMatch[2].toUpperCase()}` : null,
    form: formMatch ? formMatch[1].toUpperCase() : null
  };
}

// ============================================
// DATABASE CACHE FUNCTIONS
// ============================================

/**
 * Search local medication database cache
 */
async function searchLocalMedicationDatabase(searchTerm, limit = 20) {
  try {
    // First check if table exists
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'medication_database'
      );
    `);

    if (!tableCheck.rows[0]?.exists) {
      console.log('medication_database table does not exist, using simple fallback');
      return getCommonMedicationsFallback(searchTerm, limit);
    }

    // Try full-text search if search_vector column exists
    try {
      const result = await pool.query(`
        SELECT rxcui, name, synonym, strength, form, route, controlled_substance, schedule
        FROM medication_database
        WHERE search_vector @@ plainto_tsquery('english', $1)
           OR name ILIKE $2
           OR synonym ILIKE $2
        ORDER BY ts_rank(search_vector, plainto_tsquery('english', $1)) DESC
        LIMIT $3
      `, [searchTerm, `%${searchTerm}%`, limit]);

      if (result.rows.length > 0) {
        return result.rows.map(row => ({
          rxcui: row.rxcui,
          name: row.name,
          synonym: row.synonym || row.name,
          strength: row.strength,
          form: row.form,
          route: row.route,
          controlled: row.controlled_substance,
          schedule: row.schedule
        }));
      }
    } catch (ftsError) {
      // If full-text search fails, try simple LIKE query
      console.log('Full-text search not available, using simple LIKE query');
    }

    // Simple LIKE query fallback
    const result = await pool.query(`
      SELECT rxcui, name, synonym, strength, form, route, controlled_substance, schedule
      FROM medication_database
      WHERE name ILIKE $1
         OR synonym ILIKE $1
      LIMIT $2
    `, [`%${searchTerm}%`, limit]);

    if (result.rows.length > 0) {
      return result.rows.map(row => ({
        rxcui: row.rxcui,
        name: row.name,
        synonym: row.synonym || row.name,
        strength: row.strength,
        form: row.form,
        route: row.route,
        controlled: row.controlled_substance,
        schedule: row.schedule
      }));
    }

    // If no database results, use fallback
    return getCommonMedicationsFallback(searchTerm, limit);

  } catch (error) {
    console.error('Error searching local medication database:', error);
    return getCommonMedicationsFallback(searchTerm, limit);
  }
}

/**
 * Fallback function to return common medications when API and database fail
 */
function getCommonMedicationsFallback(searchTerm, limit = 20) {
  const commonMeds = [
    { rxcui: '197806', name: 'Lisinopril 10 MG Oral Tablet', synonym: 'Lisinopril 10mg', tty: 'SBD', strength: '10 MG' },
    { rxcui: '314076', name: 'Lisinopril 20 MG Oral Tablet', synonym: 'Lisinopril 20mg', tty: 'SBD', strength: '20 MG' },
    { rxcui: '83367', name: 'Atorvastatin 20 MG Oral Tablet', synonym: 'Atorvastatin 20mg', tty: 'SBD', strength: '20 MG' },
    { rxcui: '617310', name: 'Atorvastatin 40 MG Oral Tablet', synonym: 'Atorvastatin 40mg', tty: 'SBD', strength: '40 MG' },
    { rxcui: '860975', name: 'Metformin 500 MG Oral Tablet', synonym: 'Metformin 500mg', tty: 'SBD', strength: '500 MG' },
    { rxcui: '861007', name: 'Metformin 1000 MG Oral Tablet', synonym: 'Metformin 1000mg', tty: 'SBD', strength: '1000 MG' },
    { rxcui: '197884', name: 'Amlodipine 5 MG Oral Tablet', synonym: 'Amlodipine 5mg', tty: 'SBD', strength: '5 MG' },
    { rxcui: '329528', name: 'Amlodipine 10 MG Oral Tablet', synonym: 'Amlodipine 10mg', tty: 'SBD', strength: '10 MG' },
    { rxcui: '966529', name: 'Levothyroxine 75 MCG Oral Tablet', synonym: 'Levothyroxine 75mcg', tty: 'SBD', strength: '75 MCG' },
    { rxcui: '966524', name: 'Levothyroxine 100 MCG Oral Tablet', synonym: 'Levothyroxine 100mcg', tty: 'SBD', strength: '100 MCG' },
    { rxcui: '198029', name: 'Omeprazole 20 MG Delayed Release Oral Capsule', synonym: 'Omeprazole 20mg', tty: 'SBD', strength: '20 MG' },
    { rxcui: '308136', name: 'Omeprazole 40 MG Delayed Release Oral Capsule', synonym: 'Omeprazole 40mg', tty: 'SBD', strength: '40 MG' },
    { rxcui: '308191', name: 'Amoxicillin 500 MG Oral Capsule', synonym: 'Amoxicillin 500mg', tty: 'SBD', strength: '500 MG' },
    { rxcui: '745678', name: 'Albuterol 0.09 MG/ACTUAT Metered Dose Inhaler', synonym: 'Albuterol Inhaler', tty: 'SBD', strength: '90 MCG' },
    { rxcui: '835829', name: 'Gabapentin 300 MG Oral Capsule', synonym: 'Gabapentin 300mg', tty: 'SBD', strength: '300 MG' },
    { rxcui: '835838', name: 'Gabapentin 600 MG Oral Tablet', synonym: 'Gabapentin 600mg', tty: 'SBD', strength: '600 MG' },
    { rxcui: '312940', name: 'Sertraline 50 MG Oral Tablet', synonym: 'Sertraline 50mg', tty: 'SBD', strength: '50 MG' },
    { rxcui: '312961', name: 'Sertraline 100 MG Oral Tablet', synonym: 'Sertraline 100mg', tty: 'SBD', strength: '100 MG' },
    { rxcui: '310965', name: 'Ibuprofen 200 MG Oral Tablet', synonym: 'Ibuprofen 200mg', tty: 'SBD', strength: '200 MG' },
    { rxcui: '197857', name: 'Prednisone 20 MG Oral Tablet', synonym: 'Prednisone 20mg', tty: 'SBD', strength: '20 MG' },
    { rxcui: '312617', name: 'Trazodone 50 MG Oral Tablet', synonym: 'Trazodone 50mg', tty: 'SBD', strength: '50 MG' },
    { rxcui: '310429', name: 'Furosemide 40 MG Oral Tablet', synonym: 'Furosemide 40mg', tty: 'SBD', strength: '40 MG' },
    { rxcui: '979492', name: 'Losartan 50 MG Oral Tablet', synonym: 'Losartan 50mg', tty: 'SBD', strength: '50 MG' },
    { rxcui: '866427', name: 'Metoprolol 25 MG Oral Tablet', synonym: 'Metoprolol 25mg', tty: 'SBD', strength: '25 MG' },
    { rxcui: '310798', name: 'Hydrochlorothiazide 25 MG Oral Tablet', synonym: 'HCTZ 25mg', tty: 'SBD', strength: '25 MG' },
  ];

  const searchLower = searchTerm.toLowerCase().trim();

  // Filter with case-insensitive partial matching
  const filtered = commonMeds.filter(med =>
    med.name.toLowerCase().includes(searchLower) ||
    med.synonym.toLowerCase().includes(searchLower)
  );

  console.log(`Fallback search for "${searchTerm}": found ${filtered.length} matches`);
  return filtered.slice(0, limit);
}

/**
 * Get medication from local database cache
 */
async function getMedicationFromDatabase(rxcui) {
  try {
    const result = await pool.query(`
      SELECT * FROM medication_database
      WHERE rxcui = $1
    `, [rxcui]);

    return result.rows.length > 0 ? result.rows[0] : null;

  } catch (error) {
    console.error('Error fetching medication from database:', error);
    return null;
  }
}

/**
 * Cache medication search results
 */
async function searchMedicationCache(searchTerm) {
  // Could implement Redis or in-memory cache here
  // For now, rely on database
  return null;
}

/**
 * Cache medication details to database
 */
async function cacheMedicationDetails(medication) {
  try {
    await pool.query(`
      INSERT INTO medication_database (rxcui, name, synonym, tty)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (rxcui) DO UPDATE
      SET name = EXCLUDED.name,
          synonym = EXCLUDED.synonym,
          last_updated = CURRENT_TIMESTAMP
    `, [
      medication.rxcui,
      medication.name,
      medication.synonym || medication.name,
      medication.tty
    ]);
  } catch (error) {
    console.error('Error caching medication details:', error);
  }
}

/**
 * Cache medication search to database
 */
async function cacheMedicationSearch(searchTerm, medications) {
  // Batch insert medications into database cache
  try {
    for (const med of medications) {
      await pool.query(`
        INSERT INTO medication_database (rxcui, name, synonym, tty)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (rxcui) DO UPDATE
        SET name = EXCLUDED.name,
            synonym = EXCLUDED.synonym,
            last_updated = CURRENT_TIMESTAMP
      `, [med.rxcui, med.name, med.synonym || med.name, med.tty]);
    }
  } catch (error) {
    console.error('Error caching medication search:', error);
  }
}

/**
 * Check local drug interactions database
 */
async function checkLocalInteractions(rxcuis) {
  try {
    if (rxcuis.length < 2) return [];

    const interactions = [];
    for (let i = 0; i < rxcuis.length; i++) {
      for (let j = i + 1; j < rxcuis.length; j++) {
        const result = await pool.query(`
          SELECT * FROM drug_interactions
          WHERE (medication1_rxcui = $1 AND medication2_rxcui = $2)
             OR (medication1_rxcui = $2 AND medication2_rxcui = $1)
        `, [rxcuis[i], rxcuis[j]]);

        if (result.rows.length > 0) {
          interactions.push(...result.rows);
        }
      }
    }

    return interactions.map(i => ({
      severity: i.severity,
      description: i.description,
      clinical_effect: i.clinical_effect,
      management: i.management
    }));

  } catch (error) {
    console.error('Error checking local interactions:', error);
    return [];
  }
}

module.exports = {
  searchMedications,
  getMedicationDetails,
  getMedicationStructures,
  checkDrugInteractions,
  searchLocalMedicationDatabase
};


