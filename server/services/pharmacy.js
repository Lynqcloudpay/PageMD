/**
 * Pharmacy Search Service
 * 
 * Provides pharmacy directory search functionality with:
 * - NCPDP ID lookup
 * - Location-based search
 * - NPI registry integration
 * - Surescripts-style directory interface
 */

const axios = require('axios');
const pool = require('../db');

// External API endpoints (configure these as needed)
const NCPDP_API_URL = process.env.NCPDP_API_URL; // If available
const NPI_API_URL = process.env.NPI_API_URL || 'https://npiregistry.cms.hhs.gov/api';

/**
 * Search pharmacies by name or location
 * @param {Object} params - Search parameters
 * @param {string} params.query - Search query (name, city, zip, etc.)
 * @param {number} params.latitude - Optional latitude for location-based search
 * @param {number} params.longitude - Optional longitude for location-based search
 * @param {number} params.radius - Search radius in miles (default: 25)
 * @param {number} params.limit - Maximum results (default: 20)
 * @returns {Promise<Array>} Array of pharmacy objects
 */
async function searchPharmacies({ query, latitude, longitude, radius = 25, limit = 20 }) {
  try {
    // If location provided, do location-based search first
    if (latitude && longitude) {
      return await searchPharmaciesByLocation(latitude, longitude, radius, limit, query);
    }

    // Otherwise, do name/location text search
    if (query) {
      return await searchPharmaciesByQuery(query, limit);
    }

    // Return nearby pharmacies if no query
    if (latitude && longitude) {
      return await searchPharmaciesByLocation(latitude, longitude, radius, limit);
    }

    return [];

  } catch (error) {
    console.error('Pharmacy search error:', error);
    throw new Error(`Failed to search pharmacies: ${error.message}`);
  }
}

/**
 * Search pharmacies by location (lat/lng)
 */
async function searchPharmaciesByLocation(latitude, longitude, radius = 25, limit = 20, nameQuery = null) {
  try {
    // Haversine formula for distance calculation
    // Formula: distance = 2 * R * arcsin(sqrt(sin²(Δlat/2) + cos(lat1) * cos(lat2) * sin²(Δlng/2)))
    // R = 3959 miles (Earth's radius)
    
    let whereClause = `
      latitude IS NOT NULL 
      AND longitude IS NOT NULL
      AND active = true
    `;
    const params = [latitude, longitude, radius];
    let paramIndex = 4;

    if (nameQuery) {
      whereClause += ` AND (name ILIKE $${paramIndex} OR city ILIKE $${paramIndex} OR zip ILIKE $${paramIndex})`;
      params.push(`%${nameQuery}%`);
      paramIndex++;
    }

    const query = `
      SELECT 
        id,
        ncpdp_id,
        npi,
        name,
        phone,
        fax,
        email,
        address_line1,
        address_line2,
        city,
        state,
        zip,
        latitude,
        longitude,
        pharmacy_type,
        active,
        integration_enabled,
        (
          3959 * acos(
            cos(radians($1)) * 
            cos(radians(latitude)) * 
            cos(radians(longitude) - radians($2)) + 
            sin(radians($1)) * 
            sin(radians(latitude))
          )
        ) AS distance_miles
      FROM pharmacies
      WHERE ${whereClause}
      HAVING (
        3959 * acos(
          cos(radians($1)) * 
          cos(radians(latitude)) * 
          cos(radians(longitude) - radians($2)) + 
          sin(radians($1)) * 
          sin(radians(latitude))
        )
      ) <= $3
      ORDER BY distance_miles ASC
      LIMIT $${paramIndex}
    `;
    params.push(limit);

    const result = await pool.query(query, params);

    return result.rows.map(formatPharmacy);

  } catch (error) {
    console.error('Location-based pharmacy search error:', error);
    throw error;
  }
}

/**
 * Search pharmacies by text query
 */
async function searchPharmaciesByQuery(query, limit = 20) {
  try {
    const result = await pool.query(`
      SELECT *
      FROM pharmacies
      WHERE active = true
        AND (
          name ILIKE $1
          OR city ILIKE $1
          OR zip ILIKE $1
          OR state ILIKE $1
          OR ncpdp_id ILIKE $1
          OR npi ILIKE $1
        )
      ORDER BY name ASC
      LIMIT $2
    `, [`%${query}%`, limit]);

    return result.rows.map(formatPharmacy);

  } catch (error) {
    console.error('Text pharmacy search error:', error);
    throw error;
  }
}

/**
 * Get pharmacy by NCPDP ID
 * @param {string} ncpdpId - NCPDP identifier
 * @returns {Promise<Object|null>} Pharmacy object or null
 */
async function getPharmacyByNCPDP(ncpdpId) {
  try {
    const result = await pool.query(`
      SELECT * FROM pharmacies
      WHERE ncpdp_id = $1
      LIMIT 1
    `, [ncpdpId]);

    if (result.rows.length === 0) {
      return null;
    }

    return formatPharmacy(result.rows[0]);

  } catch (error) {
    console.error('Error fetching pharmacy by NCPDP:', error);
    throw error;
  }
}

