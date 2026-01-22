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
            return res.status(500).json({ error: 'Daily.co API key not configured' });
        }

        // Create a unique room name based on appointment (deterministic)
        const roomName = `pagemd-appt-${appointmentId}`;

        // Room expires after 2 hours
        const expiryTime = Math.floor(Date.now() / 1000) + 7200;

        // 1. Ensure room exists
        let roomResponse = await fetch(`${DAILY_API_URL}/rooms/${roomName}`, {
            headers: { 'Authorization': `Bearer ${DAILY_API_KEY}` }
        });

        if (!roomResponse.ok) {
            // Create room if not exists
            roomResponse = await fetch(`${DAILY_API_URL}/rooms`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${DAILY_API_KEY}`
                },
                body: JSON.stringify({
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
                })
            });

            if (!roomResponse.ok) {
                const error = await roomResponse.json();
                console.error('Daily.co Room Creation error:', error);
                // If it failed because it exists (race condition), that's fine, we'll proceed to token
                if (roomResponse.status !== 400 || !error.info?.includes('already exists')) {
                    return res.status(500).json({ error: 'Failed to create video room' });
                }
            }
        }

        const room = await roomResponse.json();

        // 2. Generate meeting token for the patient (Non-Owner)
        const tokenResponse = await fetch(`${DAILY_API_URL}/meeting-tokens`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${DAILY_API_KEY}`
            },
            body: JSON.stringify({
                properties: {
                    room_name: roomName,
                    user_name: patientName || 'Patient',
                    is_owner: false, // Patient is not owner
                    expiry: expiryTime
                }
            })
        });

        if (!tokenResponse.ok) {
            const error = await tokenResponse.json();
            console.error('Daily.co Token error:', error);
            return res.status(500).json({ error: 'Failed to generate access token' });
        }

        const tokenData = await tokenResponse.json();

        res.json({
            success: true,
            roomUrl: `${room.url}?t=${tokenData.token}`,
            token: tokenData.token,
            roomName: roomName,
            expiresAt: new Date(expiryTime * 1000).toISOString()
        });

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

        const response = await fetch(`${DAILY_API_URL}/rooms/${roomName}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${DAILY_API_KEY}`
            }
        });

        if (!response.ok && response.status !== 404) {
            return res.status(500).json({ error: 'Failed to delete room' });
        }

        res.json({ success: true });

    } catch (error) {
        console.error('Error deleting room:', error);
        res.status(500).json({ error: 'Failed to delete room' });
    }
});

module.exports = router;
