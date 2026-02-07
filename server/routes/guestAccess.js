/**
 * Guest Access Routes
 * 
 * Public routes for telehealth magic link access.
 * These routes do NOT require authentication - they use token-based validation.
 */
const express = require('express');
const crypto = require('crypto');
const pool = require('../db');
const { preparePatientForResponse } = require('../services/patientEncryptionService');

const router = express.Router();

// Daily.co API configuration
const DAILY_API_KEY = process.env.DAILY_API_KEY;
const DAILY_API_URL = 'https://api.daily.co/v1';
const axios = require('axios');
const { isSandboxMode } = require('../services/simulationInterceptor');

/**
 * GET /api/visit/guest/validate
 * Validates a guest access token and returns appointment status
 * 
 * Query: token
 * Returns: { status: 'ready' | 'too_early' | 'expired' | 'invalid', appointmentTime?, providerName? }
 */
router.get('/validate', async (req, res) => {
    try {
        const { token } = req.query;

        if (!token) {
            console.log('[Guest Access] Missing token in request');
            return res.json({ status: 'invalid' });
        }

        // Clean token to avoid copy-paste issues
        const cleanToken = token.trim();
        const tokenHash = crypto.createHash('sha256').update(cleanToken).digest('hex');

        console.log(`[Guest Access] Validating token: ${cleanToken.substring(0, 8)}...`);

        // Find token record
        const result = await pool.query(`
            SELECT 
                gat.*,
                a.appointment_date,
                a.appointment_time,
                a.duration,
                a.status as appointment_status,
                a.patient_status,
                u.first_name as provider_first_name,
                u.last_name as provider_last_name,
                c.phone as clinic_phone,
                c.display_name as clinic_name
            FROM guest_access_tokens gat
            JOIN appointments a ON gat.appointment_id = a.id
            LEFT JOIN users u ON a.provider_id = u.id
            LEFT JOIN clinics c ON c.id = a.clinic_id
            WHERE gat.token_hash = $1
        `, [tokenHash]);

        if (result.rows.length === 0) {
            console.log(`[Guest Access] Token not found or hash mismatch. Hash: ${tokenHash}`);
            return res.json({ status: 'invalid' });
        }

        const record = result.rows[0];

        // Check if token was invalidated
        if (record.invalidated_at) {
            console.log('[Guest Access] Token was invalidated at:', record.invalidated_at);
            return res.json({ status: 'invalid' });
        }

        // Check if appointment was completed or cancelled
        const completedStatuses = ['completed', 'checked_out'];
        const cancelledStatuses = ['cancelled', 'no_show'];

        if (completedStatuses.includes(record.appointment_status) ||
            completedStatuses.includes(record.patient_status)) {
            console.log('[Guest Access] Appointment is completed. Returning status: completed');
            return res.json({
                status: 'completed',
                providerName: `Dr. ${record.provider_last_name || 'Provider'}`
            });
        }

        if (cancelledStatuses.includes(record.appointment_status) ||
            cancelledStatuses.includes(record.patient_status)) {
            console.log('[Guest Access] Appointment is cancelled/no-show. Status: expired');
            return res.json({ status: 'expired' });
        }

        // Check DOB attempt limit
        if (record.dob_attempts >= 5) {
            console.log('[Guest Access] Max DOB attempts exceeded');
            return res.json({ status: 'invalid' });
        }

        // Calculate appointment window
        // Use expiration from DB as primary source of truth for "too late"
        const appointmentDate = new Date(record.appointment_date);
        const [hours, minutes] = (record.appointment_time || '09:00').split(':').map(Number);
        appointmentDate.setHours(hours, minutes, 0, 0);

        const durationMinutes = record.duration || 30;
        const windowStart = new Date(appointmentDate.getTime() - 15 * 60 * 1000); // 15 min before

        const now = new Date();

        // Check if token expired
        if (now > new Date(record.expires_at)) {
            console.log('[Guest Access] Token expired. Now:', now.toISOString(), 'Expires:', record.expires_at);
            return res.json({ status: 'expired' });
        }

        // Check if too early
        if (now < windowStart) {
            console.log('[Guest Access] Too early. Window starts:', windowStart.toISOString());
            return res.json({
                status: 'too_early',
                appointmentTime: appointmentDate.toISOString(),
                providerName: `Dr. ${record.provider_last_name || 'Provider'}`,
                clinicPhone: record.clinic_phone || null
            });
        }

        // Ready for DOB verification
        return res.json({
            status: 'ready',
            appointmentTime: appointmentDate.toISOString(),
            providerName: `Dr. ${record.provider_last_name || 'Provider'}`,
            clinicPhone: record.clinic_phone || null,
            clinicName: record.clinic_name || 'PageMD'
        });

    } catch (error) {
        console.error('[Guest Access] Validation error:', error);
        return res.json({ status: 'invalid' });
    }
});

