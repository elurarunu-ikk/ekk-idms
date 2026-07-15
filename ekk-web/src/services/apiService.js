import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000',
});

export const getApiErrorMessage = (error, fallback = 'Something went wrong') => {
  const detail = error?.response?.data?.detail;

  if (typeof detail === 'string' && detail.trim()) {
    return detail;
  }

  if (Array.isArray(detail)) {
    const combined = detail
      .map((item) => {
        if (typeof item === 'string') return item;
        if (item && typeof item.msg === 'string') return item.msg;
        return '';
      })
      .filter(Boolean)
      .join('; ');

    if (combined) {
      return combined;
    }
  }

  if (detail && typeof detail === 'object' && typeof detail.msg === 'string') {
    return detail.msg;
  }

  if (typeof error?.response?.data?.message === 'string' && error.response.data.message.trim()) {
    return error.response.data.message;
  }

  if (typeof error?.message === 'string' && error.message.trim()) {
    return error.message;
  }

  return fallback;
};

// Request interceptor: attach Bearer token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: handle 401 and redirect to login
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('username');
      localStorage.removeItem('idms_session');
      localStorage.removeItem('selected_project_id');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export const loginUser = (email, password) =>
  api.post('/auth/login', { email, password }).then((res) => res.data);

export const logoutUser = () =>
  api.post('/auth/logout').catch(() => {});

export const getSession = () => api.get('/auth/me').then((res) => res.data);

export const changePassword = (payload) => api.post('/auth/change-password', payload).then((res) => res.data);

// Capture API endpoints
export const listCaptures = (params) => {
  return api.get('/api/capture/', { params }).then((res) => res.data);
};

export const listPending = (projectId) => {
  const params = projectId ? { project_id: projectId } : {};
  return api.get('/api/capture/pending', { params }).then((res) => res.data);
};

export const getCapture = (id) => {
  return api.get(`/api/capture/${id}`).then((res) => res.data);
};

export const getProject = (projectId) => {
  return api.get(`/api/projects/${projectId}`).then((res) => res.data);
};

export const listProjects = (params) => {
  return api.get('/api/projects/', { params }).then((res) => res.data);
};

export const createProject = (payload) => {
  return api.post('/api/projects/', payload).then((res) => res.data);
};

export const updateProjectMaster = (projectId, payload) => {
  return api.put(`/api/projects/${projectId}`, payload).then((res) => res.data);
};

export const listCompanies = (params) => {
  return api.get('/api/companies/', { params }).then((res) => res.data);
};

export const createCompany = (payload) => {
  return api.post('/api/companies/', payload).then((res) => res.data);
};

export const updateCompany = (companyId, payload) => {
  return api.put(`/api/companies/${companyId}`, payload).then((res) => res.data);
};

export const listUsers = (params) => {
  return api.get('/api/users/', { params }).then((res) => res.data);
};

export const createUser = (payload) => {
  return api.post('/api/users/', payload).then((res) => res.data);
};

export const updateUser = (userId, payload) => {
  return api.put(`/api/users/${userId}`, payload).then((res) => res.data);
};

export const listEntryMedia = (entryId) => {
  return api.get(`/api/media/entry/${entryId}`).then((res) => res.data);
};

export const createCapture = (payload) => {
  return api.post('/api/capture/with-resources', payload).then((res) => res.data);
};

export const updateCapture = (id, payload) => {
  return api.put(`/api/capture/${id}`, payload).then((res) => res.data);
};

export const approveCapture = (id, approvedBy) => {
  return api.post(`/api/capture/${id}/approve`, { approved_by: approvedBy }).then((res) => res.data);
};

export const rejectCapture = (id, reason) => {
  return api.post(`/api/capture/${id}/reject`, { reason }).then((res) => res.data);
};

export const deleteCapture = (id) => {
  return api.delete(`/api/capture/${id}`).then((res) => res.data);
};

// Dashboard stats: combine 4 requests
export const getDashboardStats = async (projectId) => {
  const maybeProject = projectId ? { project_id: projectId } : {};
  const [totalRes, approvedRes, rejectedRes, pendingRes] = await Promise.all([
    listCaptures({ ...maybeProject, skip: 0, limit: 1 }),
    listCaptures({ ...maybeProject, approved: true, skip: 0, limit: 1 }),
    listCaptures({ ...maybeProject, rejected: true, skip: 0, limit: 1 }),
    listPending(projectId),
  ]);

  return {
    total: totalRes.total || 0,
    approved: approvedRes.total || 0,
    rejected: rejectedRes.total || 0,
    pending: pendingRes.total || 0,
  };
};

