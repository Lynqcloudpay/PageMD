import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Patients
export const patientsAPI = {
  search: (query) => api.get('/patients', { params: { search: query } }),
  get: (id) => api.get(`/patients/${id}`),
  getSnapshot: (id) => api.get(`/patients/${id}/snapshot`),
  create: (data) => api.post('/patients', data),
  update: (id, data) => api.put(`/patients/${id}`, data),
  addAllergy: (patientId, data) => api.post(`/patients/${patientId}/allergies`, data),
  updateAllergy: (allergyId, data) => api.put(`/patients/allergies/${allergyId}`, data),
  deleteAllergy: (allergyId) => api.delete(`/patients/allergies/${allergyId}`),
  getAllergies: (patientId) => api.get(`/patients/${patientId}/allergies`),
  addMedication: (patientId, data) => api.post(`/patients/${patientId}/medications`, data),
  updateMedication: (medicationId, data) => api.put(`/patients/medications/${medicationId}`, data),
  deleteMedication: (medicationId) => api.delete(`/patients/medications/${medicationId}`),
  getMedications: (patientId) => api.get(`/patients/${patientId}/medications`),
  addProblem: (patientId, data) => api.post(`/patients/${patientId}/problems`, data),
  updateProblem: (problemId, data) => api.put(`/patients/problems/${problemId}`, data),
  deleteProblem: (problemId) => api.delete(`/patients/problems/${problemId}`),
  getProblems: (patientId) => api.get(`/patients/${patientId}/problems`),
  getFamilyHistory: (patientId) => api.get(`/patients/${patientId}/family-history`),
  addFamilyHistory: (patientId, data) => api.post(`/patients/${patientId}/family-history`, data),
  updateFamilyHistory: (historyId, data) => api.put(`/patients/family-history/${historyId}`, data),
  deleteFamilyHistory: (historyId) => api.delete(`/patients/family-history/${historyId}`),
  getSocialHistory: (patientId) => api.get(`/patients/${patientId}/social-history`),
  saveSocialHistory: (patientId, data) => api.post(`/patients/${patientId}/social-history`, data),
  uploadPhoto: (patientId, formData) => api.post(`/patients/${patientId}/photo`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  uploadPhotoBase64: (patientId, photoData) => api.post(`/patients/${patientId}/photo/base64`, { photoData }),
};

// Visits
export const visitsAPI = {
  get: (id) => api.get(`/visits/${id}`),
  create: (data) => api.post('/visits', data),
  update: (id, data) => api.put(`/visits/${id}`, data),
  sign: (id, noteDraft, vitals) => api.post(`/visits/${id}/sign`, { noteDraft, vitals }),
  getByPatient: (patientId) => api.get('/visits', { params: { patientId } }),
  getPending: (providerId) => api.get('/visits/pending', { params: { providerId } }),
  findOrCreate: (patientId, visitType) => api.post('/visits/find-or-create', { patientId, visitType }),
  generateSummary: (id) => api.post(`/visits/${id}/summary`),
};

// Orders
export const ordersAPI = {
  getByPatient: (patientId) => api.get(`/orders/patient/${patientId}`),
  create: (data) => api.post('/orders', data),
  update: (id, data) => api.put(`/orders/${id}`, data),
};

// Documents (update endpoint)
export const documentsAPIUpdate = {
  update: (id, data) => api.put(`/documents/${id}`, data),
};

// Documents
export const documentsAPI = {
  getByPatient: (patientId) => api.get(`/documents/patient/${patientId}`),
  upload: (formData) => api.post('/documents', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  getFile: (id) => api.get(`/documents/${id}/file`, { responseType: 'blob' }),
};

// Referrals
export const referralsAPI = {
  getByPatient: (patientId) => api.get(`/referrals/patient/${patientId}`),
  create: (data) => api.post('/referrals', data),
  update: (id, data) => api.put(`/referrals/${id}`, data),
};

// Messages
export const messagesAPI = {
  get: (params) => api.get('/messages', { params }),
  create: (data) => api.post('/messages', data),
  markRead: (id) => api.put(`/messages/${id}/read`),
};

// Labs
export const labsAPI = {
  getByPatient: (patientId) => api.get(`/labs/patient/${patientId}`),
};

// Inbox
export const inboxAPI = {
  getAll: (params) => api.get('/inbox', { params }),
  getLabTrend: (patientId, testName) => api.get(`/inbox/lab-trend/${patientId}/${encodeURIComponent(testName)}`),
};

// Appointments
export const appointmentsAPI = {
  get: (params) => api.get('/appointments', { params }),
  getById: (id) => api.get(`/appointments/${id}`),
  create: (data) => api.post('/appointments', data),
  update: (id, data) => api.put(`/appointments/${id}`, data),
  delete: (id) => api.delete(`/appointments/${id}`),
};

// Billing
export const billingAPI = {
  getFeeSchedule: () => api.get('/billing/fee-schedule'),
  getInsurance: () => api.get('/billing/insurance'),
  createClaim: (data) => api.post('/billing/claims', data),
  getClaimsByPatient: (patientId) => api.get(`/billing/claims/patient/${patientId}`),
};

// Reports
export const reportsAPI = {
  getRegistry: (condition, search) => api.get(`/reports/registry/${condition}`, { params: { search } }),
  getQualityMeasures: (params) => api.get('/reports/quality-measures', { params }),
  getDashboard: () => api.get('/reports/dashboard'),
};

// HL7
export const hl7API = {
  receive: (message) => api.post('/hl7/receive', { message }),
  send: (orderId) => api.post('/hl7/send', { orderId }),
};

// Insurance
export const insuranceAPI = {
  getPlans: () => api.get('/insurance/plans'),
  createPlan: (data) => api.post('/insurance/plans', data),
  updatePatientInsurance: (patientId, data) => api.put(`/insurance/patient/${patientId}`, data),
};

// Alerts
export const alertsAPI = {
  getByPatient: (patientId, activeOnly = true) => api.get(`/alerts/patient/${patientId}`, { params: { activeOnly } }),
  create: (data) => api.post('/alerts', data),
  acknowledge: (id) => api.put(`/alerts/${id}/acknowledge`),
};

// Codes (ICD-10, CPT)
export const codesAPI = {
  searchICD10: (search) => api.get('/codes/icd10', { params: { search } }),
  searchCPT: (search) => api.get('/codes/cpt', { params: { search } }),
};

// Auth
export const authAPI = {
  login: (email, password) => api.post('/auth/login', { email, password }),
  register: (data) => api.post('/auth/register', {
    email: data.email,
    password: data.password,
    firstName: data.firstName,
    lastName: data.lastName,
    role: data.role || 'clinician'
  }),
  getMe: () => api.get('/auth/me'),
  getProviders: () => api.get('/auth/providers'),
};

export default api;

