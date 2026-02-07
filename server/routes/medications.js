/**
 * Medications API Routes
 * 
 * Exposes RxNorm medication search and drug information services
 */

const express = require('express');
const rxnormService = require('../services/rxnorm');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

/**
 * GET /api/medications/search
 * Search medications by name using RxNorm API
 */
router.get('/search', requireRole('clinician', 'nurse'), async (req, res) => {
  try {
    const { q, limit = 20 } = req.query;

    if (!q || q.trim().length < 1) {
      return res.status(400).json({ error: 'Search query is required' });
    }

    // For very short queries (1 character), return empty array as RxNorm API needs more
    // Frontend will handle showing common medications or waiting for more input
    if (q.trim().length < 2) {
      return res.json([]);
    }

    const medications = await rxnormService.searchMedications(q.trim(), parseInt(limit));

    // Always return an array, even if empty
    res.json(Array.isArray(medications) ? medications : []);

  } catch (error) {
    console.error('Medication search error:', error);
    // Return empty array instead of error so UI can show "No medications found"
    res.json([]);
  }
});

/**
 * GET /api/medications/:rxcui
 * Get detailed medication information by RxCUI
 */
router.get('/:rxcui', requireRole('clinician', 'nurse'), async (req, res) => {
  try {
    const { rxcui } = req.params;

    if (!rxcui) {
      return res.status(400).json({ error: 'RxCUI is required' });
    }

    const [details, structures] = await Promise.all([
      rxnormService.getMedicationDetails(rxcui),
      rxnormService.getMedicationStructures(rxcui)
    ]);

    res.json({
      ...details,
      structures
    });

  } catch (error) {
    console.error('Error fetching medication details:', error);
    res.status(500).json({
      error: 'Failed to fetch medication details',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * GET /api/medications/interactions
 * Check for drug interactions between multiple medications
 */
router.get('/interactions/check', requireRole('clinician', 'nurse'), async (req, res) => {
  try {
    const { rxcuis } = req.query;

    if (!rxcuis) {
      return res.status(400).json({ error: 'RxCUIs parameter is required' });
    }

    // Parse comma-separated list or array
    const rxcuisArray = Array.isArray(rxcuis)
      ? rxcuis
      : rxcuis.split(',').map(r => r.trim()).filter(Boolean);

    if (rxcuisArray.length < 2) {
      return res.status(400).json({ error: 'At least 2 medication RxCUIs are required' });
    }

    const interactions = await rxnormService.checkDrugInteractions(rxcuisArray);

    res.json({
      medications: rxcuisArray,
      interactions,
      hasInteractions: interactions.length > 0
    });

  } catch (error) {
    console.error('Drug interaction check error:', error);
    res.status(500).json({
      error: 'Failed to check drug interactions',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * POST /api/medications/track
 * Track medication usage for smart ranking
 */
router.post('/track', requireRole('clinician', 'nurse'), async (req, res) => {
  try {
    const { rxcui } = req.body;
    if (!rxcui) return res.status(400).json({ error: 'RxCUI is required' });

    await rxnormService.trackMedicationUsage(rxcui);
    res.json({ success: true });
  } catch (error) {
    console.error('Error tracking medication usage:', error);
    res.status(500).json({ error: 'Failed to track usage' });
  }
});

module.exports = router;


