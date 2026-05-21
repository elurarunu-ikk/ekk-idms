export const WORK_TYPES = [
  { code: 'ROAD', label: 'Road' },
  { code: 'STRUCTURE', label: 'Structure' },
  { code: 'DRAIN', label: 'Drain' },
  { code: 'ANCILLARY', label: 'Ancillary' },
  { code: 'MISC', label: 'Misc' },
];

export const ACTIVITY_CONFIG = {
  RCC: {
    unit: 'CUM',
    materials: ['CEMENT', 'STEEL', 'AGGREGATE', 'SAND', 'WATER'],
  },
  PCC: {
    unit: 'CUM',
    materials: ['CEMENT', 'AGGREGATE', 'SAND', 'WATER'],
  },
  DBM: {
    unit: 'TON',
    materials: ['BITUMEN', 'AGGREGATE'],
  },
  BC: {
    unit: 'TON',
    materials: ['BITUMEN', 'AGGREGATE'],
  },
  SDBC: {
    unit: 'TON',
    materials: ['BITUMEN', 'AGGREGATE'],
  },
  WMM: {
    unit: 'CUM',
    materials: ['AGGREGATE', 'WATER'],
  },
  GSB: {
    unit: 'CUM',
    materials: ['AGGREGATE'],
  },
  REINF: {
    unit: 'KG',
    materials: ['STEEL'],
  },
  SHUTTER: {
    unit: 'SQM',
    materials: ['PLYWOOD', 'STEEL_FORM'],
  },
  EXCAVATION: {
    unit: 'CUM',
    materials: ['SOIL'],
  },
};

export const LAYERS = [
  { code: 'SUBGRADE', label: 'Subgrade' },
  { code: 'GSB', label: 'GSB' },
  { code: 'WMM', label: 'WMM' },
  { code: 'BASE', label: 'Base Course' },
  { code: 'BINDER', label: 'Binder Course' },
  { code: 'WEARING', label: 'Wearing Course' },
  { code: 'PRIME', label: 'Prime Coat' },
  { code: 'TACK', label: 'Tack Coat' },
  { code: 'SHOULDER', label: 'Shoulder' },
  { code: 'MEDIAN', label: 'Median' },
];

export const ELEMENTS = [
  { code: 'FOUNDATION', label: 'Foundation' },
  { code: 'FOOTING', label: 'Footing' },
  { code: 'PIER', label: 'Pier' },
  { code: 'PIER_CAP', label: 'Pier Cap' },
  { code: 'ABUTMENT', label: 'Abutment' },
  { code: 'DECK', label: 'Deck Slab' },
  { code: 'GIRDER', label: 'Girder' },
  { code: 'SLAB', label: 'Slab' },
  { code: 'WING_WALL', label: 'Wing Wall' },
  { code: 'BEARING', label: 'Bearing' },
  { code: 'EXPANSION_JOINT', label: 'Expansion Joint' },
];

export const STRUCTURE_TYPES = [
  { code: 'MINOR_BRIDGE', label: 'Minor Bridge' },
  { code: 'MAJOR_BRIDGE', label: 'Major Bridge' },
  { code: 'CULVERT', label: 'Culvert' },
  { code: 'FLYOVER', label: 'Flyover' },
];

export const STRUCTURE_ELEMENT_ACTIVITY_MAP = {
  CULVERT: {
    FOUNDATION: ['EXCAVATION', 'PCC'],
    ABUTMENT: ['RCC', 'REINF', 'SHUTTER'],
    SLAB: ['RCC', 'REINF', 'SHUTTER'],
    WING_WALL: ['RCC', 'REINF', 'SHUTTER'],
  },

  MINOR_BRIDGE: {
    FOUNDATION: ['EXCAVATION', 'PCC', 'RCC'],
    FOOTING: ['RCC', 'REINF', 'SHUTTER'],
    PIER: ['RCC', 'REINF', 'SHUTTER'],
    ABUTMENT: ['RCC', 'REINF', 'SHUTTER'],
    DECK: ['RCC', 'REINF', 'SHUTTER'],
  },

  MAJOR_BRIDGE: {
    FOUNDATION: ['EXCAVATION', 'PCC', 'RCC'],
    FOOTING: ['RCC', 'REINF', 'SHUTTER'],
    PIER: ['RCC', 'REINF', 'SHUTTER'],
    PIER_CAP: ['RCC', 'REINF', 'SHUTTER'],
    GIRDER: ['CASTING', 'ERECTION'],
    DECK: ['RCC', 'REINF', 'SHUTTER'],
    ABUTMENT: ['RCC', 'REINF', 'SHUTTER'],
    BEARING: ['INSTALLATION'],
    EXPANSION_JOINT: ['INSTALLATION'],
  },

  FLYOVER: {
    FOUNDATION: ['EXCAVATION', 'PCC', 'RCC'],
    FOOTING: ['RCC', 'REINF', 'SHUTTER'],
    PIER: ['RCC', 'REINF', 'SHUTTER'],
    PIER_CAP: ['RCC', 'REINF', 'SHUTTER'],
    GIRDER: ['CASTING', 'ERECTION', 'LAUNCHING'],
    DECK: ['RCC', 'REINF', 'SHUTTER'],
    ABUTMENT: ['RCC', 'REINF', 'SHUTTER'],
    BEARING: ['INSTALLATION'],
    EXPANSION_JOINT: ['INSTALLATION'],
  },
};

