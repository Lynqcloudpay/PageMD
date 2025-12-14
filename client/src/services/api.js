import axios from 'axios';
import tokenManager from './tokenManager';

// Use relative path for production (same-origin), Vite proxy handles dev
const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000, // 10 second timeout for all requests (increased for slower connections)
});

// Add auth token to requests (from memory-only token manager)
api.interceptors.request.use((config) => {
  const token = tokenManager.getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 errors - clear token and redirect to login
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Clear invalid token
      tokenManager.clearToken();
      // Only redirect if we're not already on the login page
      if (window.location.pathname !== '/login' && window.location.pathname !== '/') {
        // Dispatch a custom event that AuthContext can listen to
        window.dispatchEvent(new CustomEvent('auth:unauthorized'));
      }
    }
    return Promise.reject(error);
  }
);

// Patients
export const patientsAPI = {
  search: (query) => api.get('/patients', { params: { search: query } }),
  get: (id) => api.get(`/patients/${id}`),
  getSnapshot: (id) => api.get(`/patients/${id}/snapshot`),
  create: (data) => api.post('/patients', data),
  update: (id, data) => api.put(`/patients/${id}`, data),
  delete: (id) => api.delete(`/patients/${id}`),
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
  delete: (id) => api.delete(`/visits/${id}`),
  sign: (id, noteDraft, vitals) => api.post(`/visits/${id}/sign`, { noteDraft, vitals }, { timeout: 30000 }),
  addAddendum: (id, addendumText) => api.post(`/visits/${id}/addendum`, { addendumText }),
  signAddendum: (id, addendumIndex) => api.post(`/visits/${id}/addendum/${addendumIndex}/sign`),
  getByPatient: (patientId) => api.get('/visits', { params: { patientId } }),
  getPending: (providerId) => api.get('/visits/pending', { params: { providerId } }),
  findOrCreate: (patientId, visitType, forceNew = false) => api.post('/visits/find-or-create', { patientId, visitType, forceNew }),
  generateSummary: (id) => api.post(`/visits/${id}/summary`),
};

// Orders
export const ordersAPI = {
  getByPatient: (patientId) => api.get(`/orders/patient/${patientId}`),
  getByVisit: (visitId) => api.get(`/orders/visit/${visitId}`),
  create: (data) => api.post('/orders', data),
  update: (id, data) => api.put(`/orders/${id}`, data),
  delete: (id) => api.delete(`/orders/${id}`),
  toggleFavorite: (id) => api.post(`/orders/${id}/favorite`),
};

// Ordersets
export const ordersetsAPI = {
  getAll: (params) => api.get('/ordersets', { params }),
  get: (id) => api.get(`/ordersets/${id}`),
  create: (data) => api.post('/ordersets', data),
  apply: (id, data) => api.post(`/ordersets/${id}/apply`, data),
  toggleFavorite: (id) => api.post(`/ordersets/${id}/favorite`),
};