/**
 * POST /api/visit/guest/verify-dob
 * Verifies patient DOB for guest access
 * 
 * Body: { token, dob } (dob in YYYY-MM-DD format)
 * Returns: { success: boolean, error?: string }
 */
router.post('/verify-dob', async (req, res) => {
    try {
        const { token, dob } = req.body;

        if (!token || !dob) {
            return res.status(400).json({ success: false, error: 'Missing required fields' });
        }

        const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

        // Find token and patient
        const result = await pool.query(`
            SELECT 
                gat.*,
                COALESCE(p.dob, p.date_of_birth) as dob_record,
                p.encryption_metadata,
                a.status as appointment_status,
                a.patient_status
            FROM guest_access_tokens gat
            JOIN appointments a ON gat.appointment_id = a.id
            JOIN patients p ON gat.patient_id = p.id
            WHERE gat.token_hash = $1
        `, [tokenHash]);

        if (result.rows.length === 0) {
            return res.status(400).json({ success: false, error: 'Invalid link' });
        }

        const record = result.rows[0];

        // Check if already invalidated or max attempts
        if (record.invalidated_at || record.dob_attempts >= 5) {
            return res.status(400).json({ success: false, error: 'This link is no longer valid' });
        }

        // Check if appointment closed
        const closedStatuses = ['completed', 'checked_out', 'cancelled', 'no_show'];
        if (closedStatuses.includes(record.appointment_status) ||
            closedStatuses.includes(record.patient_status)) {
            return res.status(400).json({ success: false, error: 'This appointment has ended' });
        }

        // Normalize DOB for comparison (YYYY-MM-DD)
        // CRITICAL: Use UTC methods to avoid off-by-one errors from timezones
        let storedDob = '';
        const dobValue = record.dob_record;

        if (dobValue) {
            if (dobValue instanceof Date) {
                const year = dobValue.getUTCFullYear();
                const month = String(dobValue.getUTCMonth() + 1).padStart(2, '0');
                const day = String(dobValue.getUTCDate()).padStart(2, '0');
                storedDob = `${year}-${month}-${day}`;
            } else {
                storedDob = String(dobValue).substring(0, 10);
            }
        }

        const inputDob = (dob || '').substring(0, 10);

        console.log(`[Guest Access] DOB Check - Input: ${inputDob}, Stored: ${storedDob}`);

        if (storedDob !== inputDob) {
            // Increment attempt counter
            await pool.query(`
                UPDATE guest_access_tokens 
                SET dob_attempts = dob_attempts + 1 
                WHERE id = $1
            `, [record.id]);

            const newAttempts = record.dob_attempts + 1;

            if (newAttempts >= 5) {
                // Invalidate token after 5 failed attempts
                await pool.query(`
                    UPDATE guest_access_tokens 
                    SET invalidated_at = CURRENT_TIMESTAMP 
                    WHERE id = $1
                `, [record.id]);

                return res.status(400).json({
                    success: false,
                    error: 'Too many incorrect attempts. Please contact the office.'
                });
            }

            return res.status(400).json({
                success: false,
                error: 'Date of birth does not match our records'
            });
        }

        // Success! Generate a session token for video access
        const sessionToken = crypto.randomBytes(32).toString('hex');
        const sessionHash = crypto.createHash('sha256').update(sessionToken).digest('hex');

        // Store session (valid for 2 hours)
        await pool.query(`
            UPDATE guest_access_tokens 
            SET used_at = CURRENT_TIMESTAMP
            WHERE id = $1
        `, [record.id]);

        // Return session token (client will use this to join the call)
        res.json({
            success: true,
            sessionToken,
            appointmentId: record.appointment_id
        });

    } catch (error) {
        console.error('[Guest Access] DOB verification error:', error);
        return res.status(500).json({ success: false, error: 'Verification failed' });
    }
});

