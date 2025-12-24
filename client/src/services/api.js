import axios from 'axios';
import tokenManager from './tokenManager';
import { showError } from '../utils/toast';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = tokenManager.getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  } else {
    // Log when token is missing for debugging
    if (process.env.NODE_ENV === 'development') {
      console.warn('API request without token:', config.url);
    }
  }
  return config;
});

// Handle response errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Handle 401 Unauthorized - token invalid or missing
    if (error.response?.status === 401) {
      // Don't clear token on login endpoint (that's expected)
      if (!error.config?.url?.includes('/auth/login')) {
        console.warn('401 Unauthorized - clearing token and dispatching event');
        tokenManager.clearToken();
        // Dispatch event for AuthContext to handle
        window.dispatchEvent(new CustomEvent('auth:unauthorized'));
      }
    }

    // Handle 403 Forbidden - insufficient permissions
    if (error.response?.status === 403) {
      const errorMessage = error.response?.data?.message ||
        error.response?.data?.error ||
        'You do not have permission to perform this action';
      const missingPermission = error.response?.data?.missing || error.response?.data?.required;

      let toastMessage = errorMessage;
      if (missingPermission) {
        toastMessage = `Permission denied: ${missingPermission}`;
      }

      showError(toastMessage, 5000);
      console.warn('403 Forbidden:', errorMessage, missingPermission ? `Missing: ${missingPermission}` : '');
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
  sign: (id, noteDraft, vitals) => api.post(`/visits/${id}/sign`, { noteDraft, vitals }),
  addAddendum: (id, addendumText) => api.post(`/visits/${id}/addendum`, { addendumText }),
  getByPatient: (patientId) => api.get('/visits', { params: { patientId } }),
  getPending: (providerId) => api.get('/visits/pending', { params: { providerId } }),
  getTodayDraft: (patientId, providerId) => {
    const params = providerId ? { providerId } : {};
    return api.get(`/visits/today-draft/${patientId}`, { params });
  },
  openToday: (patientId, noteType = 'office_visit', providerId) =>
    api.post(`/visits/open-today/${patientId}`, { noteType, providerId }),
  findOrCreate: (patientId, visitType, forceNew = false) => api.post('/visits/find-or-create', { patientId, visitType, forceNew }),
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
  delete: (id) => api.delete(`/documents/${id}`),
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
  updateTaskStatus: (id, status) => api.put(`/messages/${id}/task`, { taskStatus: status }),
};

// Labs
export const labsAPI = {
  getByPatient: (patientId) => api.get(`/labs/patient/${patientId}`),
};

