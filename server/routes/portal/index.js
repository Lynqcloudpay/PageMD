const express = require('express');
const authRoutes = require('./auth');
const chartRoutes = require('./chart');
const messageRoutes = require('./messages');
const appointmentRoutes = require('./appointments');
const telehealthRoutes = require('./telehealth');

const router = express.Router();

// Feature toggle
router.use((req, res, next) => {
    if (process.env.PATIENT_PORTAL_ENABLED !== 'true') {
        return res.status(404).json({ error: 'Patient Portal is currently disabled' });
    }
    next();
});

router.use('/auth', authRoutes);
router.use('/chart', chartRoutes);
router.use('/messages', messageRoutes);
router.use('/appointments', appointmentRoutes);
router.use('/telehealth', telehealthRoutes);
router.use('/push', require('./push'));

module.exports = router;
