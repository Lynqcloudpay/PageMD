import api from './api';

export const billingService = {
    getReports: async (filters) => {
        const { data } = await api.get('/billing-openemr/reports', { params: filters });
        return data;
    },
    generateClaims: async (encounters, partnerId, batchId) => {
        const { data } = await api.post('/billing-openemr/claims/generate', { encounters, partnerId, batchId });
        return data;
    },
    getClaim: async (id) => {
        const { data } = await api.get(`/billing-openemr/claims/${id}`);
        return data;
    },
    searchPatients: async (q) => {
        const { data } = await api.get('/billing-openemr/patients/search', { params: { q } });
        return data;
    },
    getOpenEncounters: async (patientId) => {
        const { data } = await api.get('/billing-openemr/encounters/open', { params: { patientId } });
        return data;
    },
    getEncounterLedger: async (encounterId) => {
        const { data } = await api.get(`/billing-openemr/encounters/${encounterId}/ledger`);
        return data;
    },
    createARSession: async (sessionData) => {
        const { data } = await api.post('/billing-openemr/ar/session', sessionData);
        return data;
    },
    distributePayment: async (sessionId, items) => {
        const { data } = await api.post(`/billing-openemr/ar/session/${sessionId}/distribute`, { items });
        return data;
    },
    getEncounterBalance: async (encounterId) => {
        const { data } = await api.get(`/billing-openemr/encounter/${encounterId}/balance`);
        return data.balance;
    },
    getARAging: async (asOfDate) => {
        const { data } = await api.get('/billing-openemr/reports/ar-aging', { params: { asOfDate } });
        return data;
    },
    getCollectionsReport: async (filters) => {
        const { data } = await api.get('/billing-openemr/reports/collections', { params: filters });
        return data;
    },
    getPatientStatement: async (patientId, from, to) => {
        const { data } = await api.get(`/billing-openemr/statements/patient/${patientId}`, { params: { from, to } });
        return data;
    },
    sendToCollections: async (encounterId, agency) => {
        const { data } = await api.post('/billing-openemr/collections/send', { encounterId, agency });
        return data;
    }
};
