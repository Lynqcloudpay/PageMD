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
            console.error('[Portal Telehealth] DAILY_API_KEY missing in environment');
            return res.status(500).json({ error: 'Config Error: Daily.co key missing' });
        }

        // Create a unique room name based on appointment (deterministic & lowercase)
        const roomName = `pagemd-appt-${appointmentId}`.toLowerCase();
        console.log(`[Portal Telehealth] Processing room: ${roomName} for appt ${appointmentId}`);

        // Room expires after 2 hours
        const expiryTime = Math.floor(Date.now() / 1000) + 7200;

        // 1. Ensure room exists
        let room;
        try {
            const roomResponse = await axios.get(`${DAILY_API_URL}/rooms/${roomName}`, {
                headers: { 'Authorization': `Bearer ${DAILY_API_KEY}` }
            });
            room = roomResponse.data;
            console.log(`[Portal Telehealth] Room exists: ${room.name}`);
        } catch (error) {
            if (error.response?.status === 404) {
                // Create room if not exists
                console.log(`[Portal Telehealth] Room not found, creating new: ${roomName}`);
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
                    console.log(`[Portal Telehealth] Room created: ${room.name}`);
                } catch (createError) {
                    console.error('[Portal Telehealth] Room Creation Failed:', createError.response?.data || createError.message);

                    // If it failed because it exists (race condition), fetch it
                    if (createError.response?.status === 400 && createError.response?.data?.info?.includes('already exists')) {
                        console.log(`[Portal Telehealth] Race condition detected for ${roomName}, fetching existing room...`);
                        try {
                            const roomResponse = await axios.get(`${DAILY_API_URL}/rooms/${roomName}`, {
                                headers: { 'Authorization': `Bearer ${DAILY_API_KEY}` }
                            });
                            room = roomResponse.data;
                        } catch (getError) {
                            console.error('[Portal Telehealth] Failed to fetch existing (race):', getError.message);
                            return res.status(500).json({ error: 'Failed to access video room (race)' });
                        }
                    } else {
                        return res.status(500).json({ error: 'Failed to create video room', details: createError.response?.data });
                    }
                }
            } else {
                console.error('[Portal Telehealth] Get Room Failed:', error.response?.data || error.message);
                return res.status(500).json({ error: 'Failed to check video room status', details: error.response?.data });
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
