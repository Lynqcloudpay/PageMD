import axios from 'axios';
import tokenManager from './tokenManager';
import { showError } from '../utils/toast';

const API_BASE_URL = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:5001/api' : '/api');

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token and clinic slug to requests
api.interceptors.request.use((config) => {
  const token = tokenManager.getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  // HIPAA: Clinic slug is used for multi-tenant routing
  // Priority: 1. URL query param (for public intake links), 2. localStorage (for staff)
  let clinicSlug = localStorage.getItem('clinic_slug');

  // For public pages, check URL for clinic param
  if (typeof window !== 'undefined') {
    const urlParams = new URLSearchParams(window.location.search);
    const urlClinic = urlParams.get('clinic');
    if (urlClinic) {
      clinicSlug = urlClinic;
    }
  }

  if (clinicSlug) {
    config.headers['x-clinic-slug'] = clinicSlug;
  }

  return config;
});

// Handle response errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Handle 401 Unauthorized - token invalid or missing
    if (error.response?.status === 401) {
      const url = error.config?.url || '';
      console.warn(`API: 401 Unauthorized from URL: ${url}`);
      // Don't clear token on login endpoint or public routes (that's expected)
      const isPublicRoute = url.includes('/intake/public/') || url.includes('/portal/auth/');
      if (!url.includes('/auth/login') && !isPublicRoute) {
        console.warn('API: Triggering global logout due to 401');
        tokenManager.clearToken();
        // Dispatch event for AuthContext to handle
        window.dispatchEvent(new CustomEvent('auth:unauthorized'));
      }
    }

    // Handle 403 Forbidden - insufficient permissions
    if (error.response?.status === 403) {
      const errorData = error.response?.data || {};
      const errorMessage = errorData.message || errorData.error || 'Permission denied';

      // HIPAA: Handle Restricted Chart access (requires Break-the-Glass)
      if (errorData.error === 'RESTRICTED_CHART' || errorData.code === 'RESTRICTED_CHART') {
        console.log('Detected RESTRICTED_CHART error, dispatching privacy:restricted event');

        // Extract patientId robustly from response data or URL
        const patientIdFromUrl = error.config?.url?.match(/\/patients\/([^/?#]+)/)?.[1];
        const patientId = errorData.patientId || patientIdFromUrl;

        window.dispatchEvent(new CustomEvent('privacy:restricted', {
          detail: {
            patientId: patientId,
            reason: errorData.restrictionReason || errorData.reason,
            config: error.config
          }
        }));
      } else {
        const missingPermission = errorData.missing || errorData.required;
        const toastMessage = missingPermission ? `Permission denied: ${missingPermission}` : errorMessage;
        showError(toastMessage, 5000);
        console.warn('403 Forbidden:', errorMessage, missingPermission ? `Missing: ${missingPermission}` : '');
      }
    }

    return Promise.reject(error);
  }
);

// Patients
export const patientsAPI = {
  search: (search) => {
    const params = typeof search === 'string' ? { search } : search;
    return api.get('/patients', { params });
  },
  getRecent: () => api.get('/patients/recent'),
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
  getSurgicalHistory: (patientId) => api.get(`/patients/${patientId}/surgical-history`),
  addSurgicalHistory: (patientId, data) => api.post(`/patients/${patientId}/surgical-history`, data),
  updateSurgicalHistory: (historyId, data) => api.put(`/patients/surgical-history/${historyId}`, data),
  deleteSurgicalHistory: (historyId) => api.delete(`/patients/surgical-history/${historyId}`),
  uploadPhoto: (patientId, formData) => api.post(`/patients/${patientId}/photo`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  uploadPhotoBase64: (patientId, photoData) => api.post(`/patients/${patientId}/photo/base64`, { photoData }),
  removePhoto: (id) => api.delete(`/patients/${id}/photo`),
  getHealthMaintenance: (patientId) => api.get(`/patients/${patientId}/health-maintenance`),
  addHealthMaintenance: (patientId, data) => api.post(`/patients/${patientId}/health-maintenance`, data),
  updateHealthMaintenance: (itemId, data) => api.put(`/patients/health-maintenance/${itemId}`, data),
  deleteHealthMaintenance: (itemId) => api.delete(`/patients/health-maintenance/${itemId}`),
};

// Visits
export const visitsAPI = {
  get: (id) => api.get(`/visits/${id}`),
  create: (data) => api.post('/visits', data),
  update: (id, data) => api.put(`/visits/${id}`, data),
  delete: (id) => api.delete(`/visits/${id}`),
  sign: (id, noteDraft, vitals, assignedAttendingId) => api.post(`/visits/${id}/sign`, { noteDraft, vitals, assignedAttendingId }),
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
  retract: (id, data) => api.post(`/visits/${id}/retract`, data),
  getRetraction: (id) => api.get(`/visits/${id}/retraction`),
  cosign: (id, data) => api.post(`/visits/${id}/cosign`, data),
  reject: (id, data) => api.post(`/visits/${id}/reject`, data),
  heartbeat: (id) => api.post(`/visits/${id}/heartbeat`),
  refineSection: (data) => api.post('/echo/refine-section', data),
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
  getLabTrend: (patientId, testName) => api.get(`/labs/trend/${patientId}/${encodeURIComponent(testName)}`),
};

// Inbox (Commercial-Grade Inbasket)
export const inboxAPI = {
  getAll: (params) => api.get('/inbox', { params }),
  getStats: () => api.get('/inbox/stats'),
  getDetails: (id) => api.get(`/inbox/${id}`),
  create: (data) => api.post('/inbox', data),
  update: (id, data) => api.put(`/inbox/${id}`, data),
  addNote: (id, note, isExternal = false) => api.post(`/inbox/${id}/notes`, { note, isExternal }),
  approveAppointment: (id, data) => api.post(`/inbox/${id}/approve-appointment`, data),
  denyAppointment: (id, reason) => api.post(`/inbox/${id}/deny-appointment`, { reason }),
  suggestSlots: (id, data) => api.post(`/inbox/${id}/suggest-slots`, data),
  sendPatientMessage: (data) => api.post('/inbox/patient-message', data),

  // Legacy aliases (mapped to new endpoints)
  markReviewed: (type, id, data) => api.put(`/inbox/${id}`, { status: 'completed', ...data }), // Note: backend handles status update
  saveComment: (type, id, data) => api.post(`/inbox/${id}/notes`, { note: data.comment }),
  delete: (id) => api.delete(`/inbox/${id}`),
};

// Clinical Tasks
export const tasksAPI = {
  getAll: (params) => api.get('/tasks', { params }),
  getStats: () => api.get('/tasks/stats'),
  get: (id) => api.get(`/tasks/${id}`),
  create: (data) => api.post('/tasks', data),
  update: (id, data) => api.put(`/tasks/${id}`, data),
  complete: (id, notes) => api.put(`/tasks/${id}/complete`, { notes }),
  delete: (id) => api.delete(`/tasks/${id}`),
};

// Appointments
export const appointmentsAPI = {
  get: (params) => api.get('/appointments', { params }),
  getStats: () => api.get('/appointments/stats'),
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

  // Stripe Subscription Integration (Dynamic Pricing)
  stripe: {
    getStatus: () => api.get('/billing/stripe/status'),
    getPreview: () => api.get('/billing/stripe/preview'),
    getHistory: () => api.get('/billing/stripe/history'),
    createCheckoutSession: () => api.post('/billing/stripe/create-checkout-session'),
    openPortal: () => api.post('/billing/stripe/portal'),
    sync: () => api.post('/billing/stripe/sync'),
  }
};

// Real Eligibility API (270/271)
export const eligibilityAPI = {
  verify: (data) => api.post('/eligibility/verify', data),
};

// Claim Submissions API (837P)
export const claimSubmissionsAPI = {
  getAll: () => api.get('/claim-submissions'),
  get: (id) => api.get(`/claim-submissions/${id}`),
  create: (claimIds) => api.post('/claim-submissions', { claimIds }),
  generate: (id, options = {}) => api.post(`/claim-submissions/${id}/generate`, { options }),
  submit: (id) => api.post(`/claim-submissions/${id}/submit`),
  resubmit: (claimId) => api.post(`/claim-submissions/resubmit/${claimId}`),
  downloadX12: (id) => api.get(`/claim-submissions/${id}/x12`, { responseType: 'blob' }),
};

// ERA API (835)
export const eraAPI = {
  getAll: (status) => api.get('/era', { params: { status } }),
  get: (id) => api.get(`/era/${id}`),
  upload: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/era/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },
  match: (eraClaimId, claimId) => api.post(`/era/${eraClaimId}/match`, { claimId }),
  post: (id) => api.post(`/era/${id}/post`),
  void: (id, reason) => api.post(`/era/${id}/void`, { reason }),
};

// Fee Sheet Categories (OpenEMR-style quick code groups)
export const feeSheetCategoriesAPI = {
  getAll: () => api.get('/fee-sheet-categories'),
  get: (id) => api.get(`/fee-sheet-categories/${id}`),
  create: (data) => api.post('/fee-sheet-categories', data),
  update: (id, data) => api.put(`/fee-sheet-categories/${id}`, data),
  delete: (id) => api.delete(`/fee-sheet-categories/${id}`),
  seedDefaults: () => api.post('/fee-sheet-categories/seed-defaults'),
};

// Fee Sheet (OpenEMR Port)
export const feeSheetAPI = {
  get: (visitId) => api.get(`/fee-sheet/${visitId}`),
  save: (visitId, data) => api.post(`/fee-sheet/${visitId}/save`, data),
  getPrice: (codeType, code, priceLevel) => api.get(`/fee-sheet/price/${codeType}/${code}`, { params: { priceLevel } }),
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

// ICD-10 Hierarchy (refinement questions for specifying codes)
export const icd10HierarchyAPI = {
  getQuestions: (code) => api.get(`/icd10/hierarchy/${code}`),
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
  searchICD10: (search) => api.get('/icd10/search', { params: { q: search } }),
  trackUsage: (icd10_id) => api.post('/icd10/track', { icd10_id }),
  searchCPT: (search) => api.get('/codes/cpt', { params: { search } }),
};

// Medications (RxNorm)
export const medicationsAPI = {
  search: (query) => api.get('/medications/search', { params: { q: query } }),
  getDetails: (rxcui) => api.get(`/medications/${rxcui}`),
  checkInteractions: (rxcuis) => api.get('/medications/interactions/check', {
    params: { rxcuis: Array.isArray(rxcuis) ? rxcuis.join(',') : rxcuis }
  }),
  trackUsage: (rxcui) => api.post('/medications/track', { rxcui }),
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

// Telehealth
export const telehealthAPI = {
  getStats: (params) => api.get('/telehealth/stats', { params }),
  createRoom: (data) => api.post('/telehealth/rooms', data),
  getRoom: (name) => api.get(`/telehealth/rooms/${name}`),
};

// Portal
export const portalAPI = {
  login: (credentials) => api.post('/portal/auth/login', credentials),
  register: (data) => api.post('/portal/auth/register', data),
  getProfile: () => api.get('/portal/profile'),
  getMedications: () => api.get('/portal/medications'),
  getResults: () => api.get('/portal/labs'),
  getAppointments: () => api.get('/portal/appointments'),
  requestAppointment: (data) => api.post('/portal/appointments', data),
  getMessages: () => api.get('/portal/messages'),
  sendMessage: (data) => api.post('/portal/messages', data),
  verifyInvite: (token) => api.get(`/portal/auth/invite/${token}`),
};

// Universal Digital Intake (QR Code)
export const intakeAPI = {
  // Public (No Auth)
  start: (data, clinic) => api.post(`/intake/public/start${clinic ? `?clinic=${clinic}` : ''}`, data, { skipAuth: true }),
  continue: (data, clinic) => api.post(`/intake/public/continue${clinic ? `?clinic=${clinic}` : ''}`, data, { skipAuth: true }),
  getSessionPublic: (id, credentials, clinic) => api.post(`/intake/public/session/${id}${clinic ? `?clinic=${clinic}` : ''}`, credentials, { skipAuth: true }),
  resume: (resumeCode, dob) => api.post('/intake/public/resume', { resumeCode, dob }, { skipAuth: true }), // Deprecated but kept for safety
  save: (id, data) => api.post(`/intake/public/save/${id}`, { data }, { skipAuth: true }),
  submit: (id, data, signature) => api.post(`/intake/public/submit/${id}`, { data, signature }, { skipAuth: true }),

  // Staff (Auth required)
  getStats: () => api.get('/intake/stats'),
  getSessions: () => api.get('/intake/sessions'),
  getSession: (id) => api.get(`/intake/session/${id}`),
  deleteSession: (id) => api.delete(`/intake/session/${id}`),
  regenerateCode: (id) => api.post(`/intake/session/${id}/regenerate-code`),
  approve: (id, linkToPatientId) => api.post(`/intake/session/${id}/approve`, { linkToPatientId }),
  needsEdits: (id, note) => api.post(`/intake/session/${id}/needs-edits`, { note }),
  getDuplicates: (id) => api.get(`/intake/session/${id}/duplicates`),
  clearRateLimits: (credentials) => api.post('/intake/clear-rate-limits', credentials || {}),
  getClinicInfo: () => api.get('/intake/public/clinic-info', { skipAuth: true })
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
  getDirectory: () => api.get('/users/directory'),
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
  uploadPracticeLogo: (formData) => api.post('/settings/practice/logo', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),

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

// Privacy & Audit
export const privacyAPI = {
  breakGlass: (patientId, data) => api.post(`/privacy/patients/${patientId}/break-glass`, data),
  updateRestriction: (patientId, data) => api.patch(`/privacy/patients/${patientId}/restriction`, data),
  getSettings: () => api.get('/privacy/settings'),
};

// Compliance & Analytics
export const complianceAPI = {
  getLogs: (params) => api.get('/compliance/logs', { params }),
  getAlerts: (params) => api.get('/compliance/alerts', { params }),
  resolveAlert: (id, resolutionNote) => api.patch(`/compliance/alerts/${id}/resolve`, { resolutionNote }),
  getStats: () => api.get('/compliance/stats'),
  getReports: (type, params) => api.get(`/compliance/reports/${type}`, { params }),
};

// Global Audit API
export const auditAPI = {
  getAdminLogs: (params) => api.get('/audit/admin', { params }),
  getPatientActivity: (patientId, params) => api.get(`/audit/patient/${patientId}`, { params }),
  getNoteHistory: (noteId) => api.get(`/audit/note/${noteId}`),
  exportAdminLogs: (params) => api.get('/audit/admin/export', { params, responseType: 'blob' }),
};

// Patient Flags
export const patientFlagsAPI = {
  getTypes: () => api.get('/patient-flags/types'),
  createType: (data) => api.post('/patient-flags/types', data),
  updateType: (id, data) => api.put(`/patient-flags/types/${id}`, data),
  deleteType: (id) => api.delete(`/patient-flags/types/${id}`),
  getByPatient: (patientId) => api.get(`/patient-flags/patient/${patientId}`),
  create: (patientId, data) => api.post(`/patient-flags/patient/${patientId}`, data),
  resolve: (id) => api.patch(`/patient-flags/${id}/resolve`),
  acknowledge: (id) => api.post(`/patient-flags/${id}/acknowledge`),
};

// Macros (Dot Phrases / Attestations)
export const macrosAPI = {
  getAll: (params) => api.get('/macros', { params }),
  getAttestations: (traineeRole) => api.get('/macros', { params: { category: 'Attestation', traineeRole } }),
  create: (data) => api.post('/macros', data),
  update: (id, data) => api.put(`/macros/${id}`, data),
  delete: (id) => api.delete(`/macros/${id}`),
};

// Partner & API Management
export const partnersAPI = {
  getPartners: (params) => api.get('/admin/partners', { params }),
  createPartner: (data) => api.post('/admin/partners', data),
  getPartner: (id) => api.get(`/admin/partners/${id}`),
  updatePartner: (id, data) => api.patch(`/admin/partners/${id}`, data),

  getApps: (partnerId) => api.get(`/admin/partners/${partnerId}/apps`),
  createApp: (partnerId, data) => api.post(`/admin/partners/${partnerId}/apps`, data),
  getApp: (id) => api.get(`/admin/apps/${id}`),
  updateApp: (id, data) => api.patch(`/admin/apps/${id}`, data),
  rotateSecret: (id) => api.post(`/admin/apps/${id}/rotate-secret`),

  getRateLimitPolicies: () => api.get('/admin/rate-limit-policies'),
  getScopes: () => api.get('/admin/scopes'),
};

// Growth Reward (Referrals)
export const growthAPI = {
  getStats: () => api.get('/growth/stats'),
  invite: (data) => api.post('/growth/invite', data),
  getAlerts: () => api.get('/growth/alerts'),
  dismissAlert: (id) => api.post(`/growth/alerts/${id}/dismiss`),
  dismissAllAlerts: () => api.post('/growth/alerts/dismiss-all'),
};

// Unified Notifications (System, Billing, Growth)
export const notificationsAPI = {
  getAll: () => api.get('/notifications'),
  dismiss: (id) => api.post(`/notifications/${id}/dismiss`),
  dismissAll: (ids) => api.post('/notifications/dismiss-all', { alertIds: ids }),
};

export default api;

