// captureUtils.js
// Shared utilities and constants for CaptureList, PendingApprovals, EntryDetail.
// Constants match mobile app (ekk-mobile/constants/data.js) exactly.

export const WORK_TYPES = [
  { code: 'ROAD',      label: 'Road' },
  { code: 'STRUCTURE', label: 'Structure' },
  { code: 'DRAIN',     label: 'Drain' },
  { code: 'ANCILLARY', label: 'Ancillary' },
  { code: 'MISC',      label: 'Misc' },
];

export const LAYERS = [
  { code: 'EMBANKMENT', label: 'Embankment' },
  { code: 'SUBGRADE',   label: 'Subgrade' },
  { code: 'GSB',        label: 'GSB' },
  { code: 'CTSB',       label: 'CTSB' },
  { code: 'CTB',        label: 'CTB' },
  { code: 'WMM',        label: 'WMM' },
  { code: 'BASE',       label: 'Base Course' },
  { code: 'BINDER',     label: 'Binder Course (DBM)' },
  { code: 'WEARING',    label: 'Wearing Course (BC)' },
  { code: 'PRIME',      label: 'Prime Coat' },
  { code: 'TACK',       label: 'Tack Coat' },
  { code: 'SHOULDER',   label: 'Shoulder' },
  { code: 'MEDIAN',     label: 'Median' },
];

export const PROGRESS_STATUS_OPTIONS = [
  { value: 'STARTED',   label: 'Started' },
  { value: 'ONGOING',   label: 'In Progress' },
  { value: 'COMPLETED', label: 'Completed' },
];

export const WEATHER_OPTIONS = [
  { value: 'SUNNY',  label: 'Sunny',  icon: '☀️' },
  { value: 'CLOUDY', label: 'Cloudy', icon: '☁️' },
  { value: 'RAINY',  label: 'Rainy',  icon: '🌧️' },
];

export const ROAD_SIDES = ['LEFT', 'RIGHT', 'BOTH', 'MEDIAN'];

export const STATUS_OPTIONS = ['All', 'Pending', 'Approved', 'Rejected'];

// ── Chainage formatting ──────────────────────────────────────────────────────

export function formatChainage(val) {
  // Returns "45+200" from decimal 45.2
  if (val == null || val === '') return '—';
  const num = parseFloat(val);
  if (isNaN(num)) return String(val);
  const km = Math.floor(num);
  const m = Math.round((num - km) * 1000);
  return `${km}+${String(m).padStart(3, '0')}`;
}

export function formatChainageRange(from, to) {
  return `${formatChainage(from)} → ${formatChainage(to)}`;
}

// ── Age of entry (for pending approvals) ────────────────────────────────────

export function getAgeLabel(createdAt) {
  // Returns { label: '3 days', colorClass: 'text-red-600' }
  if (!createdAt) return { label: '—', colorClass: 'text-gray-400' };
  const diffMs = Date.now() - new Date(createdAt).getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 0) {
    if (diffHours === 0) return { label: 'Just now', colorClass: 'text-gray-400' };
    return { label: `${diffHours}h ago`, colorClass: 'text-gray-500' };
  }
  if (diffDays === 1) return { label: '1 day', colorClass: 'text-amber-600' };
  if (diffDays <= 3) return { label: `${diffDays} days`, colorClass: 'text-amber-600' };
  return { label: `${diffDays} days`, colorClass: 'text-red-600' };
}

// ── Progress status display ─────────────────────────────────────────────────

export function getProgressLabel(status) {
  const map = { STARTED: 'Started', ONGOING: 'In Progress', COMPLETED: 'Completed' };
  return map[status] || status || '—';
}

export function getProgressColor(status) {
  if (status === 'COMPLETED') return 'bg-green-100 text-green-700';
  if (status === 'ONGOING') return 'bg-blue-100 text-blue-700';
  if (status === 'STARTED') return 'bg-gray-100 text-gray-600';
  return 'bg-gray-100 text-gray-500';
}

// ── Weather display ─────────────────────────────────────────────────────────

export function getWeatherDisplay(code) {
  const map = {
    SUNNY: { icon: '☀️', label: 'Sunny' },
    CLOUDY: { icon: '☁️', label: 'Cloudy' },
    RAINY: { icon: '🌧️', label: 'Rainy' },
  };
  return map[code] || { icon: '', label: code || '—' };
}

// ── Work type label ─────────────────────────────────────────────────────────

export function getWorkTypeLabel(code) {
  const found = WORK_TYPES.find(w => w.code === code);
  return found ? found.label : (code || '—');
}

// ── Layer label ─────────────────────────────────────────────────────────────

export function getLayerLabel(code) {
  const found = LAYERS.find(l => l.code === code);
  return found ? found.label : (code || '—');
}

// ── 3M summary ─────────────────────────────────────────────────────────────

