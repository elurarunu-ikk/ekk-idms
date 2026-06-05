/**
 * services/masters.js
 *
 * Master data service for IDMS Mobile.
 * Fetches work types, layers, activities, elements, and structure types
 * from /api/masters/ with AsyncStorage cache and offline fallback.
 *
 * Cache TTL: 1 hour
 * Fallback: bundled constants/data.js (always available offline)
 *
 * Helper functions match the exact signatures of constants/data.js
 * so CaptureScreen and EntriesScreen need minimal changes.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import api from './api';

import {
  WORK_TYPES as FALLBACK_WORK_TYPES,
  LAYERS as FALLBACK_LAYERS,
  ELEMENTS as FALLBACK_ELEMENTS,
  STRUCTURE_TYPES as FALLBACK_STRUCTURE_TYPES,
  ACTIVITIES as FALLBACK_ACTIVITIES,
  ROAD_ACTIVITY_LAYER_MAP as FALLBACK_LAYER_MAP,
  STRUCTURE_ELEMENT_ACTIVITY_MAP as FALLBACK_SEA_MAP,
} from '../constants/data';

// ── Cache keys ──────────────────────────────────────────────────────────────
const CACHE_KEYS = {
  workTypes:          'masters_work_types',
  layers:             'masters_layers',
  elements:           'masters_elements',
  structureTypes:     'masters_structure_types',
  activities:         'masters_activities',
  materials:          'masters_materials',
  equipment:          'masters_equipment',
  manpowerCategories: 'masters_manpower_categories',
  timestamp:          'masters_cache_timestamp',
};

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

// ── Cache helpers ────────────────────────────────────────────────────────────
async function isCacheValid() {
  try {
    const ts = await AsyncStorage.getItem(CACHE_KEYS.timestamp);
    if (!ts) return false;
    return Date.now() - parseInt(ts, 10) < CACHE_TTL_MS;
  } catch {
    return false;
  }
}

async function saveToCache(data) {
  try {
    await AsyncStorage.multiSet([
      [CACHE_KEYS.workTypes,          JSON.stringify(data.workTypes)],
      [CACHE_KEYS.layers,             JSON.stringify(data.layers)],
      [CACHE_KEYS.elements,           JSON.stringify(data.elements)],
      [CACHE_KEYS.structureTypes,     JSON.stringify(data.structureTypes)],
      [CACHE_KEYS.activities,         JSON.stringify(data.activities)],
      [CACHE_KEYS.materials,          JSON.stringify(data.materials)],
      [CACHE_KEYS.equipment,          JSON.stringify(data.equipment)],
      [CACHE_KEYS.manpowerCategories, JSON.stringify(data.manpowerCategories)],
      [CACHE_KEYS.timestamp,          String(Date.now())],
    ]);
  } catch (e) {
    console.warn('[masters] Cache write failed:', e.message);
  }
}

async function loadFromCache() {
  try {
    const keys = [
      CACHE_KEYS.workTypes,
      CACHE_KEYS.layers,
      CACHE_KEYS.elements,
      CACHE_KEYS.structureTypes,
      CACHE_KEYS.activities,
      CACHE_KEYS.materials,
      CACHE_KEYS.equipment,
      CACHE_KEYS.manpowerCategories,
    ];
    const pairs = await AsyncStorage.multiGet(keys);
    const map = Object.fromEntries(pairs.map(([k, v]) => [k, v ? JSON.parse(v) : null]));

    if (Object.values(map).some(v => !v)) return null;

    return {
      workTypes:          map[CACHE_KEYS.workTypes],
      layers:             map[CACHE_KEYS.layers],
      elements:           map[CACHE_KEYS.elements],
      structureTypes:     map[CACHE_KEYS.structureTypes],
      activities:         map[CACHE_KEYS.activities],
      materials:          map[CACHE_KEYS.materials],
      equipment:          map[CACHE_KEYS.equipment],
      manpowerCategories: map[CACHE_KEYS.manpowerCategories],
    };
  } catch {
    return null;
  }
}

// ── Fetch from API ───────────────────────────────────────────────────────────
async function fetchFromAPI() {
  const [workTypes, layers, elements, structureTypes, activities,
         materials, equipment, manpowerCategories] = await Promise.all([
    api.get('/api/masters/work-types').then(r => r.data),
    api.get('/api/masters/layers', { params: { active_only: true } }).then(r => r.data),
    api.get('/api/masters/elements', { params: { active_only: true } }).then(r => r.data),
    api.get('/api/masters/structure-types', { params: { active_only: true } }).then(r => r.data),
    api.get('/api/masters/activities', { params: { active_only: true } }).then(r => r.data),
    api.get('/api/masters/materials', { params: { active_only: true } }).then(r => r.data),
    api.get('/api/masters/equipment', { params: { active_only: true } }).then(r => r.data),
    api.get('/api/masters/manpower-categories', { params: { active_only: true } }).then(r => r.data),
  ]);
  return { workTypes, layers, elements, structureTypes, activities,
           materials, equipment, manpowerCategories };
}

// ── Fallback data ─────────────────────────────────────────────────────────────
// Normalized to match API shape so helper functions work identically
// regardless of whether data came from API or bundled constants.

export const FALLBACK_MATERIALS = [
  { code: 'CEMENT',    label: 'Cement',           default_unit: 'BAG' },
  { code: 'STEEL',     label: 'Steel',            default_unit: 'KG'  },
  { code: 'AGGREGATE', label: 'Aggregate',        default_unit: 'CUM' },
  { code: 'SAND',      label: 'Sand',             default_unit: 'CUM' },
  { code: 'WATER',     label: 'Water',            default_unit: 'LTR' },
  { code: 'BITUMEN',   label: 'Bitumen',          default_unit: 'MT'  },
  { code: 'EMULSION',  label: 'Bitumen Emulsion', default_unit: 'LTR' },
  { code: 'WMM',       label: 'WMM Mix',          default_unit: 'CUM' },
  { code: 'GSB',       label: 'GSB Material',     default_unit: 'CUM' },
  { code: 'OTHER',     label: 'Other',            default_unit: null  },
];

export const FALLBACK_EQUIPMENT = [
  { code: 'ROLLER',        label: 'Roller'        },
  { code: 'PAVER',         label: 'Paver'         },
  { code: 'COMPACTOR',     label: 'Compactor'     },
  { code: 'EXCAVATOR',     label: 'Excavator'     },
  { code: 'TIPPER',        label: 'Tipper'        },
  { code: 'GRADER',        label: 'Motor Grader'  },
  { code: 'TRANSIT_MIXER', label: 'Transit Mixer' },
  { code: 'CONCRETE_PUMP', label: 'Concrete Pump' },
  { code: 'CRANE',         label: 'Crane'         },
  { code: 'LOADER',        label: 'Loader'        },
  { code: 'OTHER',         label: 'Other'         },
];

export const FALLBACK_MANPOWER = [
  { code: 'SKILLED',    label: 'Skilled'    },
  { code: 'SEMISKILLED', label: 'Semi-Skilled' },
  { code: 'UNSKILLED',  label: 'Unskilled'  },
  { code: 'MASON',      label: 'Mason'      },
  { code: 'OPERATOR',   label: 'Operator'   },
  { code: 'SUPERVISOR', label: 'Supervisor' },
  { code: 'ENGINEER',   label: 'Engineer'   },
];

function getFallback() {
  return {
    workTypes: FALLBACK_WORK_TYPES,
    layers: FALLBACK_LAYERS.map(l => ({ ...l, work_type_code: 'ROAD' })),
    elements: FALLBACK_ELEMENTS,
    structureTypes: FALLBACK_STRUCTURE_TYPES,
    // Normalize activities: API returns work_types[] and layers[]; fallback uses workTypes[] only
    activities: FALLBACK_ACTIVITIES.map(a => ({
      code:         a.code,
      label:        a.label,
      default_unit: null,
      work_types:   a.workTypes || [],
      layers:       FALLBACK_LAYER_MAP[a.code] || [],
    })),
    materials:          FALLBACK_MATERIALS,
    equipment:          FALLBACK_EQUIPMENT,
    manpowerCategories: FALLBACK_MANPOWER,
  };
}

// ── Main load function ───────────────────────────────────────────────────────
/**
 * loadMasters() — call once on screen focus.
 * Returns master data from cache if fresh, fetches from API if stale,
 * falls back to bundled constants if offline.
 */
