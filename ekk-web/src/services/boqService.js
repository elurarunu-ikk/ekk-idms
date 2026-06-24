import api from './apiService';

export const listBoqVersions = (projectId) =>
  api.get('/api/boq/versions', { params: { project_id: projectId } }).then((res) => res.data);

export const getBoqRegister = (params) =>
  api.get('/api/boq/register', { params }).then((res) => res.data);

export const listChangeRequests = (params) =>
  api.get('/api/boq/change-requests', { params }).then((res) => res.data);

export const createChangeRequest = (payload) =>
  api.post('/api/boq/change-request', payload).then((res) => res.data);

export const approveChangeRequest = (changeId, payload) =>
  api.post(`/api/boq/change-request/${changeId}/approve`, payload).then((res) => res.data);

export const rejectChangeRequest = (changeId, payload) =>
  api.post(`/api/boq/change-request/${changeId}/reject`, payload).then((res) => res.data);

// GET /api/boq/activity-mapping
export const listActivityMappings = (projectId) =>
  api.get('/api/boq/activity-mapping', { params: { project_id: projectId } })
    .then((res) => res.data);

// POST /api/boq/activity-mapping/suggest
export const suggestActivityMappings = (projectId) =>
  api.post('/api/boq/activity-mapping/suggest', {}, { params: { project_id: projectId } })
    .then((res) => res.data);

// POST /api/boq/activity-mapping/bulk-confirm
export const bulkConfirmMappings = (projectId, suggestions) =>
  api.post('/api/boq/activity-mapping/bulk-confirm',
    { project_id: projectId, suggestions })
    .then((res) => res.data);

// POST /api/boq/activity-mapping (single manual entry)
export const createActivityMapping = (payload) =>
  api.post('/api/boq/activity-mapping', payload).then((res) => res.data);

// DELETE /api/boq/activity-mapping/:id (deactivate)
export const deactivateMapping = (mappingId) =>
  api.delete(`/api/boq/activity-mapping/${mappingId}`).then((res) => res.data);

// Load all master data needed by AddMappingModal in one parallel batch
export const getMasterData = () =>
  Promise.all([
    api.get('/api/masters/work-types').then((r) => r.data),
    api.get('/api/masters/layers').then((r) => r.data),
    api.get('/api/masters/activities').then((r) => r.data),
    api.get('/api/masters/elements').then((r) => r.data),
    api.get('/api/masters/structure-types').then((r) => r.data),
  ]).then(([workTypes, layers, activities, elements, structureTypes]) => ({
    workTypes, layers, activities, elements, structureTypes,
  }));