// Reference Data — Grade Sheet
export const uploadGradeSheet = (projectId, file) => {
  const form = new FormData();
  form.append('project_id', projectId);
  form.append('file', file);
  return api
    .post('/reference-data/upload-grade-sheet', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    .then((r) => r.data);
};

export const getLevelRegisterSummary = (projectId) =>
  api
    .get('/level-register/summary/', { params: { project_id: projectId } })
    .then((r) => r.data);

export const listLevelRegister = (params) =>
  api.get('/level-register/', { params }).then((r) => r.data);

export const listOGL = (params) =>
  api.get('/ogl/', { params }).then((r) => r.data);

export const listOGLAnalysisPaged = (params) =>
  api.get('/ogl/analysis/paged/', { params }).then((r) => r.data);

export const listGPS = (params) =>
  api.get('/gps/', { params }).then((r) => r.data);

export const downloadLevelRegister = (projectId, layerCode = null) => {
  const params = { project_id: projectId };
  if (layerCode) params.layer_code = layerCode;
  return api
    .get('/level-register/download/', { params, responseType: 'blob' })
    .then((r) => r.data);
};

export const downloadOGL = (projectId) =>
  api
    .get('/ogl/download/', { params: { project_id: projectId }, responseType: 'blob' })
    .then((r) => r.data);

export const downloadOGLAnalysis = (projectId) =>
  api
    .get('/ogl/analysis/download/', { params: { project_id: projectId }, responseType: 'blob' })
    .then((r) => r.data);

export const downloadGPS = (projectId) =>
  api
    .get('/gps/download/', { params: { project_id: projectId }, responseType: 'blob' })
    .then((r) => r.data);

export const getChatStarters = (projectId) =>
  api
    .get('/chat/starters', { params: { project_id: projectId } })
    .then((r) => r.data);

export const askAI = (projectId, message, history = []) =>
  api
    .post('/chat/ask', {
      project_id: projectId,
      message,
      history,
    })
    .then((r) => r.data);

// ── 3M Resources Master Data ─────────────────────────────────────────────────

export const listMaterials = (projectId, activeOnly = true) =>
  api.get('/api/resources/materials', { params: { project_id: projectId, active_only: activeOnly } }).then((r) => r.data);

export const createMaterial = (payload) =>
  api.post('/api/resources/materials', payload).then((r) => r.data);

export const updateMaterial = (materialId, payload) =>
  api.patch(`/api/resources/materials/${materialId}`, payload).then((r) => r.data);

export const deleteMaterial = (materialId) =>
  api.delete(`/api/resources/materials/${materialId}`).then((r) => r.data);

export const listMachines = (projectId, activeOnly = true) =>
  api.get('/api/resources/machines', { params: { project_id: projectId, active_only: activeOnly } }).then((r) => r.data);

export const createMachine = (payload) =>
  api.post('/api/resources/machines', payload).then((r) => r.data);

export const updateMachine = (machineId, payload) =>
  api.patch(`/api/resources/machines/${machineId}`, payload).then((r) => r.data);

export const deleteMachine = (machineId) =>
  api.delete(`/api/resources/machines/${machineId}`).then((r) => r.data);

export const listManpowerCategories = (activeOnly = true) =>
  api.get('/api/resources/manpower-categories', { params: { active_only: activeOnly } }).then((r) => r.data);

// ── User Management v2 (IAM) ──────────────────────────────────────────────────

export const listUsersV2 = (params) =>
  api.get('/api/v1/users/', { params }).then((r) => r.data);

export const getUserById = (id) =>
  api.get(`/api/v1/users/${id}`).then((r) => r.data);

export const createUserV2 = (payload) =>
  api.post('/api/v1/users/', payload).then((r) => r.data);

export const updateUserV2 = (id, payload) =>
  api.put(`/api/v1/users/${id}`, payload).then((r) => r.data);

export const activateUser = (id) =>
  api.post(`/api/v1/users/${id}/activate`).then((r) => r.data);

export const deactivateUser = (id) =>
  api.post(`/api/v1/users/${id}/deactivate`).then((r) => r.data);

export const resetUserPassword = (id, payload) =>
  api.post(`/api/v1/users/${id}/reset-password`, payload).then((r) => r.data);

export const changeMyPassword = (payload) =>
  api.post('/api/v1/users/me/change-password', payload).then((r) => r.data);

export const cloneUser = (sourceId, payload) =>
  api.post(`/api/v1/users/${sourceId}/clone`, payload).then((r) => r.data);

export const getUserAuditLog = (id, params) =>
  api.get(`/api/v1/users/${id}/audit-log`, { params }).then((r) => r.data);

export const getPermissionSummary = (id) =>
  api.get(`/api/v1/permissions/summary/${id}`).then((r) => r.data);

export const bulkImportUsers = (file, dryRun = true) => {
  const form = new FormData();
  form.append('file', file);
  form.append('dry_run', dryRun);
  return api.post('/api/v1/users/bulk-import', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then((r) => r.data);
};

export const exportUsers = (params) =>
  api.get('/api/v1/users/export', { params, responseType: 'blob' }).then((r) => r.data);

export const getUserActivity = () =>
  api.get('/api/v1/users/activity').then((r) => r.data);

export const lookupHR = (q) =>
  api.get('/api/v1/hr/lookup', { params: { q } }).then((r) => r.data);

export const validatePermissions = (payload) =>
  api.post('/api/v1/permissions/validate', payload).then((r) => r.data);

export const getRoleSuggestion = (designation, department) =>
  api.get('/api/v1/hr/role-suggest', { params: { designation, department } }).then((r) => r.data);

export const saveFormRights = (userId, formRights, userType = 'USER') =>
  api.post(`/api/v1/permissions/form-rights/${userId}`, { user_type: userType, form_rights: formRights }).then((r) => r.data);

export const listSites = (params) =>
  api.get('/api/projects/', { params }).then((r) => r.data);

export const listModules = () =>
  api.get('/api/v1/modules/').then((r) => r.data);

export const listForms = (moduleId) =>
  api.get('/api/v1/forms/', { params: { module_id: moduleId } }).then((r) => r.data);

export const grantTempAccess = (payload) =>
  api.post('/api/v1/permissions/temp-access', payload).then((r) => r.data);

export const revokeTempAccess = (id) =>
  api.delete(`/api/v1/permissions/temp-access/${id}/revoke`).then((r) => r.data);

export const impersonateUser = (userId, reason) =>
  api.post(`/api/v1/users/${userId}/impersonate`, { reason }).then((r) => r.data);

export const endImpersonation = () =>
  api.post('/api/v1/users/impersonate/end').then((r) => r.data);

export const downloadBulkImportTemplate = () =>
  api.get('/api/v1/users/import-template', { responseType: 'blob' }).then((r) => r.data);

export const getUserSites = (id) =>
  api.get(`/api/v1/users/${id}/sites`).then((r) => r.data);

export const updateUserSites = (id, payload) =>
  api.put(`/api/v1/users/${id}/sites`, payload).then((r) => r.data);

export const getUserDeviceSessions = (id) =>
  api.get(`/api/v1/users/${id}/device-sessions`).then((r) => r.data);

export const resetUserDevice = (id) =>
  api.post(`/api/v1/users/${id}/reset-device`).then((r) => r.data);

export const getMobileUsers = () =>
  api.get('/api/v1/users/mobile-users').then((r) => r.data);

export const getAppVersionInfo = () =>
  api.get('/app/version').then((r) => r.data);

export const forceLogoutUser = (id, platform = null) =>
  api.post(`/api/v1/users/${id}/force-logout`, null, {
    params: platform ? { platform } : {},
  }).then((r) => r.data);

export const upsertUserProjectAccess = (userId, rows) =>
  api.post(`/api/v1/users/${userId}/project-access`, rows).then((r) => r.data);

export const getUserProjectAccess = (userId) =>
  api.get(`/api/v1/users/${userId}/project-access`).then((r) => r.data);

export const listActiveProjects = () =>
  api.get('/api/projects/').then((r) => r.data);

export const listCapturesV2 = (params) =>
  api.get('/api/capture/', { params }).then((res) => res.data);

export const listPendingV2 = (params) =>
  api.get('/api/capture/pending', { params }).then((res) => res.data);

/**
 * Get capture counts and total LM grouped by work_type and layer_code.
 * Used by dashboard to show capture progress per layer.
 */
export const getCapturesByLayer = async (projectId) => {
  const res = await listCaptures({
    project_id: projectId,
    skip: 0,
    limit: 500,
  });

  const entries = res.entries || [];

  const grouped = {};
  for (const entry of entries) {
    const key = `${entry.work_type || 'UNKNOWN'}__${entry.layer_code || '—'}`;
    if (!grouped[key]) {
      grouped[key] = {
        work_type: entry.work_type || 'UNKNOWN',
        layer_code: entry.layer_code || '—',
        total: 0,
        approved: 0,
        pending: 0,
        rejected: 0,
        total_lm: 0,
      };
    }
    grouped[key].total += 1;
    grouped[key].total_lm += parseFloat(entry.quantity_lm || 0);
    if (entry.approved) grouped[key].approved += 1;
    else if (entry.rejected) grouped[key].rejected += 1;
    else grouped[key].pending += 1;
  }

  return Object.values(grouped).sort((a, b) => b.total - a.total);
};

export const getUserPermissions = (userId) =>
  api.get(`/api/v1/permissions/summary/${userId}`).then(r => r.data);

export const updateUserModules = (userId, moduleIds) =>
  api.put(`/api/v1/users/${userId}/modules`, { module_ids: moduleIds }).then(r => r.data);

export default api;