export function get3MSummary(entry) {
  // Returns string like "3 materials · 2 machines · 4 workers" or null
  const parts = [];
  const mats = entry?.materials_used?.length;
  const machs = entry?.machines_deployed?.length;
  const mp = entry?.manpower_deployed?.length;
  if (mats) parts.push(`${mats} material${mats > 1 ? 's' : ''}`);
  if (machs) parts.push(`${machs} machine${machs > 1 ? 's' : ''}`);
  if (mp) parts.push(`${mp} worker${mp > 1 ? 's' : ''}`);
  return parts.length ? parts.join(' · ') : null;
}

// ── Entry status ─────────────────────────────────────────────────────────────

export function getEntryStatus(entry) {
  if (entry.approved) return 'Approved';
  if (entry.rejected) return 'Rejected';
  return 'Pending';
}

export function getStatusBadgeClass(entry) {
  if (entry.approved) return 'bg-green-100 text-green-700';
  if (entry.rejected) return 'bg-red-100 text-red-700';
  return 'bg-amber-100 text-amber-700';
}

// ── Elements ─────────────────────────────────────────────────────────────────

export const ELEMENTS = [
  { code: 'FOUNDATION',      label: 'Foundation' },
  { code: 'FOOTING',         label: 'Footing' },
  { code: 'PIER',            label: 'Pier' },
  { code: 'PIER_CAP',        label: 'Pier Cap' },
  { code: 'ABUTMENT',        label: 'Abutment' },
  { code: 'DECK',            label: 'Deck Slab' },
  { code: 'GIRDER',          label: 'Girder' },
  { code: 'SLAB',            label: 'Slab' },
  { code: 'WING_WALL',       label: 'Wing Wall' },
  { code: 'BEARING',         label: 'Bearing' },
  { code: 'EXPANSION_JOINT', label: 'Expansion Joint' },
];

// ── Activity constants (from ekk-mobile/constants/data.js — exact copy) ──────

export const ACTIVITIES = [
  { code: 'EARTHWORK',     label: 'Earthwork',           workTypes: ['ROAD'] },
  { code: 'COMPACTION',    label: 'Compaction',           workTypes: ['ROAD'] },
  { code: 'GSB_LAY',       label: 'GSB Laying',           workTypes: ['ROAD'] },
  { code: 'SPREADING',     label: 'Spreading',            workTypes: ['ROAD'] },
  { code: 'ROLLING',       label: 'Rolling',              workTypes: ['ROAD'] },
  { code: 'WMM_LAY',       label: 'WMM Laying',           workTypes: ['ROAD'] },
  { code: 'DLC',           label: 'DLC',                  workTypes: ['ROAD'] },
  { code: 'DBM',           label: 'DBM',                  workTypes: ['ROAD'] },
  { code: 'BC',            label: 'BC',                   workTypes: ['ROAD'] },
  { code: 'SDBC',          label: 'SDBC',                 workTypes: ['ROAD'] },
  { code: 'PRIME_COAT',    label: 'Prime Coat',           workTypes: ['ROAD'] },
  { code: 'TACK_COAT',     label: 'Tack Coat',            workTypes: ['ROAD'] },
  { code: 'SHOULDER_PREP', label: 'Shoulder Preparation', workTypes: ['ROAD'] },
  { code: 'MEDIAN_WORK',   label: 'Median Work',          workTypes: ['ROAD'] },
  { code: 'RCC',           label: 'RCC',                  workTypes: ['STRUCTURE', 'DRAIN'] },
  { code: 'PCC',           label: 'PCC',                  workTypes: ['STRUCTURE', 'DRAIN'] },
  { code: 'EXCAVATION',    label: 'Excavation',           workTypes: ['STRUCTURE'] },
  { code: 'CASTING',       label: 'Casting',              workTypes: ['STRUCTURE'] },
  { code: 'ERECTION',      label: 'Erection',             workTypes: ['STRUCTURE'] },
  { code: 'LAUNCHING',     label: 'Launching',            workTypes: ['STRUCTURE'] },
  { code: 'INSTALLATION',  label: 'Installation',         workTypes: ['STRUCTURE'] },
  { code: 'REINF',         label: 'Reinforcement',        workTypes: ['STRUCTURE'] },
  { code: 'SHUTTER',       label: 'Shuttering',           workTypes: ['STRUCTURE'] },
  { code: 'KERB',          label: 'Kerb',                 workTypes: ['ANCILLARY'] },
  { code: 'DRAIN',         label: 'Drain Work',           workTypes: ['DRAIN'] },
  { code: 'MISC',          label: 'Misc',                 workTypes: ['MISC'] },
];

