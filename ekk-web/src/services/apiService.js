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

export default api;
