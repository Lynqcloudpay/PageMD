const axios = require('axios');
const express = require('express');
const { authenticatePortal } = require('../../middleware/portalAuth');

const router = express.Router();

// Daily.co API configuration
const DAILY_API_KEY = process.env.DAILY_API_KEY;
const DAILY_API_URL = 'https://api.daily.co/v1';

/**
 * Create a telehealth room for portal patient
 * POST /api/portal/telehealth/rooms
 */
router.post('/rooms', authenticatePortal, async (req, res) => {
    try {
        const { appointmentId, patientName, providerName } = req.body;

        if (!DAILY_API_KEY) {
            console.error('[Portal Telehealth] DAILY_API_KEY missing');
            return res.status(500).json({ error: 'Daily.co API key not configured' });
        }

        // Create a unique room name based on appointment (deterministic)
        const roomName = `pagemd-appt-${appointmentId}`;

        // Room expires after 2 hours
        const expiryTime = Math.floor(Date.now() / 1000) + 7200;

        // 1. Ensure room exists
        let room;
        try {
            const roomResponse = await axios.get(`${DAILY_API_URL}/rooms/${roomName}`, {
                headers: { 'Authorization': `Bearer ${DAILY_API_KEY}` }
            });
            room = roomResponse.data;
        } catch (error) {
            if (error.response?.status === 404) {
                // Create room if not exists
                try {
                    const createResponse = await axios.post(`${DAILY_API_URL}/rooms`, {
                        name: roomName,
                        privacy: 'private',
                        properties: {
                            exp: expiryTime,
                            enable_chat: true,
                            enable_screenshare: true,
                            enable_recording: false,
                            enable_prejoin_ui: false,
                            enable_knocking: false,
                            enable_network_ui: true,
                            max_participants: 10
                        }
                    }, {
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${DAILY_API_KEY}`
                        }
                    });
                    room = createResponse.data;
                } catch (createError) {
                    console.error('Daily.co Room Creation error:', createError.response?.data || createError.message);
                    // If it failed because it exists (race condition), that's fine
                    if (createError.response?.status !== 400 || !createError.response?.data?.info?.includes('already exists')) {
                        return res.status(500).json({ error: 'Failed to create video room' });
                    }
                }
            } else {
                console.error('Daily.co Get Room error:', error.response?.data || error.message);
                return res.status(500).json({ error: 'Failed to check video room status' });
            }
        }

        // 2. Generate meeting token for the patient (Non-Owner)
        try {
            const tokenResponse = await axios.post(`${DAILY_API_URL}/meeting-tokens`, {
                properties: {
                    room_name: roomName,
                    user_name: patientName || 'Patient',
                    is_owner: false, // Patient is not owner
                    exp: expiryTime
                }
            }, {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${DAILY_API_KEY}`
                }
            });

            const tokenData = tokenResponse.data;

            res.json({
                success: true,
                roomUrl: `${room.url}?t=${tokenData.token}`,
                token: tokenData.token,
                roomName: roomName,
                expiresAt: new Date(expiryTime * 1000).toISOString()
            });
        } catch (tokenError) {
            console.error('Daily.co Token error:', tokenError.response?.data || tokenError.message);
            return res.status(500).json({ error: 'Failed to generate access token' });
        }

    } catch (error) {
        console.error('Error creating telehealth room:', error);
        res.status(500).json({ error: 'Failed to create video room' });
    }
});

/**
 * Delete a telehealth room (cleanup)
 * DELETE /api/portal/telehealth/rooms/:roomName
 */
router.delete('/rooms/:roomName', authenticatePortal, async (req, res) => {
    try {
        const { roomName } = req.params;

        if (!DAILY_API_KEY) {
            return res.status(500).json({ error: 'Daily.co API key not configured' });
        }

        await axios.delete(`${DAILY_API_URL}/rooms/${roomName}`, {
            headers: {
                'Authorization': `Bearer ${DAILY_API_KEY}`
            }
        });

        res.json({ success: true });

    } catch (error) {
        if (error.response?.status === 404) {
            return res.json({ success: true }); // Already gone
        }
        console.error('Error deleting room:', error.response?.data || error.message);
        res.status(500).json({ error: 'Failed to delete room' });
    }
});

module.exports = router;
