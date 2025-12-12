// Test script to upload mock EKG
// Run with: node test-ekg-upload.js

const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const axios = require('axios');

const API_BASE_URL = process.env.API_URL || 'http://localhost:3000/api';
const MOCK_EKG_PATH = path.join(__dirname, 'mock-ekg.svg');

// You'll need to set this token from your browser's localStorage after logging in
const TOKEN = process.env.TOKEN || '';

// Patient ID - you'll need to replace this with an actual patient ID
const PATIENT_ID = process.env.PATIENT_ID || '';

async function uploadMockEKG() {
    if (!TOKEN) {
        console.error('Error: Please set TOKEN environment variable');
        console.log('Get your token from browser localStorage after logging in');
        console.log('Then run: TOKEN=your_token PATIENT_ID=patient_id node test-ekg-upload.js');
        return;
    }

    if (!PATIENT_ID) {
        console.error('Error: Please set PATIENT_ID environment variable');
        console.log('Get patient ID from the URL when viewing a patient');
        return;
    }

    if (!fs.existsSync(MOCK_EKG_PATH)) {
        console.error(`Error: Mock EKG file not found at ${MOCK_EKG_PATH}`);
        return;
    }

    try {
        const formData = new FormData();
        formData.append('file', fs.createReadStream(MOCK_EKG_PATH));
        formData.append('patientId', PATIENT_ID);
        formData.append('docType', 'ekg');

        console.log('Uploading mock EKG...');
        const response = await axios.post(
            `${API_BASE_URL}/documents/upload`,
            formData,
            {
                headers: {
                    ...formData.getHeaders(),
                    'Authorization': `Bearer ${TOKEN}`
                }
            }
        );

        console.log('✅ Mock EKG uploaded successfully!');
        console.log('Document ID:', response.data.id);
        console.log('Filename:', response.data.filename);
        console.log('\nRefresh the patient snapshot page to see the EKG in the module.');
    } catch (error) {
        console.error('Error uploading EKG:', error.response?.data || error.message);
    }
}

uploadMockEKG();