export const ACTIVITIES = [
  { code: 'EARTHWORK', label: 'Earthwork', workTypes: ['ROAD'] },
  { code: 'COMPACTION', label: 'Compaction', workTypes: ['ROAD'] },
  { code: 'GSB_LAY', label: 'GSB Laying', workTypes: ['ROAD'] },
  { code: 'SPREADING', label: 'Spreading', workTypes: ['ROAD'] },
  { code: 'ROLLING', label: 'Rolling', workTypes: ['ROAD'] },
  { code: 'WMM_LAY', label: 'WMM Laying', workTypes: ['ROAD'] },
  { code: 'DLC', label: 'DLC', workTypes: ['ROAD'] },
  { code: 'DBM', label: 'DBM', workTypes: ['ROAD'] },
  { code: 'BC', label: 'BC', workTypes: ['ROAD'] },
  { code: 'SDBC', label: 'SDBC', workTypes: ['ROAD'] },
  { code: 'PRIME_COAT', label: 'Prime Coat', workTypes: ['ROAD'] },
  { code: 'TACK_COAT', label: 'Tack Coat', workTypes: ['ROAD'] },
  { code: 'SHOULDER_PREP', label: 'Shoulder Preparation', workTypes: ['ROAD'] },
  { code: 'MEDIAN_WORK', label: 'Median Work', workTypes: ['ROAD'] },
  { code: 'RCC', label: 'RCC', workTypes: ['STRUCTURE', 'DRAIN'] },
  { code: 'PCC', label: 'PCC', workTypes: ['STRUCTURE', 'DRAIN'] },
  { code: 'EXCAVATION', label: 'Excavation', workTypes: ['STRUCTURE'] },
  { code: 'CASTING', label: 'Casting', workTypes: ['STRUCTURE'] },
  { code: 'ERECTION', label: 'Erection', workTypes: ['STRUCTURE'] },
  { code: 'LAUNCHING', label: 'Launching', workTypes: ['STRUCTURE'] },
  { code: 'INSTALLATION', label: 'Installation', workTypes: ['STRUCTURE'] },
  { code: 'REINF', label: 'Reinforcement', workTypes: ['STRUCTURE'] },
  { code: 'SHUTTER', label: 'Shuttering', workTypes: ['STRUCTURE'] },
  { code: 'KERB', label: 'Kerb', workTypes: ['ANCILLARY'] },
  { code: 'DRAIN', label: 'Drain Work', workTypes: ['DRAIN'] },
  { code: 'MISC', label: 'Misc', workTypes: ['MISC'] },
];

export const ROAD_ACTIVITY_LAYER_MAP = {
  EARTHWORK: ['SUBGRADE'],
  COMPACTION: ['SUBGRADE', 'WMM'],
  GSB_LAY: ['GSB'],
  SPREADING: ['GSB'],
  ROLLING: ['GSB'],
  WMM_LAY: ['WMM', 'BASE'],
  DLC: ['BASE'],
  DBM: ['BINDER'],
  BC: ['WEARING'],
  SDBC: ['WEARING'],
  PRIME_COAT: ['PRIME'],
  TACK_COAT: ['TACK'],
  SHOULDER_PREP: ['SHOULDER'],
  MEDIAN_WORK: ['MEDIAN'],
};

export function getActivitiesForWorkType(workType) {
  if (!workType) return [];
  return ACTIVITIES.filter((activity) => activity.workTypes.includes(workType));
}

export function getRoadActivitiesForLayer(layerCode) {
  if (!layerCode) return [];
  return ACTIVITIES.filter(
    (activity) =>
      activity.workTypes.includes('ROAD') &&
      (ROAD_ACTIVITY_LAYER_MAP[activity.code] || []).includes(layerCode)
  );
}

export function getStructureElementsForType(structureType) {
  if (!structureType) return [];
  const map = STRUCTURE_ELEMENT_ACTIVITY_MAP[structureType] || {};
  return Object.keys(map)
    .map((code) => ELEMENTS.find((element) => element.code === code))
    .filter(Boolean);
}

export function getStructureActivitiesForSelection(structureType, elementCode) {
  if (!structureType || !elementCode) return [];
  const activityCodes = STRUCTURE_ELEMENT_ACTIVITY_MAP[structureType]?.[elementCode] || [];

  // Preserve mapping order and avoid silently dropping mapped codes.
  return activityCodes
    .map((code) => ACTIVITIES.find((activity) => activity.code === code) || null)
    .filter(Boolean);
}

export function deriveStageFromSelection({ workType, layerCode, elementCode }) {
  return layerCode || elementCode || workType || '';
}

export const STAGES = [
  { code: 'SUBGRADE',    label: 'Subgrade' },
  { code: 'GSB',         label: 'GSB' },
  { code: 'WMM',         label: 'WMM' },
  { code: 'WBM',         label: 'WBM' },
  { code: 'BASE_COURSE', label: 'Base Course' },
  { code: 'DBM',         label: 'DBM' },
  { code: 'BC',          label: 'BC' },
  { code: 'SDBC',        label: 'SDBC' },
];

export const ACTIVITY_CODES = [
  { code: 'EW',   label: 'Earthwork' },
  { code: 'GSB',  label: 'Granular Sub Base' },
  { code: 'WMM',  label: 'Wet Mix Macadam' },
  { code: 'DBM',  label: 'Dense Bituminous Macadam' },
  { code: 'BC',   label: 'Bituminous Concrete' },
  { code: 'KERB', label: 'Kerb' },
  { code: 'DRAIN',label: 'Drain' },
  { code: 'MISC', label: 'Miscellaneous' },
];

export const ROAD_SIDES = ['LHS', 'RHS', 'Both', 'Median'];

export const CONTRACTORS = ['Self', 'Subcontractor A', 'Subcontractor B'];