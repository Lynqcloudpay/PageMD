import axios from 'axios';

// Create API instance
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Handle 401 Unauthorized globally
    if (error.response?.status === 401) {
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// Auth
export const authAPI = {
  login: (email, password) => api.post('/auth/login', { email, password }),
  logout: () => api.post('/auth/logout'),
  getCurrentUser: () => api.get('/auth/me'),
  getUsers: () => api.get('/users'), // Admin only
  createUser: (data) => api.post('/users', data), // Admin only
  updateUser: (id, data) => api.put(`/users/${id}`, data), // Admin only
  deleteUser: (id) => api.delete(`/users/${id}`), // Admin only
};

// Patients
export const patientsAPI = {
  getAll: (params) => api.get('/patients', { params }),
  get: (id) => api.get(`/patients/${id}`),
  create: (data) => api.post('/patients', data),
  update: (id, data) => api.put(`/patients/${id}`, data),
  getSnapshot: (id) => api.get(`/patients/${id}/snapshot`),

  // Problems
  addProblem: (id, data) => api.post(`/patients/${id}/problems`, data),
  updateProblem: (problemId, data) => api.put(`/patients/problems/${problemId}`, data),
  deleteProblem: (problemId) => api.delete(`/patients/problems/${problemId}`),

  // Medications
  addMedication: (id, data) => api.post(`/patients/${id}/medications`, data),
  updateMedication: (medId, data) => api.put(`/patients/medications/${medId}`, data),
  deleteMedication: (medId) => api.delete(`/patients/medications/${medId}`),

  // Allergies
  addAllergy: (id, data) => api.post(`/patients/${id}/allergies`, data),
  updateAllergy: (allergyId, data) => api.put(`/patients/allergies/${allergyId}`, data),
  deleteAllergy: (allergyId) => api.delete(`/patients/allergies/${allergyId}`),

  // Family History
  addFamilyHistory: (id, data) => api.post(`/patients/${id}/family-history`, data),
  updateFamilyHistory: (histId, data) => api.put(`/patients/family-history/${histId}`, data),
  deleteFamilyHistory: (histId) => api.delete(`/patients/family-history/${histId}`),

  // Social History
  saveSocialHistory: (id, data) => api.post(`/patients/${id}/social-history`, data),

  // Photos
  uploadPhoto: (id, formData) => api.post(`/patients/${id}/photo`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  uploadPhotoBase64: (id, base64Data) => api.post(`/patients/${id}/photo-base64`, { photo: base64Data }),
};

// Visits (Notes)
export const visitsAPI = {
  get: (id) => api.get(`/visits/${id}`),
  update: (id, data) => api.put(`/visits/${id}`, data),
  saveDraft: (id, noteDraft, vitals) => api.put(`/visits/${id}/draft`, { noteDraft, vitals }),
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

// Codes (ICD-10, CPT)
export const codesAPI = {
  searchICD10: (query) => api.get('/codes/search/icd10', { params: { q: query } }),
  favoritesICD10: () => api.get('/codes/favorites/icd10'),
  addFavoriteICD10: (code) => api.post('/codes/favorites/icd10', code),
  removeFavoriteICD10: (code) => api.delete(`/codes/favorites/icd10/${code}`),
};

// Medications (RxNorm)
export const medicationsAPI = {
  search: (query) => api.get('/medications/search', { params: { q: query } }),
};

// Admin
export const adminAPI = {
  getBackups: () => api.get('/admin/backups'),
  createBackup: () => api.post('/admin/backups'),
  restoreBackup: (filename) => api.post(`/admin/backups/${filename}/restore`),
  getAuditLogs: (params) => api.get('/admin/audit-logs', { params }),

  // RBAC Management
  getRoles: () => api.get('/admin/roles'),
  getPrivileges: () => api.get('/admin/privileges'),
  assignRole: (userId, roleId) => api.post(`/admin/users/${userId}/roles`, { roleId }),
  updateRolePrivileges: (roleId, privilegeIds) => api.put(`/admin/roles/${roleId}/privileges`, { privilegeIds }),
};

// e-Prescribe (DoseSpot)
export const eprescribeAPI = {
  getStatus: () => api.get('/eprescribe/status'),
  getPrescriptions: (patientId) => api.get(`/eprescribe/patient/${patientId}/prescriptions`),
  getSSOUrl: (patientId) => api.get(`/eprescribe/sso/${patientId}`),
  syncMedications: (patientId) => api.post(`/eprescribe/sync/${patientId}`),
};

export default api;
