import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';

const api = axios.create({
    baseURL: API_BASE_URL,
    timeout: 30000,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Request interceptor - attach auth token
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('authToken');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// Response interceptor - handle auth errors
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            localStorage.removeItem('authToken');
            localStorage.removeItem('user');
            window.location.href = '/login';
        }
        return Promise.reject(error);
    }
);

export default api;

// Auth API
export const authApi = {
    login: (email, password) => api.post('/auth/login', { email, password }),
    logout: () => api.post('/auth/logout'),
    me: () => api.get('/auth/me'),
};

// Patients API
export const patientsApi = {
    search: (query) => api.get('/patients', { params: { search: query } }),
    getById: (id) => api.get(`/patients/${id}`),
    getSnapshot: (id) => api.get(`/patients/${id}/snapshot`),
};

// Visits API
export const visitsApi = {
    getToday: () => api.get('/visits', { params: { date: new Date().toISOString().split('T')[0] } }),
    getAll: () => api.get('/visits'),
    getById: (id) => api.get(`/visits/${id}`),
    updateStatus: (id, status) => api.patch(`/visits/${id}/status`, { status }),
    getByPatient: (patientId) => api.get(`/patients/${patientId}/visits`),
};

// Orders API
export const ordersApi = {
    getByVisit: (visitId) => api.get(`/visits/${visitId}/orders`),
    create: (visitId, orderData) => api.post(`/visits/${visitId}/orders`, orderData),
    search: (query) => api.get('/orders/catalog', { params: { search: query } }),
};

// Notes/Documentation API
export const notesApi = {
    getByVisit: (visitId) => api.get(`/visits/${visitId}/notes`),
    save: (visitId, noteData) => api.post(`/visits/${visitId}/notes`, noteData),
    sign: (visitId, noteId) => api.patch(`/visits/${visitId}/notes/${noteId}/sign`),
};

// Vitals API
export const vitalsApi = {
    getByVisit: (visitId) => api.get(`/visits/${visitId}/vitals`),
    save: (visitId, vitalsData) => api.post(`/visits/${visitId}/vitals`, vitalsData),
};