// Inbox
export const inboxAPI = {
  getAll: (params) => api.get('/inbox', { params }),
  getLabTrend: (patientId, testName) => api.get(`/inbox/lab-trend/${patientId}/${encodeURIComponent(testName)}`),
  markReviewed: (type, id, data) => api.put(`/inbox/${type}/${id}/reviewed`, data),
  saveComment: (type, id, data) => api.put(`/inbox/${type}/${id}/comment`, data),
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
  getStats: () => api.get('/followups/stats'),
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

// Superbills
export const superbillsAPI = {
  fromVisit: (visitId) => api.post(`/superbills/from-visit/${visitId}`),
  getByPatient: (patientId) => api.get(`/superbills/patient/${patientId}`),
  get: (id) => api.get(`/superbills/${id}`),
  update: (id, data) => api.put(`/superbills/${id}`, data),
  addDiagnosis: (id, data) => api.post(`/superbills/${id}/diagnoses`, data),
  addLine: (id, data) => api.post(`/superbills/${id}/lines`, data),
  updateLine: (id, lineId, data) => api.put(`/superbills/${id}/lines/${lineId}`, data),
  deleteDiagnosis: (id, diagId) => api.delete(`/superbills/${id}/diagnoses/${diagId}`),
  deleteLine: (id, lineId) => api.delete(`/superbills/${id}/lines/${lineId}`),
  finalize: (id) => api.post(`/superbills/${id}/finalize`),
  void: (id) => api.post(`/superbills/${id}/void`),
  markReady: (id) => api.post(`/superbills/${id}/ready`),
  unmarkReady: (id) => api.post(`/superbills/${id}/unready`),
  sync: (id) => api.post(`/superbills/${id}/sync`),
  deleteSuggestedLine: (id, lineId) => api.delete(`/superbills/${id}/suggested-lines/${lineId}`),
  printUrl: (id) => `${API_BASE_URL}/superbills/${id}/print`,
  exportCMS1500: (id) => api.get(`/superbills/${id}/export/cms1500`),
  export837P: (id) => api.get(`/superbills/${id}/export/837p`),
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
export const icd10API = {
  search: (q, limit = 20) => api.get('/icd10/search', { params: { q, limit } }),
  getFavorites: () => api.get('/icd10/favorites'),
  addFavorite: (icd10_id) => api.post('/icd10/favorites', { icd10_id }),
  removeFavorite: (icd10_id) => api.delete(`/icd10/favorites/${icd10_id}`),
  trackUsage: (icd10_id) => api.post('/icd10/track', { icd10_id }),
  getRecent: (limit = 20) => api.get('/icd10/recent', { params: { limit } }),
};

export const ordersCatalogAPI = {
  search: (q, type, limit = 20) => api.get('/orders-catalog/search', { params: { q, type, limit } }),
  getFavorites: () => api.get('/orders-catalog/favorites'),
  addFavorite: (catalog_id) => api.post('/orders-catalog/favorites', { catalog_id }),
  removeFavorite: (catalog_id) => api.delete(`/orders-catalog/favorites/${catalog_id}`),
  trackUsage: (catalog_id) => api.post('/orders-catalog/track', { catalog_id }),
  getRecent: (type, limit = 10) => api.get('/orders-catalog/recent', { params: { type, limit } }),
  createVisitOrder: (visitId, data) => api.post(`/orders-catalog/visit/${visitId}`, data),
  getVisitOrders: (visitId) => api.get(`/orders-catalog/visit/${visitId}`),
  updateInstance: (id, data) => api.patch(`/orders-catalog/instance/${id}`, data),
};

export const codesAPI = {
  searchICD10: async (search) => {
    if (!search || search.length < 2) {
      // Return broad popular codes if search is empty
      if (!search) return {
        data: [
          { code: 'I10', description: 'Essential (primary) hypertension' },
          { code: 'E11.9', description: 'Type 2 diabetes mellitus without complications' },
          { code: 'E78.5', description: 'Hyperlipidemia, unspecified' },
          { code: 'F41.1', description: 'Generalized anxiety disorder' },
          { code: 'M54.5', description: 'Low back pain' },
          { code: 'N39.0', description: 'Urinary tract infection, site not specified' },
          { code: 'J06.9', description: 'Acute upper respiratory infection, unspecified' },
          { code: 'K21.9', description: 'Gastro-esophageal reflux disease without esophagitis' }
        ]
      };
      return { data: [] };
    }
    try {
      // Use NLM Clinical Tables API with wider search fields
      // sf=all searches name, code, synonyms, etc.
      const response = await axios.get('https://clinicaltables.nlm.nih.gov/api/icd10cm/v3/search', {
        params: {
          terms: search,
          maxList: 100,
          df: 'code,name',
          sf: 'code,name,synonyms' // Search across code, name and synonyms
        }
      });
      // Response format: [count, codes, null, [[code, description], ...]]
      const results = response.data[3] || [];
      const mapped = results.map(item => ({
        code: item[0],
        description: item[1],
        billable: true
      }));
      return { data: mapped };
    } catch (error) {
      console.error('External ICD10 search failed, falling back to local:', error);
      // Fallback to local if external fails
      return api.get('/codes/icd10', { params: { search } });
    }
  },
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

// E-Prescribing (DoseSpot)
export const eprescribeAPI = {
  getStatus: () => api.get('/eprescribe/status'),
  createSession: (patientId, returnUrl) => api.post('/eprescribe/session', { patientId, returnUrl }),
  getPrescriptions: (patientId) => api.get(`/eprescribe/patient/${patientId}/prescriptions`),
  createDraft: (patientId, data) => api.post(`/eprescribe/patient/${patientId}/prescriptions`, data),
  sendPrescription: (prescriptionId) => api.post(`/eprescribe/prescriptions/${prescriptionId}/send`),
  cancelPrescription: (prescriptionId, reason) => api.post(`/eprescribe/prescriptions/${prescriptionId}/cancel`, { reason }),
  searchPharmacies: (query, location) => api.get('/eprescribe/pharmacies/search', {
    params: { query, ...location }
  }),
  searchMedications: (query) => api.get('/eprescribe/medications/search', {
    params: { query }
  }),
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
  getLocations: () => api.get('/settings/locations'),
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

// Order Sets
export const ordersetsAPI = {
  getAll: (params) => api.get('/ordersets', { params }),
  get: (id) => api.get(`/ordersets/${id}`),
  create: (data) => api.post('/ordersets', data),
  update: (id, data) => api.put(`/ordersets/${id}`, data),
  delete: (id) => api.delete(`/ordersets/${id}`),
  getByDiagnosis: (diagnosis) => api.get(`/ordersets/diagnosis/${encodeURIComponent(diagnosis)}`),
};

export default api;