/**
 * POST /api/visit/guest/join
 * Generates Daily.co room URL for verified guest
 * 
 * Body: { token, sessionToken }
 * Returns: { success: boolean, roomUrl?: string }
 */
router.post('/join', async (req, res) => {
    try {
        const { token } = req.body;

        if (!token) {
            return res.status(400).json({ success: false, error: 'Missing token' });
        }

        const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

        // Verify token is valid and has been DOB-verified (used_at is set)
        const result = await pool.query(`
            SELECT 
                gat.*,
                a.id as appointment_id,
                a.status as appointment_status,
                p.first_name,
                p.last_name,
                p.encryption_metadata
            FROM guest_access_tokens gat
            JOIN appointments a ON gat.appointment_id = a.id
            JOIN patients p ON gat.patient_id = p.id
            WHERE gat.token_hash = $1
              AND gat.used_at IS NOT NULL
              AND gat.invalidated_at IS NULL
        `, [tokenHash]);

        if (result.rows.length === 0) {
            return res.status(400).json({ success: false, error: 'Invalid or unverified access' });
        }

        const record = result.rows[0];

        // Decrypt patient name
        const decryptedPatient = await preparePatientForResponse({
            first_name: record.first_name,
            last_name: record.last_name,
            encryption_metadata: record.encryption_metadata
        });
        const patientName = `${decryptedPatient.first_name || ''} ${decryptedPatient.last_name || ''}`.trim() || 'Patient';

        // Generate Daily.co room access
        if (isSandboxMode()) {
            return res.json({
                success: true,
                roomUrl: `https://pagemdemr.com/telehealth/mock/${record.appointment_id}?role=guest`,
                patientName,
                isSimulated: true
            });
        }

        if (!DAILY_API_KEY) {
            console.error('[Guest Access] DAILY_API_KEY missing');
            return res.status(500).json({ success: false, error: 'Video service not configured' });
        }

        const roomName = `pagemd-appt-${record.appointment_id}`.toLowerCase();
        const expiryTime = Math.floor(Date.now() / 1000) + 7200; // 2 hours from now

        // Ensure room exists (matching provider logic in telehealth.js)
        let room;
        try {
            const roomResponse = await axios.get(`${DAILY_API_URL}/rooms/${roomName}`, {
                headers: { 'Authorization': `Bearer ${DAILY_API_KEY}` }
            });
            room = roomResponse.data;
        } catch (error) {
            if (error.response?.status === 404) {
                // Create room if it doesn't exist (allow patient to be first one in)
                try {
                    const createResponse = await axios.post(`${DAILY_API_URL}/rooms`, {
                        name: roomName,
                        privacy: 'private',
                        properties: {
                            exp: expiryTime,
                            enable_chat: true,
                            enable_screenshare: true,
                            enable_prejoin_ui: false,
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
                    console.error('[Guest Access] Room Creation Failed:', createError.response?.data || createError.message);
                    return res.status(500).json({ success: false, error: 'Failed to initialize video room' });
                }
            } else {
                throw error;
            }
        }

        // Generate patient token (not owner)
        const tokenResponse = await axios.post(`${DAILY_API_URL}/meeting-tokens`, {
            properties: {
                room_name: roomName,
                user_name: patientName,
                is_owner: false,
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
            patientName
        });

    } catch (error) {
        console.error('[Guest Access] Join error:', error);
        return res.status(500).json({ success: false, error: 'Failed to join video room' });
    }
});

module.exports = router;