/**
 * Get pharmacy by ID
 */
async function getPharmacyById(id) {
  try {
    const result = await pool.query(`
      SELECT * FROM pharmacies
      WHERE id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return null;
    }

    return formatPharmacy(result.rows[0]);

  } catch (error) {
    console.error('Error fetching pharmacy by ID:', error);
    throw error;
  }
}

/**
 * Create or update pharmacy in directory
 */
async function upsertPharmacy(pharmacyData) {
  try {
    const {
      ncpdp_id,
      npi,
      name,
      phone,
      fax,
      email,
      address_line1,
      address_line2,
      city,
      state,
      zip,
      latitude,
      longitude,
      pharmacy_type,
      integration_enabled = false
    } = pharmacyData;

    // If NCPDP ID exists, update; otherwise insert
    if (ncpdp_id) {
      const result = await pool.query(`
        INSERT INTO pharmacies (
          ncpdp_id, npi, name, phone, fax, email,
          address_line1, address_line2, city, state, zip,
          latitude, longitude, pharmacy_type, integration_enabled
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        ON CONFLICT (ncpdp_id) DO UPDATE
        SET npi = EXCLUDED.npi,
            name = EXCLUDED.name,
            phone = EXCLUDED.phone,
            fax = EXCLUDED.fax,
            email = EXCLUDED.email,
            address_line1 = EXCLUDED.address_line1,
            address_line2 = EXCLUDED.address_line2,
            city = EXCLUDED.city,
            state = EXCLUDED.state,
            zip = EXCLUDED.zip,
            latitude = EXCLUDED.latitude,
            longitude = EXCLUDED.longitude,
            pharmacy_type = EXCLUDED.pharmacy_type,
            integration_enabled = EXCLUDED.integration_enabled,
            updated_at = CURRENT_TIMESTAMP
        RETURNING *
      `, [
        ncpdp_id, npi, name, phone, fax, email,
        address_line1, address_line2, city, state, zip,
        latitude, longitude, pharmacy_type, integration_enabled
      ]);

      return formatPharmacy(result.rows[0]);
    } else {
      // Insert new pharmacy
      const result = await pool.query(`
        INSERT INTO pharmacies (
          npi, name, phone, fax, email,
          address_line1, address_line2, city, state, zip,
          latitude, longitude, pharmacy_type, integration_enabled
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        RETURNING *
      `, [
        npi, name, phone, fax, email,
        address_line1, address_line2, city, state, zip,
        latitude, longitude, pharmacy_type, integration_enabled
      ]);

      return formatPharmacy(result.rows[0]);
    }

  } catch (error) {
    console.error('Error upserting pharmacy:', error);
    throw error;
  }
}

/**
 * Lookup pharmacy from NPI Registry (CMS)
 * @param {string} npi - National Provider Identifier
 * @returns {Promise<Object|null>} Pharmacy information from NPI registry
 */
async function lookupPharmacyByNPI(npi) {
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
      return null;
    }

    const provider = results[0];
    const addresses = provider.addresses || [];
    const locations = addresses.filter(addr => addr.address_purpose === 'LOCATION');
    const mailing = addresses.find(addr => addr.address_purpose === 'MAILING');

    const location = locations[0] || mailing || addresses[0];

    return {
      npi: provider.number,
      name: provider.basic?.organization_name || 
            `${provider.basic?.first_name || ''} ${provider.basic?.last_name || ''}`.trim(),
      address_line1: location?.address_1,
      address_line2: location?.address_2,
      city: location?.city,
      state: location?.state,
      zip: location?.postal_code,
      phone: location?.telephone_number,
      taxonomy: provider.taxonomies?.[0]?.desc,
      ncpdp_id: provider.identifiers?.find(id => id.identifier_type === 'NCPDP')?.identifier
    };

  } catch (error) {
    console.error('NPI registry lookup error:', error.message);
    return null;
  }
}

/**
 * Format pharmacy object for response
 */
function formatPharmacy(row) {
  return {
    id: row.id,
    ncpdpId: row.ncpdp_id,
    npi: row.npi,
    name: row.name,
    phone: row.phone,
    fax: row.fax,
    email: row.email,
    address: {
      line1: row.address_line1,
      line2: row.address_line2,
      city: row.city,
      state: row.state,
      zip: row.zip,
      full: [
        row.address_line1,
        row.address_line2,
        [row.city, row.state, row.zip].filter(Boolean).join(' ')
      ].filter(Boolean).join(', ')
    },
    location: row.latitude && row.longitude ? {
      latitude: parseFloat(row.latitude),
      longitude: parseFloat(row.longitude)
    } : null,
    distanceMiles: row.distance_miles ? parseFloat(row.distance_miles).toFixed(2) : null,
    type: row.pharmacy_type,
    active: row.active,
    integrationEnabled: row.integration_enabled
  };
}

module.exports = {
  searchPharmacies,
  searchPharmaciesByLocation,
  searchPharmaciesByQuery,
  getPharmacyByNCPDP,
  getPharmacyById,
  upsertPharmacy,
  lookupPharmacyByNPI
};






