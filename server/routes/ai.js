const express = require('express');
const router = express.Router();
const aiService = require('../services/aiService');
const { requirePermission } = require('../services/authorization');
const auth = require('../middleware/auth');

/**
 * @route   POST /api/ai/patient/:patientId/ask
 * @desc    Ask a clinical question about a patient
 * @access  Private (Requires patients:view_chart permission)
 */
router.post('/patient/:patientId/ask', auth, requirePermission('patients:view_chart'), async (req, res) => {
    try {
        const { patientId } = req.params;
        const { question, additionalContext } = req.body;

        if (!question) {
            return res.status(400).json({ error: 'Question is required' });
        }

        const response = await aiService.askAssistant(req.user.id, patientId, question, additionalContext);

        res.json({
            success: true,
            response,
            provider: process.env.AI_PROVIDER || 'openai'
        });
    } catch (error) {
        console.error('AI Route Error:', error);
        res.status(error.response?.status || 500).json({
            error: 'AI Assistant Error',
            message: error.message,
            details: error.response?.data
        });
    }
});

/**
 * @route   POST /api/ai/note/generate
 * @desc    Generate a clinical note draft
 * @access  Private (Requires notes:create permission)
 */
router.post('/note/generate', auth, requirePermission('notes:create'), async (req, res) => {
    try {
        const { patientId, visitData } = req.body;

        if (!patientId || !visitData) {
            return res.status(400).json({ error: 'Patient ID and Visit Data are required' });
        }

        const question = "Generate a professional SOAP note draft based on this visit data.";
        const response = await aiService.askAssistant(req.user.id, patientId, question, { type: 'note_generation', visitData });

        res.json({
            success: true,
            note: response
        });
    } catch (error) {
        console.error('AI Note Generation Error:', error);
        res.status(500).json({ error: 'Failed to generate note draft' });
    }
});

module.exports = router;
