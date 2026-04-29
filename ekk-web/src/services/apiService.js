import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000',
});

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
  return api.post('/api/capture/', payload).then((res) => res.data);
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

export default api;
