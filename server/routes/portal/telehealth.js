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

        // Create a unique room name based on appointment
        const roomName = `pagemd-${appointmentId}-${Date.now()}`;

        // Room expires after 1 hour
        const expiryTime = Math.floor(Date.now() / 1000) + 3600;

        const response = await fetch(`${DAILY_API_URL}/rooms`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${DAILY_API_KEY}`
            },
            body: JSON.stringify({
                name: roomName,
                privacy: 'public', // Anyone with link can join
                properties: {
                    exp: expiryTime,
                    enable_chat: true,
                    enable_screenshare: true,
                    enable_recording: false,
                    start_video_off: false,
                    start_audio_off: false,
                    owner_only_broadcast: false,
                    enable_prejoin_ui: false,
                    enable_knocking: false,
                    enable_network_ui: true,
                    max_participants: 10
                }
            })
        });

        if (!response.ok) {
            const error = await response.json();
            console.error('Daily.co API error:', error);
            return res.status(500).json({ error: 'Failed to create video room', details: error.error || error.info });
        }

        const room = await response.json();

        res.json({
            success: true,
            roomUrl: room.url,
            roomName: room.name,
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
