/**
 * ChartGateway.js
 * 
 * Single unified data gateway for all patient chart data.
 * All reads go through Mother endpoints exclusively.
 * This eliminates split-brain between legacy and Mother data.
 */

import api from './api';

const ChartGateway = {
    /**
     * Get patient summary including demographics, current state, and recent events
     */
    async getPatientSummary(patientId) {
        const response = await api.get(`/mother/patient/${patientId}/summary`);
        return response.data;
    },

    /**
     * Get current derived state (vitals, meds, problems, orders, allergies)
     */
    async getPatientState(patientId) {
        const response = await api.get(`/mother/patient/${patientId}/state`);
        return response.data;
    },

    /**
     * Get patient event timeline with pagination
     */
    async getPatientTimeline(patientId, { limit = 50, offset = 0 } = {}) {
        const response = await api.get(`/mother/patient/${patientId}/timeline`, {
            params: { limit, offset }
        });
        return response.data;
    },

    /**
     * Get AI-optimized context for the patient
     */
    async getAIContext(patientId) {
        const response = await api.get(`/mother/patient/${patientId}/ai-context`);
        return response.data;
    },

    /**
     * Search documents for a patient
     */
    async searchDocuments(patientId, query) {
        const response = await api.get(`/mother/patient/${patientId}/documents`, {
            params: { query }
        });
        return response.data;
    },

    /**
     * Get all documents for a patient
     */
    async getDocuments(patientId) {
        const response = await api.get(`/mother/patient/${patientId}/documents`);
        return response.data;
    },

    // ========== WRITE OPERATIONS ==========
    // These call Mother endpoints which handle event emission + legacy shadow writes

    /**
     * Record vitals for a patient
     */
    async recordVitals(patientId, encounterId, vitalsData) {
        const response = await api.post(`/mother/patient/${patientId}/vitals`, {
            encounter_id: encounterId,
            ...vitalsData
        });
        return response.data;
    },

    /**
     * Add medication
     */
    async addMedication(patientId, encounterId, medicationData) {
        const response = await api.post(`/mother/patient/${patientId}/medications`, {
            encounter_id: encounterId,
            ...medicationData
        });
        return response.data;
    },

    /**
     * Add diagnosis
     */
    async addDiagnosis(patientId, encounterId, diagnosisData) {
        const response = await api.post(`/mother/patient/${patientId}/diagnoses`, {
            encounter_id: encounterId,
            ...diagnosisData
        });
        return response.data;
    }
};

export default ChartGateway;