export async function loadMasters() {
  // 1. Try cache if valid
  if (await isCacheValid()) {
    const cached = await loadFromCache();
    if (cached) {
      console.log('[masters] Loaded from cache');
      return cached;
    }
  }

  // 2. Try API
  try {
    const data = await fetchFromAPI();
    await saveToCache(data);
    console.log('[masters] Loaded from API and cached');
    return data;
  } catch (e) {
    console.warn('[masters] API fetch failed, using fallback:', e.message);
  }

  // 3. Try stale cache (even if expired — better than nothing)
  const stale = await loadFromCache();
  if (stale) {
    console.log('[masters] Using stale cache');
    return stale;
  }

  // 4. Bundled constants
  console.log('[masters] Using bundled fallback constants');
  return getFallback();
}

/**
 * invalidateMastersCache() — call after admin makes changes in Masters UI.
 * Next loadMasters() call will re-fetch from API.
 */
export async function invalidateMastersCache() {
  try {
    await AsyncStorage.removeItem(CACHE_KEYS.timestamp);
    console.log('[masters] Cache invalidated');
  } catch (e) {
    console.warn('[masters] Cache invalidation failed:', e.message);
  }
}

// ── Helper functions (match exact signatures of constants/data.js) ──────────
// All take masters as first argument. Return [] if masters is null (loading).

