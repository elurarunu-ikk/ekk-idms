// src/services/mastersService.js
// All master data API calls.
// Imports the existing api instance from apiService.js.

import api, { getApiErrorMessage } from './apiService';

// ── Work Types ────────────────────────────────────────────────────────────────
export const getWorkTypes = (activeOnly = true) =>
  api.get('/api/masters/work-types', { params: { active_only: activeOnly } }).then(r => r.data);

export const createWorkType = (payload) =>
  api.post('/api/masters/work-types', payload).then(r => r.data);

export const updateWorkType = (code, payload) =>
  api.put(`/api/masters/work-types/${code}`, payload).then(r => r.data);

// ── Layers ────────────────────────────────────────────────────────────────────
export const getLayers = (workType = null, activeOnly = true) =>
  api.get('/api/masters/layers', {
    params: { ...(workType && { work_type: workType }), active_only: activeOnly }
  }).then(r => r.data);

export const createLayer = (payload) =>
  api.post('/api/masters/layers', payload).then(r => r.data);

export const updateLayer = (code, payload) =>
  api.put(`/api/masters/layers/${code}`, payload).then(r => r.data);

// ── Activities ────────────────────────────────────────────────────────────────
export const getActivities = (workType = null, layer = null, activeOnly = true) =>
  api.get('/api/masters/activities', {
    params: {
      ...(workType && { work_type: workType }),
      ...(layer && { layer }),
      active_only: activeOnly,
    }
  }).then(r => r.data);

export const createActivity = (payload) =>
  api.post('/api/masters/activities', payload).then(r => r.data);

export const updateActivity = (code, payload) =>
  api.put(`/api/masters/activities/${code}`, payload).then(r => r.data);

// ── Elements ──────────────────────────────────────────────────────────────────
export const getElements = (activeOnly = true) =>
  api.get('/api/masters/elements', { params: { active_only: activeOnly } }).then(r => r.data);

export const createElement = (payload) =>
  api.post('/api/masters/elements', payload).then(r => r.data);

export const updateElement = (code, payload) =>
  api.put(`/api/masters/elements/${code}`, payload).then(r => r.data);

// ── Structure Types ───────────────────────────────────────────────────────────
export const getStructureTypes = (activeOnly = true) =>
  api.get('/api/masters/structure-types', { params: { active_only: activeOnly } }).then(r => r.data);

export const createStructureType = (payload) =>
  api.post('/api/masters/structure-types', payload).then(r => r.data);

export const updateStructureType = (code, payload) =>
  api.put(`/api/masters/structure-types/${code}`, payload).then(r => r.data);

// ── Structure Activities (filtered query) ─────────────────────────────────────
export const getStructureActivities = (structureType, element) =>
  api.get('/api/masters/structure-activities', {
    params: { structure_type: structureType, element }
  }).then(r => r.data);

// ── Materials ─────────────────────────────────────────────────────────────────
export const getMaterials = (activeOnly = true) =>
  api.get('/api/masters/materials', { params: { active_only: activeOnly } }).then(r => r.data);

export const createMaterial = (payload) =>
  api.post('/api/masters/materials', payload).then(r => r.data);

export const updateMaterial = (code, payload) =>
  api.put(`/api/masters/materials/${code}`, payload).then(r => r.data);

// ── Equipment ─────────────────────────────────────────────────────────────────
export const getEquipment = (activeOnly = true) =>
  api.get('/api/masters/equipment', { params: { active_only: activeOnly } }).then(r => r.data);

export const createEquipment = (payload) =>
  api.post('/api/masters/equipment', payload).then(r => r.data);

export const updateEquipment = (code, payload) =>
  api.put(`/api/masters/equipment/${code}`, payload).then(r => r.data);

// ── Manpower Categories ───────────────────────────────────────────────────────
export const getManpowerCategories = (activeOnly = true) =>
  api.get('/api/masters/manpower-categories', { params: { active_only: activeOnly } }).then(r => r.data);

export const createManpowerCategory = (payload) =>
  api.post('/api/masters/manpower-categories', payload).then(r => r.data);

export const updateManpowerCategory = (code, payload) =>
  api.put(`/api/masters/manpower-categories/${code}`, payload).then(r => r.data);

export { getApiErrorMessage };