// ICD-10 Hierarchy
export const icd10HierarchyAPI = {
  getParents: () => api.get('/icd10-hierarchy'),
  getQuestions: (code) => api.get(`/icd10-hierarchy/${code}`),
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
  getByVisit: (visitId) => api.get(`/referrals/visit/${visitId}`),
  create: (data) => api.post('/referrals', data),
  update: (id, data) => api.put(`/referrals/${id}`, data),
  delete: (id) => api.delete(`/referrals/${id}`),
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

// Cancellation Follow-ups
export const followupsAPI = {
  getAll: (params) => api.get('/followups', { params }),
  getStats: (params) => api.get('/followups/stats', { params }),
  ensure: (data) => api.post('/followups/ensure', data),
  addNote: (id, data) => api.post(`/followups/${id}/notes`, data),
  address: (id, data) => api.put(`/followups/${id}/address`, data),
  dismiss: (id, data) => api.put(`/followups/${id}/dismiss`, data),
};

// Billing
export const billingAPI = {
  // Fee Schedule
  getFeeSchedule: (params) => api.get('/billing/fee-schedule', { params }),

  // Insurance
  getInsurance: () => api.get('/billing/insurance'),
  verifyEligibility: (data) => api.post('/billing/eligibility/verify', data),
  getEligibility: (patientId) => api.get(`/billing/eligibility/patient/${patientId}`),

  // Claims
  createClaim: (data) => api.post('/billing/claims', data),
  getClaim: (id) => api.get(`/billing/claims/${id}`),
  getClaimsByPatient: (patientId) => api.get(`/billing/claims/patient/${patientId}`),
  getAllClaims: (params) => api.get('/billing/claims', { params }),
  updateClaim: (id, data) => api.put(`/billing/claims/${id}`, data),
  submitClaim: (id, data) => api.post(`/billing/claims/${id}/submit`, data),
  deleteClaim: (id) => api.delete(`/billing/claims/${id}`),

  // Payments
  postPayment: (data) => api.post('/billing/payments', data),
  getPaymentsByClaim: (claimId) => api.get(`/billing/payments/claim/${claimId}`),

  // Denials
  createDenial: (data) => api.post('/billing/denials', data),
  getDenialsByClaim: (claimId) => api.get(`/billing/denials/claim/${claimId}`),
  appealDenial: (id, data) => api.post(`/billing/denials/${id}/appeal`, data),

  // Prior Authorizations
  createPriorAuth: (data) => api.post('/billing/prior-authorizations', data),
  getPriorAuthsByPatient: (patientId) => api.get(`/billing/prior-authorizations/patient/${patientId}`),

  // Statistics
  getStatistics: (params) => api.get('/billing/statistics', { params }),
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

// Medications (RxNorm)
export const medicationsAPI = {
  search: (query) => api.get('/medications/search', { params: { q: query } }),
  getDetails: (rxcui) => api.get(`/medications/${rxcui}`),
  checkInteractions: (rxcuis) => api.get('/medications/interactions/check', {
    params: { rxcuis: Array.isArray(rxcuis) ? rxcuis.join(',') : rxcuis }
  }),
};

// Prescriptions
export const prescriptionsAPI = {
  create: (data) => api.post('/prescriptions/create', data),
  send: (id, data) => api.post(`/prescriptions/${id}/send`, data),
  getByPatient: (patientId, params) => api.get(`/prescriptions/patient/${patientId}`, { params }),
  get: (id) => api.get(`/prescriptions/${id}`),
};

// Pharmacies
export const pharmaciesAPI = {
  search: (params) => api.get('/pharmacies/search', { params }),
  getNearby: (params) => api.get('/pharmacies/nearby', { params }),
  get: (id) => api.get(`/pharmacies/${id}`),
  getByNCPDP: (ncpdpId) => api.get(`/pharmacies/ncpdp/${ncpdpId}`),
};

// Auth
export const authAPI = {
  login: (email, password) => api.post('/auth/login', { email, password }, { timeout: 20000 }), // 20 second timeout for login (Argon2 can be slow)
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

// Users
export const usersAPI = {
  getAll: (params) => api.get('/users', { params }),
  get: (id) => api.get(`/users/${id}`),
  create: (data) => api.post('/users', data),
  update: (id, data) => api.put(`/users/${id}`, data),
  updatePassword: (id, password) => api.put(`/users/${id}/password`, { password }),
  updateStatus: (id, data) => api.put(`/users/${id}/status`, data),
  delete: (id) => api.delete(`/users/${id}`),
  getPrivileges: (id) => api.get(`/users/${id}/privileges`),
};

// Roles
export const rolesAPI = {
  getAll: () => api.get('/roles'),
  get: (id) => api.get(`/roles/${id}`),
  create: (data) => api.post('/roles', data),
  update: (id, data) => api.put(`/roles/${id}`, data),
  delete: (id) => api.delete(`/roles/${id}`),
  getPrivileges: (id) => api.get(`/roles/${id}/privileges`),
  updatePrivileges: (id, privilegeIds) => api.put(`/roles/${id}/privileges`, { privilegeIds }),
  assignPrivilege: (id, privilegeId) => api.post(`/roles/${id}/privileges`, { privilegeId }),
  removePrivilege: (id, privilegeId) => api.delete(`/roles/${id}/privileges/${privilegeId}`),
  getAllPrivileges: () => api.get('/roles/privileges/all'),
};

// Settings API
export const settingsAPI = {
  // Get all settings
  getAll: () => api.get('/settings/all'),

  // Practice settings
  getPractice: () => api.get('/settings/practice'),
  updatePractice: (data) => api.put('/settings/practice', data),

  // Security settings
  getSecurity: () => api.get('/settings/security'),
  updateSecurity: (data) => api.put('/settings/security', data),

  // Clinical settings
  getClinical: () => api.get('/settings/clinical'),
  updateClinical: (data) => api.put('/settings/clinical', data),

  // Email settings
  getEmail: () => api.get('/settings/email'),
  updateEmail: (data) => api.put('/settings/email', data),

  // Feature flags
  getFeatures: () => api.get('/settings/features'),
  updateFeature: (key, data) => api.put(`/settings/features/${key}`, data),
};

export default api;

