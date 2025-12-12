/**
 * Pharmacy API Routes
 * 
 * Handles pharmacy directory operations:
 * - Search pharmacies by name/location
 * - Get pharmacy by NCPDP ID
 * - Create/update pharmacy directory entries
 */

const express = require('express');
const pharmacyService = require('../services/pharmacy');
const { authenticate, requireRole, logAudit } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

/**
 * GET /api/pharmacies/search
 * Search pharmacies by name, location, or other criteria
 */
router.get('/search', requireRole('clinician', 'nurse', 'front_desk'), async (req, res) => {
  try {
    const { query, latitude, longitude, radius = 25, limit = 20 } = req.query;

    const results = await pharmacyService.searchPharmacies({
      query: query || null,
      latitude: latitude ? parseFloat(latitude) : null,
      longitude: longitude ? parseFloat(longitude) : null,
      radius: parseInt(radius),
      limit: parseInt(limit)
    });

    res.json(results);

  } catch (error) {
    console.error('Pharmacy search error:', error);
    res.status(500).json({ 
      error: 'Failed to search pharmacies',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * GET /api/pharmacies/nearby
 * Get pharmacies near a location
 */
router.get('/nearby', requireRole('clinician', 'nurse', 'front_desk'), async (req, res) => {
  try {
    const { latitude, longitude, radius = 25, limit = 20 } = req.query;

    if (!latitude || !longitude) {
      return res.status(400).json({ error: 'Latitude and longitude are required' });
    }

    const results = await pharmacyService.searchPharmaciesByLocation(
      parseFloat(latitude),
      parseFloat(longitude),
      parseInt(radius),
      parseInt(limit)
    );

    res.json(results);

  } catch (error) {
    console.error('Nearby pharmacy search error:', error);
    res.status(500).json({ 
      error: 'Failed to find nearby pharmacies',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * GET /api/pharmacies/:id
 * Get pharmacy by ID
 */
router.get('/:id', requireRole('clinician', 'nurse', 'front_desk'), async (req, res) => {
  try {
    const { id } = req.params;

    const pharmacy = await pharmacyService.getPharmacyById(id);

    if (!pharmacy) {
      return res.status(404).json({ error: 'Pharmacy not found' });
    }

    res.json(pharmacy);

  } catch (error) {
    console.error('Error fetching pharmacy:', error);
    res.status(500).json({ error: 'Failed to fetch pharmacy' });
  }
});

/**
 * GET /api/pharmacies/ncpdp/:ncpdpId
 * Get pharmacy by NCPDP ID
 */
router.get('/ncpdp/:ncpdpId', requireRole('clinician', 'nurse', 'front_desk'), async (req, res) => {
  try {
    const { ncpdpId } = req.params;

    const pharmacy = await pharmacyService.getPharmacyByNCPDP(ncpdpId);

    if (!pharmacy) {
      return res.status(404).json({ error: 'Pharmacy not found' });
    }

    res.json(pharmacy);

  } catch (error) {
    console.error('Error fetching pharmacy by NCPDP:', error);
    res.status(500).json({ error: 'Failed to fetch pharmacy' });
  }
});

/**
 * POST /api/pharmacies
 * Create or update pharmacy in directory (admin only)
 */
router.post('/', requireRole('admin'), async (req, res) => {
  try {
    const pharmacy = await pharmacyService.upsertPharmacy(req.body);

    await logAudit(req.user.id, 'upsert_pharmacy', 'pharmacy', pharmacy.id, {
      ncpdpId: pharmacy.ncpdpId,
      name: pharmacy.name
    }, req.ip);

    res.status(201).json(pharmacy);

  } catch (error) {
    console.error('Error creating/updating pharmacy:', error);
    res.status(500).json({ 
      error: 'Failed to create/update pharmacy',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * GET /api/pharmacies/npi/lookup/:npi
 * Lookup pharmacy from NPI Registry
 */
router.get('/npi/lookup/:npi', requireRole('admin'), async (req, res) => {
  try {
    const { npi } = req.params;

    const pharmacyInfo = await pharmacyService.lookupPharmacyByNPI(npi);

    if (!pharmacyInfo) {
      return res.status(404).json({ error: 'Pharmacy not found in NPI Registry' });
    }

    res.json(pharmacyInfo);

  } catch (error) {
    console.error('NPI lookup error:', error);
    res.status(500).json({ error: 'Failed to lookup pharmacy in NPI Registry' });
  }
});

module.exports = router;






















