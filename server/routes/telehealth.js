const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');

// Daily.co API configuration
const DAILY_API_KEY = process.env.DAILY_API_KEY;
const DAILY_API_URL = 'https://api.daily.co/v1';

// Create a telehealth room
router.post('/rooms', requireAuth, async (req, res) => {
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
                    enable_recording: false, // Set to true if you need recording
                    start_video_off: false,
                    start_audio_off: false,
                    owner_only_broadcast: false,
                    enable_prejoin_ui: false, // Skip the "join" screen
                    enable_knocking: false,
                    enable_network_ui: true,
                    max_participants: 10
                }
            })
        });

        if (!response.ok) {
            const error = await response.json();
            console.error('Daily.co API error:', error);
            return res.status(500).json({ error: 'Failed to create video room' });
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

// Get room info
router.get('/rooms/:roomName', requireAuth, async (req, res) => {
    try {
        const { roomName } = req.params;

        if (!DAILY_API_KEY) {
            return res.status(500).json({ error: 'Daily.co API key not configured' });
        }

        const response = await fetch(`${DAILY_API_URL}/rooms/${roomName}`, {
            headers: {
                'Authorization': `Bearer ${DAILY_API_KEY}`
            }
        });

        if (!response.ok) {
            if (response.status === 404) {
                return res.status(404).json({ error: 'Room not found or expired' });
            }
            return res.status(500).json({ error: 'Failed to get room info' });
        }

        const room = await response.json();
        res.json(room);

    } catch (error) {
        console.error('Error getting room info:', error);
        res.status(500).json({ error: 'Failed to get room info' });
    }
});

// Delete a room (cleanup)
router.delete('/rooms/:roomName', requireAuth, async (req, res) => {
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