/**
 * getActivitiesForWorkType(masters, workType)
 * API activities have work_types[]; normalized fallback also uses work_types[].
 */
export function getActivitiesForWorkType(masters, workType) {
  if (!workType || !masters?.activities) return [];
  return masters.activities.filter(a => (a.work_types || []).includes(workType));
}

/**
 * getRoadActivitiesForLayer(masters, layerCode)
 * API activities have layers[]; normalized fallback derives from ROAD_ACTIVITY_LAYER_MAP.
 */
export function getRoadActivitiesForLayer(masters, layerCode) {
  if (!layerCode || !masters?.activities) return [];
  return masters.activities.filter(a =>
    (a.work_types || []).includes('ROAD') &&
    (a.layers || []).includes(layerCode)
  );
}

/**
 * getStructureElementsForType(masters, structureType)
 * Uses FALLBACK_SEA_MAP to determine which elements belong to this structure type.
 * The SEA junction is not cached — small, stable, always available offline.
 */
export function getStructureElementsForType(masters, structureType) {
  if (!structureType || !masters?.elements) return [];
  const map = FALLBACK_SEA_MAP[structureType] || {};
  const validCodes = Object.keys(map);
  if (validCodes.length === 0) return masters.elements;
  return masters.elements.filter(e => validCodes.includes(e.code));
}

/**
 * getStructureActivitiesForSelection(masters, structureType, elementCode)
 * Uses FALLBACK_SEA_MAP for structure→element→activity codes, then looks
 * them up in masters.activities. Offline-safe — no per-selection API call.
 */
export function getStructureActivitiesForSelection(masters, structureType, elementCode) {
  if (!structureType || !elementCode || !masters?.activities) return [];
  const activityCodes = FALLBACK_SEA_MAP[structureType]?.[elementCode] || [];
  return activityCodes
    .map(code => masters.activities.find(a => a.code === code))
    .filter(Boolean);
}

/**
 * deriveStageFromSelection({ workType, layerCode, elementCode })
 * Same logic as constants/data.js — re-exported for convenience.
 */
export function deriveStageFromSelection({ workType, layerCode, elementCode }) {
  return layerCode || elementCode || workType || '';
}
