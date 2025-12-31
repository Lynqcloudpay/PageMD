import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

const api = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Add auth token and clinic slug to requests (same as main EMR)
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }

    // HIPAA: Clinic slug is used for multi-tenant routing
    const clinicSlug = localStorage.getItem('clinic_slug');
    if (clinicSlug) {
        config.headers['x-clinic-slug'] = clinicSlug;
    }

    return config;
});

// Handle response errors (same as main EMR)
api.interceptors.response.use(
    (response) => response,
    (error) => {
        // Handle 401 Unauthorized - token invalid or missing
        if (error.response?.status === 401) {
            if (!error.config?.url?.includes('/auth/login')) {
                console.warn('401 Unauthorized - clearing token');
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                window.location.href = '/login';
            }
        }

        // Handle 403 Forbidden
        if (error.response?.status === 403) {
            console.warn('403 Forbidden:', error.response?.data?.message);
        }

        return Promise.reject(error);
    }
);

export default api;

// Expose the same API structure as main EMR's api.js
export const authAPI = {
    login: (email, password) => api.post('/auth/login', { email, password }),
    getMe: () => api.get('/auth/me'),
    getProviders: () => api.get('/auth/providers'),
};

export const appointmentsAPI = {
    get: (params) => api.get('/appointments', { params }),
    getById: (id) => api.get(`/appointments/${id}`),
    update: (id, data) => api.put(`/appointments/${id}`, data),
};

export const patientsAPI = {
    search: (query) => api.get('/patients', { params: { search: query } }),
    get: (id) => api.get(`/patients/${id}`),
    getSnapshot: (id) => api.get(`/patients/${id}/snapshot`),
    getAllergies: (patientId) => api.get(`/patients/${patientId}/allergies`),
    getMedications: (patientId) => api.get(`/patients/${patientId}/medications`),
    getProblems: (patientId) => api.get(`/patients/${patientId}/problems`),
};

export const visitsAPI = {
    get: (id) => api.get(`/visits/${id}`),
    getByPatient: (patientId) => api.get('/visits', { params: { patientId } }),
    getPending: (providerId) => api.get('/visits/pending', { params: { providerId } }),
    openToday: (patientId, noteType = 'office_visit', providerId) =>
        api.post(`/visits/open-today/${patientId}`, { noteType, providerId }),
};

export const ordersAPI = {
    getByPatient: (patientId) => api.get(`/orders/patient/${patientId}`),
    create: (data) => api.post('/orders', data),
};

export const vitalsAPI = {
    getByPatient: (patientId) => api.get(`/vitals/patient/${patientId}`),
    save: (visitId, data) => api.post(`/visits/${visitId}/vitals`, data),
};
