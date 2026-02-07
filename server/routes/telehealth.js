const express = require('express');
const { authenticate } = require('../middleware/auth');
const featureGuard = require('../middleware/featureGuard');
const { simulate, isSandboxMode } = require('../services/simulationInterceptor');

const router = express.Router();
router.use(authenticate);
router.use(featureGuard('telehealth'));

// Daily.co API configuration
const DAILY_API_KEY = process.env.DAILY_API_KEY;
const DAILY_API_URL = 'https://api.daily.co/v1';

// Create a telehealth room
router.post('/rooms', authenticate, async (req, res) => {
    try {
        const { appointmentId, patientName, providerName, encounterId } = req.body;

        if (isSandboxMode()) {
            console.log(`[Telehealth] Sandbox detected for appointment ${appointmentId}. Returning mock room.`);
            return res.json({
                success: true,
                roomUrl: `https://pagemdemr.com/telehealth/mock/${appointmentId}?role=provider`,
                roomName: `mock-room-${appointmentId}`,
                isSimulated: true
            });
        }

        if (!DAILY_API_KEY) {
            console.error('[Telehealth] DAILY_API_KEY missing');
            return res.status(500).json({ error: 'Daily.co API key not configured' });
        }

        // Create a unique room name based on appointment (deterministic and lowercase)
        // This ensures both provider and patient land in the same room
        const roomName = `pagemd-appt-${appointmentId}`.toLowerCase();
        console.log(`[Telehealth] Processing room: ${roomName}`);

        // Room expires after 2 hours
        const expiryTime = Math.floor(Date.now() / 1000) + 7200;

        // 1. Ensure room exists
        let room;
        try {
            const roomResponse = await axios.get(`${DAILY_API_URL}/rooms/${roomName}`, {
                headers: { 'Authorization': `Bearer ${DAILY_API_KEY}` }
            });
            room = roomResponse.data;
            console.log(`[Telehealth] Room exists: ${room.name}`);
        } catch (error) {
            if (error.response?.status === 404) {
                // Create room if not exists
                console.log(`[Telehealth] Room not found, creating new: ${roomName}`);
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
                    console.log(`[Telehealth] Room created: ${room.name}`);
                } catch (createError) {
                    console.error('[Telehealth] Room Creation Failed:', createError.response?.data || createError.message);

                    // If it failed because it exists (race condition), fetch it
                    if (createError.response?.status === 400 && createError.response?.data?.info?.includes('already exists')) {
                        console.log(`[Telehealth] Race condition detected for ${roomName}, fetching existing room...`);
                        try {
                            const roomResponse = await axios.get(`${DAILY_API_URL}/rooms/${roomName}`, {
                                headers: { 'Authorization': `Bearer ${DAILY_API_KEY}` }
                            });
                            room = roomResponse.data;
                        } catch (getError) {
                            console.error('[Telehealth] Failed to fetch existing (race):', getError.message);
                            return res.status(500).json({ error: 'Failed to access video room (race)' });
                        }
                    } else {
                        return res.status(500).json({ error: 'Failed to create video room', details: createError.response?.data });
                    }
                }
            } else {
                console.error('[Telehealth] Get Room Failed:', error.response?.data || error.message);
                return res.status(500).json({ error: 'Failed to check video room status', details: error.response?.data });
            }
        }

        // 2. Generate meeting token for the provider (Owner)
        try {
            const tokenResponse = await axios.post(`${DAILY_API_URL}/meeting-tokens`, {
                properties: {
                    room_name: roomName,
                    user_name: providerName || 'Provider',
                    is_owner: true, // Provider is owner
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

// Get room info
router.get('/rooms/:roomName', authenticate, async (req, res) => {
    try {
        const { roomName } = req.params;

        if (!DAILY_API_KEY) {
            return res.status(500).json({ error: 'Daily.co API key not configured' });
        }

        const response = await axios.get(`${DAILY_API_URL}/rooms/${roomName}`, {
            headers: {
                'Authorization': `Bearer ${DAILY_API_KEY}`
            }
        });

        res.json(response.data);

    } catch (error) {
        if (error.response?.status === 404) {
            return res.status(404).json({ error: 'Room not found or expired' });
        }
        console.error('Error getting room info:', error.response?.data || error.message);
        res.status(500).json({ error: 'Failed to get room info' });
    }
});

// Delete a room (cleanup)
router.delete('/rooms/:roomName', authenticate, async (req, res) => {
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