export const ROAD_ACTIVITY_LAYER_MAP = {
  EARTHWORK:     ['EMBANKMENT', 'SUBGRADE'],
  COMPACTION:    ['EMBANKMENT', 'SUBGRADE', 'WMM', 'CTSB', 'CTB'],
  GSB_LAY:       ['GSB'],
  SPREADING:     ['GSB', 'CTSB', 'CTB'],
  ROLLING:       ['GSB', 'CTSB', 'CTB'],
  WMM_LAY:       ['WMM', 'BASE'],
  DLC:           ['BASE', 'CTSB', 'CTB'],
  DBM:           ['BINDER'],
  BC:            ['WEARING'],
  SDBC:          ['WEARING'],
  PRIME_COAT:    ['PRIME'],
  TACK_COAT:     ['TACK'],
  SHOULDER_PREP: ['SHOULDER'],
  MEDIAN_WORK:   ['MEDIAN'],
};

export const STRUCTURE_TYPES = [
  { code: 'MINOR_BRIDGE', label: 'Minor Bridge' },
  { code: 'MAJOR_BRIDGE', label: 'Major Bridge' },
  { code: 'CULVERT',      label: 'Culvert' },
  { code: 'FLYOVER',      label: 'Flyover' },
];

export const STRUCTURE_ELEMENT_ACTIVITY_MAP = {
  CULVERT: {
    FOUNDATION: ['EXCAVATION', 'PCC'],
    ABUTMENT:   ['RCC', 'REINF', 'SHUTTER'],
    SLAB:       ['RCC', 'REINF', 'SHUTTER'],
    WING_WALL:  ['RCC', 'REINF', 'SHUTTER'],
  },
  MINOR_BRIDGE: {
    FOUNDATION: ['EXCAVATION', 'PCC', 'RCC'],
    FOOTING:    ['RCC', 'REINF', 'SHUTTER'],
    PIER:       ['RCC', 'REINF', 'SHUTTER'],
    ABUTMENT:   ['RCC', 'REINF', 'SHUTTER'],
    DECK:       ['RCC', 'REINF', 'SHUTTER'],
  },
  MAJOR_BRIDGE: {
    FOUNDATION:      ['EXCAVATION', 'PCC', 'RCC'],
    FOOTING:         ['RCC', 'REINF', 'SHUTTER'],
    PIER:            ['RCC', 'REINF', 'SHUTTER'],
    PIER_CAP:        ['RCC', 'REINF', 'SHUTTER'],
    GIRDER:          ['CASTING', 'ERECTION'],
    DECK:            ['RCC', 'REINF', 'SHUTTER'],
    ABUTMENT:        ['RCC', 'REINF', 'SHUTTER'],
    BEARING:         ['INSTALLATION'],
    EXPANSION_JOINT: ['INSTALLATION'],
  },
  FLYOVER: {
    FOUNDATION:      ['EXCAVATION', 'PCC', 'RCC'],
    FOOTING:         ['RCC', 'REINF', 'SHUTTER'],
    PIER:            ['RCC', 'REINF', 'SHUTTER'],
    PIER_CAP:        ['RCC', 'REINF', 'SHUTTER'],
    GIRDER:          ['CASTING', 'ERECTION', 'LAUNCHING'],
    DECK:            ['RCC', 'REINF', 'SHUTTER'],
    ABUTMENT:        ['RCC', 'REINF', 'SHUTTER'],
    BEARING:         ['INSTALLATION'],
    EXPANSION_JOINT: ['INSTALLATION'],
  },
};

// ── Helper functions (match mobile logic exactly) ─────────────────────────────

export function getActivitiesForWorkType(workType) {
  if (!workType) return [];
  return ACTIVITIES.filter(a => a.workTypes.includes(workType));
}

export function getRoadActivitiesForLayer(layerCode) {
  if (!layerCode) return [];
  return ACTIVITIES.filter(
    a => a.workTypes.includes('ROAD') &&
         (ROAD_ACTIVITY_LAYER_MAP[a.code] || []).includes(layerCode)
  );
}

export function getStructureElementsForType(structureType) {
  if (!structureType) return [];
  const map = STRUCTURE_ELEMENT_ACTIVITY_MAP[structureType] || {};
  return Object.keys(map)
    .map(code => ELEMENTS.find(e => e.code === code))
    .filter(Boolean);
}

export function getStructureActivitiesForSelection(structureType, elementCode) {
  if (!structureType || !elementCode) return [];
  const codes = STRUCTURE_ELEMENT_ACTIVITY_MAP[structureType]?.[elementCode] || [];
  return codes
    .map(code => ACTIVITIES.find(a => a.code === code) || null)
    .filter(Boolean);
}

export function deriveStage({ workType, layerCode, elementCode }) {
  return layerCode || elementCode || workType || '';
}

// ── Legacy activity code mapping ──────────────────────────────────────────────

export const LEGACY_ACTIVITY_MAP = {
  'EW':  'EARTHWORK',
  'GSB': 'GSB_LAY',
  'WMM': 'WMM_LAY',
};

export function normaliseActivityCode(code) {
  return LEGACY_ACTIVITY_MAP[code] || code || '';
}
