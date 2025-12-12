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

    // Search RxNorm API
    const response = await axios.get(`${RXNORM_BASE_URL}/drugs.json`, {
      params: {
        name: searchTerm
      },
      timeout: 5000 // 5 second timeout
    });

    const drugs = response.data?.drugGroup?.conceptGroup;
    if (!drugs || !Array.isArray(drugs)) {
      return [];
    }

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

    // Cache results
    if (USE_CACHE && medications.length > 0) {
      await cacheMedicationSearch(searchTerm, medications);
    }

    return medications.slice(0, maxResults);

  } catch (error) {
    console.error('RxNorm search error:', error.message);
    
    // Fallback to local database cache
    if (USE_CACHE) {
      try {
        const localResults = await searchLocalMedicationDatabase(searchTerm, maxResults);
        if (localResults && localResults.length > 0) {
          console.log(`Using local database cache for: ${searchTerm}`);
          return localResults;
        }
      } catch (dbError) {
        console.error('Local database search error:', dbError.message);
      }
    }
    
    // Final fallback: return empty array instead of throwing
    // This allows the UI to show "No medications found" instead of an error
    console.warn(`Medication search failed for "${searchTerm}", returning empty results`);
    return [];
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
    { rxcui: '197806', name: 'LISINOPRIL 10 MG TABLET', synonym: 'Lisinopril 10mg', tty: 'SBD' },
    { rxcui: '83367', name: 'ATORVASTATIN 20 MG TABLET', synonym: 'Atorvastatin 20mg', tty: 'SBD' },
    { rxcui: '197884', name: 'METFORMIN 500 MG TABLET', synonym: 'Metformin 500mg', tty: 'SBD' },
    { rxcui: '314076', name: 'AMLODIPINE 5 MG TABLET', synonym: 'Amlodipine 5mg', tty: 'SBD' },
    { rxcui: '860975', name: 'LEVOTHYROXINE 75 MCG TABLET', synonym: 'Levothyroxine 75mcg', tty: 'SBD' },
    { rxcui: '198029', name: 'OMEPRAZOLE 20 MG CAPSULE', synonym: 'Omeprazole 20mg', tty: 'SBD' },
    { rxcui: '199849', name: 'AMOXICILLIN 500 MG CAPSULE', synonym: 'Amoxicillin 500mg', tty: 'SBD' },
    { rxcui: '197847', name: 'ALBUTEROL 90 MCG INHALER', synonym: 'Albuterol 90mcg', tty: 'SBD' },
    { rxcui: '198046', name: 'GABAPENTIN 300 MG CAPSULE', synonym: 'Gabapentin 300mg', tty: 'SBD' },
    { rxcui: '199726', name: 'SERTRALINE 50 MG TABLET', synonym: 'Sertraline 50mg', tty: 'SBD' },
    { rxcui: '197808', name: 'IBUPROFEN 200 MG TABLET', synonym: 'Ibuprofen 200mg', tty: 'SBD' },
    { rxcui: '197857', name: 'PREDNISONE 20 MG TABLET', synonym: 'Prednisone 20mg', tty: 'SBD' },
    { rxcui: '198045', name: 'TRAZODONE 50 MG TABLET', synonym: 'Trazodone 50mg', tty: 'SBD' },
    { rxcui: '198058', name: 'FUROSEMIDE 40 MG TABLET', synonym: 'Furosemide 40mg', tty: 'SBD' },
    { rxcui: '199794', name: 'LOSARTAN 50 MG TABLET', synonym: 'Losartan 50mg', tty: 'SBD' },
    { rxcui: '198019', name: 'METOPROLOL 25 MG TABLET', synonym: 'Metoprolol 25mg', tty: 'SBD' },
    { rxcui: '197854', name: 'AMLODIPINE-BENAZEPRIL 5-10 MG TABLET', synonym: 'Amlodipine-Benazepril', tty: 'SBD' },
    { rxcui: '197806', name: 'HYDROCHLOROTHIAZIDE 25 MG TABLET', synonym: 'HCTZ 25mg', tty: 'SBD' },
  ];

  const searchLower = searchTerm.toLowerCase();
  const filtered = commonMeds.filter(med => 
    med.name.toLowerCase().includes(searchLower) || 
    med.synonym.toLowerCase().includes(searchLower)
  );

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


