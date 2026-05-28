// ekk-mobile/utils/voiceParser.ts

const STT_CORRECTIONS: [RegExp, string][] = [
  [/\bgsp\b/gi, 'gsb'],
  [/\bwmp\b/gi, 'wmm'],
  [/\bdbp\b/gi, 'dbm'],
  [/\blionis\b/gi, 'layer'],
  [/\bchinese\b/gi, ''],
  [/\bmillimet(?:er|re)s?\b/gi, 'mm'],
  [/\bcentimet(?:er|re)s?\b/gi, 'cm'],
  // Tamil script → English
  [/இரு பக்கம்/g, 'both sides'],
  [/இடது/g, 'left side'],
  [/வலது/g, 'right side'],
  [/மழை/g, 'rain'],
  [/தாமதம்/g, 'delay'],
  [/நிறைவு/g, 'completed'],
  [/தொடங்கியது/g, 'started'],
  [/செங்கல்/g, 'brick'],
  [/மணல்/g, 'sand'],
  [/சிமெண்ட்/g, 'cement'],
  [/இரும்பு/g, 'steel'],
  [/தொழிலாளர்/g, 'worker'],
  [/இயந்திரம்/g, 'machine'],
  // Tamil phonetic (romanised) construction words
  [/\bkolai\b/gi, 'crusher'],
  [/\bkondal\b/gi, 'aggregate'],
  [/\bmanal\b/gi, 'sand'],
  [/\bsimmenttu\b/gi, 'cement'],
  [/\birumbu\b/gi, 'steel'],
  [/\bthozhilalar\b/gi, 'worker'],
  [/\bkudai\b/gi, 'night shift'],
  [/\bpagal\b/gi, 'day shift'],
  // Hindi script → English
  [/दोनों तरफ/g, 'both sides'],
  [/बारिश/g, 'rain'],
  [/देरी/g, 'delay'],
  [/पूर्ण/g, 'completed'],
  [/शुरू/g, 'started'],
  [/रात की पाली/g, 'night shift'],
  [/दिन की पाली/g, 'day shift'],
  [/मजदूर/g, 'mazdoor'],
  [/मिस्त्री/g, 'mason'],
  [/\bsuni\b/gi, 'sunny'],
  [/\bsonny\b/gi, 'sunny'],
  [/\bclody\b/gi, 'cloudy'],
  [/\bclaudy\b/gi, 'cloudy'],
  [/\braini\b/gi, 'rainy'],
  [/\brani\b/gi, 'rainy'],
  [/\bin ?progres\b/gi, 'in progress'],
  [/\bon ?going\b/gi, 'ongoing'],
  [/\bcomplited\b/gi, 'completed'],
  [/\bcomplet\b/gi, 'completed'],
  // Common STT mishearings for field terms
  [/\bmist captain\b/gi, 'mistri'],
  [/\bkeys in\b/gi, ''],
  [/\bcaptain side\b/gi, ''],
];

// Tens-words used in spoken chainage (e.g. "forty six" → 46)
const TENS_WORDS: [string, string][] = [
  ['nineteen', '19'], ['eighteen', '18'], ['seventeen', '17'], ['sixteen', '16'],
  ['fifteen', '15'], ['fourteen', '14'], ['thirteen', '13'], ['twelve', '12'],
  ['eleven', '11'], ['ninety', '90'], ['eighty', '80'], ['seventy', '70'],
  ['sixty', '60'], ['fifty', '50'], ['forty', '40'], ['thirty', '30'],
  ['twenty', '20'], ['ten', '10'],
];

const DIGIT_WORDS: Record<string, string> = {
  zero: '0',
  one: '1',
  two: '2',
  three: '3',
  four: '4',
  five: '5',
  six: '6',
  seven: '7',
  eight: '8',
  nine: '9',
};

const ELEMENT_SPEECH_ALIASES: Record<string, string> = {
  putting: 'FOOTING',
  peer: 'PIER',
  pr: 'PIER',
};

export const ACTIVITY_CONFIG: Record<string, { unit: string; materials: string[] }> = {
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

const ACTIVITY_KEYWORDS: [string, string][] = [
  ['prime coat', 'PRIME_COAT'],
  ['tack coat', 'TACK_COAT'],
  ['rebar', 'REINF'],
  ['reinforcement', 'REINF'],
  ['steel', 'REINF'],
  ['formwork', 'SHUTTER'],
  ['shuttering', 'SHUTTER'],
  ['excavation', 'EXCAVATION'],
  ['earthwork', 'EARTHWORK'],
  ['earth work', 'EARTHWORK'],
  ['installation', 'INSTALLATION'],
  ['erection', 'ERECTION'],
  ['rcc', 'RCC'],
  ['pcc', 'PCC'],
  ['sdbc', 'SDBC'],
  ['dbm', 'DBM'],
  ['wmm', 'WMM'],
  ['gsb', 'GSB'],
  ['bc', 'BC'],
  ['drain', 'DRAIN'],
  ['kerb', 'KERB'],
];

const WORK_TYPE_KEYWORDS: Record<string, string[]> = {
  Road: ['dbm', 'bc', 'sdbc', 'wmm', 'gsb', 'earthwork', 'earth work', 'prime coat', 'tack coat'],
  Structure: ['pier', 'footing', 'foundation', 'girder', 'deck', 'abutment', 'bearing'],
  Drain: ['drain'],
  Ancillary: ['kerb', 'road marking', 'guard rail'],
};

const LAYER_MAP: Record<string, string> = {
  EARTHWORK: 'Subgrade',
  GSB: 'GSB',
  WMM: 'Base Course',
  DBM: 'Binder Course',
  BC: 'Wearing Course',
  SDBC: 'Wearing Course',
  PRIME_COAT: 'Prime Coat',
  TACK_COAT: 'Tack Coat',
};

const ELEMENT_MAP: [string, string][] = [
  ['expansion joint', 'EXPANSION_JOINT'],
  ['pier cap', 'PIER_CAP'],
  ['footing', 'FOOTING'],
  ['foundation', 'FOUNDATION'],
  ['pier', 'PIER'],
  ['abutment', 'ABUTMENT'],
  ['girder', 'GIRDER'],
  ['deck', 'DECK'],
  ['slab', 'DECK'],
  ['bearing', 'BEARING'],
];

const WEATHER_KEYWORDS: [RegExp, string][] = [
  [/\bsunn?y\b/i, 'SUNNY'],
  [/\bsun\b/i, 'SUNNY'],
  [/\bcloudy\b/i, 'CLOUDY'],
  [/\bcloud\b/i, 'CLOUDY'],
  [/\bovercast\b/i, 'CLOUDY'],
  [/\brainy\b/i, 'RAINY'],
  [/\brain\b/i, 'RAINY'],
  [/\bdrizzle\b/i, 'RAINY'],
  [/\bshower\b/i, 'RAINY'],
];

type ChainagePoint = { km: number; m: number };

function normalize(raw: string): string {
  let t = raw.toLowerCase();
  for (const [pattern, replacement] of STT_CORRECTIONS) {
    t = t.replace(pattern, replacement);
  }
  // Keep numeric and dimension separators, drop noisy punctuation.
  t = t.replace(/[^a-z0-9+./\s-]/g, ' ');
  // Convert "point N" to "0.N" — STT often produces "point 15" instead of "0.15"
  t = t.replace(/\bpoint\s+(\d+)\b/g, '0.$1');
  // Single digit words
  for (const [word, digit] of Object.entries(DIGIT_WORDS)) {
    t = t.replace(new RegExp(`\\b${word}\\b`, 'g'), digit);
  }
  // Tens/teens words (longest first to avoid partial matches)
  for (const [word, num] of TENS_WORDS) {
    t = t.replace(new RegExp(`\\b${word}\\b`, 'g'), num);
  }
  // Combine adjacent tens+units: "40 6" → "46" (spoken chainage like "forty six")
  // Only combines when units digit is followed by a non-digit boundary (safe: "40 6m" won't match)
  t = t.replace(/\b([1-9]0)\s+([1-9])\b/g, (_m, tens, unit) => String(Number(tens) + Number(unit)));
  // Expand single-digit hundreds to meter values: "1 hundred" → "100", "2 hundred" → "200"
  // Applied AFTER combine so "46 hundred" (km) passes through untouched (46 is not a single digit)
  t = t.replace(/\b([1-9])\s*hundred\b/g, (_m, d) => String(Number(d) * 100));
  t = t.replace(/\b(zero|one|two|three|four|five|six|seven|eight|nine)\s*plus\b/g, (_m, word) => `${DIGIT_WORDS[word]}+`);
  t = t.replace(/\bplus\b/g, '+');
  t = t.replace(/\s*\+\s*/g, '+');
  t = t.replace(/\s+/g, ' ').trim();
  return t;
}

function toMetres(value: number, unit: string | undefined): number {
  if (!unit || /^(m|meter|metre)$/i.test(unit)) return value;
  if (/^mm$/i.test(unit)) return value / 1000;
  if (/^cm$/i.test(unit)) return value / 100;
  return value;
}

function parseChainageToken(tokenRaw: string): ChainagePoint | null {
  const token = tokenRaw.trim().toLowerCase();
  const normalizedCompact = token.replace(/\s+/g, ' ');

  // Handle explicit forms like "46 km 100 m" or "46km100m".
  const explicitKmM = normalizedCompact.match(/^(\d{1,4})\s*km\s*(\d{1,3})\s*m$/);
  if (explicitKmM) {
    return { km: Number(explicitKmM[1]), m: Number(explicitKmM[2]) };
  }

  // Handle compact spoken forms like "46 600" as 46+600.
  const spacedCompact = normalizedCompact.match(/^(\d{1,4})\s+(\d{3})$/);
  if (spacedCompact) {
    return { km: Number(spacedCompact[1]), m: Number(spacedCompact[2]) };
  }

  const plus = token.match(/^(\d{1,4})\+(\d{1,3})$/);
  if (plus) {
    return { km: Number(plus[1]), m: Number(plus[2]) };
  }

  const compact = token.match(/^(\d{3,6})$/);
  if (compact) {
    const n = Number(compact[1]);
    // 3-digit: treat as pure meters (e.g. "400" → 0+400)
    if (compact[1].length === 3) return { km: 0, m: n };
    // 4-6 digit: standard km+m split (e.g. "4300" → 4+300, "46200" → 46+200)
    return { km: Math.floor(n / 1000), m: n % 1000 };
  }

  // "N hundred" in construction chainage speech means km=N, m=100 (e.g. "46 hundred" = 46+100)
  const hundred = token.match(/^(\d{1,4})\s*hundred$/);
  if (hundred) {
    return { km: Number(hundred[1]), m: 100 };
  }
  return null;
}

function parseChainage(text: string): { from: ChainagePoint | null; to: ChainagePoint | null } {
  const range = text.match(/(\d+\+\d+|\d{3,6}|\d{1,4}\s+\d{3}|\d+\s*hundred|\d{1,4}\s*km\s*\d{1,3}\s*m)\s*(?:to|\-|→)\s*(\d+\+\d+|\d{3,6}|\d{1,4}\s+\d{3}|\d+\s*hundred|\d{1,4}\s*km\s*\d{1,3}\s*m)/i);
  if (range) {
    return {
      from: parseChainageToken(range[1]),
      to: parseChainageToken(range[2]),
    };
  }

  const singleMatches = text.match(/\d+\+\d+|\d{4,6}|\d{1,4}\s+\d{3}|\d+\s*hundred|\d{1,4}\s*km\s*\d{1,3}\s*m/gi) || [];
  return {
    from: singleMatches[0] ? parseChainageToken(singleMatches[0]) : null,
    to: singleMatches[1] ? parseChainageToken(singleMatches[1]) : null,
  };
}

function toChainageDecimal(point: ChainagePoint | null): number | null {
  if (!point) return null;
  return point.km + point.m / 1000;
}

function detectActivity(text: string): string | null {
  for (const [key, value] of ACTIVITY_KEYWORDS) {
    if (text.includes(key)) return value;
  }
  return null;
}

function detectWorkType(text: string, activity: string | null): string {
  for (const [workType, keywords] of Object.entries(WORK_TYPE_KEYWORDS)) {
    if (keywords.some((key) => text.includes(key))) return workType;
  }
  const tokens = text.split(/\s+/).filter(Boolean);
  if (tokens.some((token) => ELEMENT_SPEECH_ALIASES[token])) {
    return 'Structure';
  }
  if (activity && ['RCC', 'PCC', 'REINF', 'SHUTTER', 'ERECTION', 'INSTALLATION', 'EXCAVATION'].includes(activity)) {
    return 'Structure';
  }
  return 'UNKNOWN';
}

function detectRoadSide(text: string): string {
  if (/\bmedian\b/i.test(text)) return 'Median';
  if (/\b(both|both side|both sides)\b/i.test(text)) return 'Both';
  if (/\b(lhs|left side|left)\b/i.test(text)) return 'LHS';
  if (/\b(rhs|right side|right)\b/i.test(text)) return 'RHS';
  return '';
}

function detectWeather(text: string): string {
  for (const [pattern, value] of WEATHER_KEYWORDS) {
    if (pattern.test(text)) return value;
  }
  return '';
}

function detectProgressStatus(text: string): string {
  if (/\b(completed|done|finish|finished)\b/i.test(text)) return 'COMPLETED';
  if (/\b(in\s*progress|ongoing|started|starting)\b/i.test(text)) return 'ONGOING';
  if (/\bstart\b/i.test(text)) return 'STARTED';
  return '';
}

function detectElement(text: string): string {
  // Direct keyword match: assign immediately
  for (const [key, value] of ELEMENT_MAP) {
    if (text.includes(key)) return value;
  }

  // Common speech mistakes for element words.
  const tokens = text.split(/\s+/).filter(Boolean);
  for (const token of tokens) {
    if (ELEMENT_SPEECH_ALIASES[token]) return ELEMENT_SPEECH_ALIASES[token];
  }

  return '';
}

function suggestElement(text: string, activity: string | null, dims: { length_m: number | null; width_m: number | null; depth_m: number | null }): string | null {
  // If RCC/PCC with all dimensions present, suggest FOOTING but don't auto-assign
  if ((activity === 'RCC' || activity === 'PCC') && dims.length_m != null && dims.width_m != null && dims.depth_m != null) {
    return 'FOOTING';
  }
  return null;
}

function detectLayer(activity: string | null): string {
  if (!activity) return '';
  return LAYER_MAP[activity] || '';
}

function extractDimensions(text: string): { length_m: number | null; width_m: number | null; depth_m: number | null } {
  let length_m: number | null = null;
  let width_m: number | null = null;
  let depth_m: number | null = null;

  // Handle noisy chained expressions like "1 by 2 by 3 by 1m" by taking the last 3 values.
  const chainSegment = text.match(/\d+(?:\.\d+)?\s*(?:mm|cm|m|meter|metre)?(?:\s*(?:x|by|\/)\s*\d+(?:\.\d+)?\s*(?:mm|cm|m|meter|metre)?){2,}/i);
  if (chainSegment) {
    const parts = Array.from(chainSegment[0].matchAll(/(\d+(?:\.\d+)?)(?:\s*(mm|cm|m|meter|metre))?/gi));
    if (parts.length >= 3) {
      const [a, b, c] = parts.slice(-3);
      length_m = toMetres(Number(a[1]), a[2]);
      width_m = toMetres(Number(b[1]), b[2]);
      depth_m = toMetres(Number(c[1]), c[2]);
      return { length_m, width_m, depth_m };
    }
  }

  const lbd = text.match(/(\d+(?:\.\d+)?)\s*(mm|cm|m|meter|metre)?\s*(?:x|by|\/)\s*(\d+(?:\.\d+)?)\s*(mm|cm|m|meter|metre)?\s*(?:x|by|\/)\s*(\d+(?:\.\d+)?)\s*(mm|cm|m|meter|metre)?/i);
  if (lbd) {
    length_m = toMetres(Number(lbd[1]), lbd[2]);
    width_m = toMetres(Number(lbd[3]), lbd[4]);
    depth_m = toMetres(Number(lbd[5]), lbd[6]);
    return { length_m, width_m, depth_m };
  }

  const width = text.match(/(\d+(?:\.\d+)?)\s*(mm|cm|m|meter|metre)?\s*(?:width|wide)/i);
  if (width) width_m = toMetres(Number(width[1]), width[2]);

  // "0.15 mm thickness" or "thickness 0.15 mm" (reversed order also supported)
  // Try reversed form first (keyword before value) — more explicit and avoids false matches like \"8m thickness\"
  const depthRev = text.match(/(?:thickness|depth|thick)\s+(\d+(?:\.\d+)?)\s*(mm|cm|m|meter|metre)?/i);
  if (depthRev) {
    depth_m = toMetres(Number(depthRev[1]), depthRev[2]);
  } else {
    const depth = text.match(/(\d+(?:\.\d+)?)\s*(mm|cm|m|meter|metre)?\s*(?:thickness|depth|thick)/i);
    if (depth) depth_m = toMetres(Number(depth[1]), depth[2]);
  }

  const length = text.match(/(?:length|len)\s*(?:is|=)?\s*(\d+(?:\.\d+)?)\s*(mm|cm|m|meter|metre)?/i);
  if (length) length_m = toMetres(Number(length[1]), length[2]);

  // Fallback for compact road phrases like "45+100 to 45+200 8m 150mm".
  if (width_m == null || depth_m == null) {
    const unitPairs = Array.from(text.matchAll(/(\d+(?:\.\d+)?)\s*(mm|cm|m|meter|metre)\b/gi));
    if (unitPairs.length >= 2) {
      if (width_m == null) {
        const widthPair = unitPairs.find((pair) => /^(m|meter|metre)$/i.test(pair[2]));
        if (widthPair) width_m = toMetres(Number(widthPair[1]), widthPair[2]);
      }
      if (depth_m == null) {
        const depthPair = unitPairs.find((pair) => /^(mm|cm)$/i.test(pair[2]));
        if (depthPair) depth_m = toMetres(Number(depthPair[1]), depthPair[2]);
      }
    } else if (unitPairs.length === 1 && depth_m == null) {
      // Single compact unit: treat mm/cm as depth (e.g. "GSB 46+100 to 46+200 150mm")
      const [pair] = unitPairs;
      if (/^(mm|cm)$/i.test(pair[2])) {
        depth_m = toMetres(Number(pair[1]), pair[2]);
      }
    }
  }

  return { length_m, width_m, depth_m };
}

function extractQuantity(text: string): { quantity: number | null; unit: string | null } {
  const m = text.match(/(\d+(?:\.\d+)?)\s*(ton|tons|mt|kg|cum|m3|sqm|rm)\b/i);
  if (!m) return { quantity: null, unit: null };

  const rawUnit = m[2].toUpperCase();
  const unit = rawUnit === 'TONS' || rawUnit === 'MT' ? 'TON' : rawUnit;
  return { quantity: Number(m[1]), unit };
}

function computeQuantity(args: {
  workType: string;
  activity: string | null;
  lengthM: number | null;
  widthM: number | null;
  depthM: number | null;
  chainageFrom: ChainagePoint | null;
  chainageTo: ChainagePoint | null;
  givenQty: number | null;
  givenUnit: string | null;
}): { quantity: number | null; unit: string } {
  const {
    workType,
    activity,
    lengthM,
    widthM,
    depthM,
    chainageFrom,
    chainageTo,
    givenQty,
    givenUnit,
  } = args;

  const autoUnit =
    ACTIVITY_CONFIG[activity || '']?.unit ||
    (activity === 'PRIME_COAT' || activity === 'TACK_COAT' ? 'SQM' : '') ||
    (activity === 'KERB' || activity === 'DRAIN' ? 'RM' : '');

  const fromM = chainageFrom ? chainageFrom.km * 1000 + chainageFrom.m : null;
  const toM = chainageTo ? chainageTo.km * 1000 + chainageTo.m : null;
  const chainageLength = fromM != null && toM != null && toM > fromM ? toM - fromM : null;

  if (workType === 'Road') {
    if (['DBM', 'BC', 'SDBC'].includes(activity || '') && givenQty != null && givenUnit === 'TON') {
      return { quantity: givenQty, unit: 'TON' };
    }
    const finalLength = lengthM ?? chainageLength;
    if (finalLength != null && widthM != null && depthM != null) {
      return { quantity: Number((finalLength * widthM * depthM).toFixed(3)), unit: 'CUM' };
    }
    if (givenQty != null) return { quantity: givenQty, unit: givenUnit || autoUnit || '' };
    return { quantity: null, unit: '' };
  }

  if (workType === 'Structure') {
    if ((activity === 'RCC' || activity === 'PCC') && lengthM != null && widthM != null && depthM != null) {
      return { quantity: Number((lengthM * widthM * depthM).toFixed(3)), unit: 'CUM' };
    }
    if (givenQty != null) return { quantity: givenQty, unit: givenUnit || autoUnit || '' };
    return { quantity: null, unit: '' };
  }

  if (givenQty != null) return { quantity: givenQty, unit: givenUnit || autoUnit || '' };
  return { quantity: null, unit: '' };
}

export interface ParsedCapture {
  work_type: string;
  structure_type: string;
  chainage_from_km: number | '';
  chainage_from_m: number | '';
  chainage_to_km: number | '';
  chainage_to_m: number | '';
  length_m: number | '';
  width_m: number | '';
  depth_m: number | '';
  element: string;
  layer: string;
  activity: string;
  quantity: number | '';
  unit: string;
  road_side: string;
  weather_code: string;
  progress_status: string;
  materials: string[];
  remarks: string;
  activity_code: string | null;
  stage: string | null;
  chainage_from: number | null;
  chainage_to: number | null;
  contractor_name: string | null;
  rfi_number: number | null;
  layer_section: string | null;
  is_partial_entry: boolean;
  missing_fields: string[];
  // 3M structured resource data
  materials_used: Material3M[];
  machines_deployed: Machine3M[];
  manpower_deployed: Manpower3M[];
}

export function normalizeParsedCapture(input: Record<string, unknown> | null | undefined): ParsedCapture {
  const obj = input || {};
  const numOrBlank = (value: unknown): number | '' => {
    if (value === '' || value == null) return '';
    const n = Number(value);
    return Number.isFinite(n) ? n : '';
  };
  const strOrBlank = (value: unknown): string => (value == null ? '' : String(value));

  const normalized: ParsedCapture = {
    work_type: strOrBlank(obj.work_type),
    structure_type: strOrBlank(obj.structure_type),
    chainage_from_km: numOrBlank(obj.chainage_from_km),
    chainage_from_m: numOrBlank(obj.chainage_from_m),
    chainage_to_km: numOrBlank(obj.chainage_to_km),
    chainage_to_m: numOrBlank(obj.chainage_to_m),
    length_m: numOrBlank(obj.length_m),
    width_m: numOrBlank(obj.width_m),
    depth_m: numOrBlank(obj.depth_m),
    element: strOrBlank(obj.element),
    layer: strOrBlank(obj.layer),
    activity: strOrBlank(obj.activity),
    quantity: numOrBlank(obj.quantity),
    unit: strOrBlank(obj.unit),
    road_side: strOrBlank(obj.road_side),
    weather_code: strOrBlank(obj.weather_code),
    progress_status: strOrBlank(obj.progress_status || obj.status),
    materials: Array.isArray(obj.materials) ? obj.materials.map((m) => String(m)) : [],
    remarks: strOrBlank(obj.remarks),
    activity_code: obj.activity_code == null ? null : String(obj.activity_code),
    stage: obj.stage == null ? null : String(obj.stage),
    chainage_from: obj.chainage_from == null || obj.chainage_from === '' ? null : Number(obj.chainage_from),
    chainage_to: obj.chainage_to == null || obj.chainage_to === '' ? null : Number(obj.chainage_to),
    contractor_name: obj.contractor_name == null ? null : String(obj.contractor_name),
    rfi_number: obj.rfi_number == null || obj.rfi_number === '' ? null : Number(obj.rfi_number),
    layer_section: obj.layer_section == null ? null : String(obj.layer_section),
    is_partial_entry: typeof obj.is_partial_entry === 'boolean' ? obj.is_partial_entry : false,
    missing_fields: Array.isArray(obj.missing_fields) ? obj.missing_fields.map((f) => String(f)) : [],
    materials_used: Array.isArray(obj.materials_used) ? (obj.materials_used as Material3M[]) : [],
    machines_deployed: Array.isArray(obj.machines_deployed) ? (obj.machines_deployed as Machine3M[]) : [],
    manpower_deployed: Array.isArray(obj.manpower_deployed) ? (obj.manpower_deployed as Manpower3M[]) : [],
  };

  return normalized;
}

export function parseVoiceTranscript(raw: string): ParsedCapture {
  const t = normalize(raw);
  const activity = detectActivity(t);
  const workType = detectWorkType(t, activity);
  const element = workType === 'Structure' ? detectElement(t) : '';
  const layer = workType === 'Road' ? detectLayer(activity) : '';
  const chainage = parseChainage(t);
  const dims = extractDimensions(t);
  const given = extractQuantity(t);
  const quantityComputed = computeQuantity({
    workType,
    activity,
    lengthM: dims.length_m,
    widthM: dims.width_m,
    depthM: dims.depth_m,
    chainageFrom: chainage.from,
    chainageTo: chainage.to,
    givenQty: given.quantity,
    givenUnit: given.unit,
  });

  const fromM = chainage.from ? chainage.from.km * 1000 + chainage.from.m : null;
  const toM = chainage.to ? chainage.to.km * 1000 + chainage.to.m : null;
  const chainageLength = fromM != null && toM != null && toM > fromM ? toM - fromM : null;
  const lengthM = dims.length_m ?? chainageLength;
  const materials = ACTIVITY_CONFIG[activity || '']?.materials || [];

  // ── 3M extraction ──────────────────────────────────────────────────────
  const materials_used = extract3MMaterials(raw);
  const machines_deployed = extract3MMachines(raw);
  const manpower_deployed = extract3MManpower(raw);

  // Relaxed validation: compute missing_fields and is_partial_entry
  const missingFields: string[] = [];
  if (quantityComputed.quantity == null) missingFields.push('quantity');
  if (workType === 'Road' && chainage.from == null) missingFields.push('chainage');
  if (workType === 'Road' && !layer) missingFields.push('layer');
  if (workType === 'Structure' && !element) missingFields.push('element');
  const isPartialEntry = missingFields.length > 0;

  const result: ParsedCapture = {
    work_type: workType,
    structure_type: '',
    chainage_from_km: chainage.from?.km ?? '',
    chainage_from_m: chainage.from?.m ?? '',
    chainage_to_km: chainage.to?.km ?? '',
    chainage_to_m: chainage.to?.m ?? '',
    length_m: lengthM ?? '',
    width_m: dims.width_m ?? '',
    depth_m: dims.depth_m ?? '',
    element,
    layer,
    activity: activity || '',
    quantity: quantityComputed.quantity ?? '',
    unit: quantityComputed.unit,
    road_side: detectRoadSide(t),
    weather_code: detectWeather(t),
    progress_status: detectProgressStatus(t),
    materials,
    remarks: /rain|delay|issue|problem|pending|hold/i.test(t) ? raw.trim() : '',
    activity_code: activity,
    stage: layer || element || (workType.toUpperCase() === 'MISC' ? 'MISC' : workType.toUpperCase()),
    chainage_from: toChainageDecimal(chainage.from),
    chainage_to: toChainageDecimal(chainage.to),
    contractor_name: t.includes('self') ? 'Self' : null,
    rfi_number: raw.match(/rfi\s*(\d+)/i) ? Number(raw.match(/rfi\s*(\d+)/i)?.[1]) : null,
    layer_section: raw.match(/\bl(\d+)\b|layer\s*(\d+)|section[\s-]*([a-z0-9]+)/i)?.[0]?.toUpperCase() || null,
    is_partial_entry: isPartialEntry,
    missing_fields: missingFields,
    materials_used,
    machines_deployed,
    manpower_deployed,
  };

  const normalized = normalizeParsedCapture(result as unknown as Record<string, unknown>);
  console.log('[voiceParser] raw:', raw);
  console.log('[voiceParser] result:', normalized);
  return normalized;
}

export function formatChainage(decimal: number): string {
  const km = Math.floor(decimal);
  const mt = Math.round((decimal - km) * 1000);
  return `${km}+${String(mt).padStart(3, '0')}`;
}

// ═══════════════════════════════════════════════════════════════════════════
// 3M EXTRACTION — Materials, Machines, Manpower
// ═══════════════════════════════════════════════════════════════════════════

const HINDI_NUMBERS: Record<string, number> = {
  ek: 1, do: 2, teen: 3, tin: 3, char: 4, paanch: 5, panch: 5,
  chhe: 6, chh: 6, saat: 7, sat: 7, aath: 8, aat: 8,
  nau: 9, das: 10, gyarah: 11, barah: 12, tera: 13, chaudah: 14,
  pandrah: 15, solah: 16, satrah: 17, atharah: 18, unnis: 19,
  bees: 20, pacchis: 25, tees: 30, chalees: 40, pachaas: 50,
};

const MATERIAL_KW: [string, string][] = [
  ['wet mix macadam', 'WMM'], ['granular sub base', 'GSB'], ['sub base', 'GSB'],
  ['dense bituminous macadam', 'DBM'], ['bituminous concrete', 'BC'],
  ['ready mixed concrete', 'RMC'], ['ready mix', 'RMC'],
  ['cement treated base', 'CTB'],
  ['fly ash', 'FLY_ASH'], ['flyash', 'FLY_ASH'],
  ['tor steel', 'STEEL'], ['reinforcement', 'STEEL'],
  ['fine aggregate', 'SAND'],
  ['crusher dust', 'CRUSHER_DUST'],
  ['water tanker', 'WATER'], // avoid matching 'water' to machine 'water tanker'
  ['bituminous', 'BITUMEN'], ['bitumen', 'BITUMEN'], ['asphalt', 'BITUMEN'],
  ['emulsion', 'EMULSION'], ['thermoplastic', 'THERMOPLASTIC'],
  ['geotextile', 'GEOTEXTILE'], ['hdpe', 'HDPE_PIPE'],
  ['concrete', 'RMC'], ['cement', 'CEMENT'], ['opc', 'CEMENT'], ['ppc', 'CEMENT'],
  ['aggregate', 'AGGREGATE'], ['agg', 'AGGREGATE'], ['grit', 'AGGREGATE'],
  ['sand', 'SAND'], ['steel', 'STEEL'],
  ['stone', 'STONE'], ['boulder', 'STONE'],
  ['lime', 'LIME'], ['paint', 'PAINT'],
  ['wmm', 'WMM'], ['gsb', 'GSB'], ['dbm', 'DBM'],
  ['sdbc', 'SDBC'], ['rmc', 'RMC'], ['ctb', 'CTB'],
  ['water', 'WATER'], ['pipe', 'PIPE'],
];

const MACHINE_KW: [string, string][] = [
  ['vibratory roller', 'VIB_ROLLER'], ['pneumatic roller', 'PNEU_ROLLER'],
  ['smooth roller', 'SMT_ROLLER'], ['motor grader', 'GRADER'],
  ['front end loader', 'LOADER'], ['concrete mixer', 'CONCRETE_MIXER'],
  ['drum mixer', 'CONCRETE_MIXER'], ['transit mixer', 'TRANSIT_MIXER'],
  ['concrete pump', 'CONCRETE_PUMP'], ['plate compactor', 'PLATE_COMPACTOR'],
  ['cutting machine', 'CUTTER'], ['total station', 'TOTAL_STATION'],
  ['weigh bridge', 'WEIGH_BRIDGE'], ['level machine', 'LEVEL_MACHINE'],
  ['water tanker', 'WATER_TANKER'], ['hydra crane', 'HYDRA_CRANE'],
  ['paving machine', 'PAVER'], ['backhoe', 'BACKHOE'],
  ['excavator', 'EXCAVATOR'], ['compactor', 'COMPACTOR'],
  ['grader', 'GRADER'], ['tipper', 'TIPPER'], ['dumper', 'DUMPER'],
  ['tanker', 'WATER_TANKER'], ['loader', 'LOADER'], ['crane', 'CRANE'],
  ['generator', 'GENERATOR'], ['genset', 'GENERATOR'],
  ['rammer', 'RAMMER'], ['cutter', 'CUTTER'],
  ['roller', 'ROLLER'], ['paver', 'PAVER'], ['truck', 'TRUCK'],
  ['pump', 'CONCRETE_PUMP'], ['jcb', 'EXCAVATOR'],
];

const MANPOWER_KW: [string, string][] = [
  ['site engineer', 'ENGINEER'], ['machine operator', 'OPERATOR'],
  ['skilled worker', 'SKILLED'], ['skilled labour', 'SKILLED'],
  ['semi skilled worker', 'SEMISKILLED'], ['semi-skilled', 'SEMISKILLED'],
  ['semiskilled', 'SEMISKILLED'], ['unskilled worker', 'UNSKILLED'],
  ['labourer', 'UNSKILLED'], ['laborer', 'UNSKILLED'],
  ['mazdoor', 'UNSKILLED'], ['majdoor', 'UNSKILLED'],
  ['mistri', 'MASON'], ['mistry', 'MASON'], ['shuttering', 'CARPENTER'],
  ['mason', 'MASON'], ['carpenter', 'CARPENTER'], ['electrician', 'ELECTRICIAN'],
  ['welder', 'WELDER'], ['helper', 'HELPER'], ['operator', 'OPERATOR'],
  ['supervisor', 'SUPERVISOR'], ['foreman', 'SUPERVISOR'],
  ['engineer', 'ENGINEER'], ['skilled', 'SKILLED'],
  ['unskilled', 'UNSKILLED'], ['labour', 'UNSKILLED'], ['worker', 'UNSKILLED'],
];

const UNIT_KW: [string, string][] = [
  ['cubic meter', 'CUM'], ['cubic metre', 'CUM'], ['cu m', 'CUM'],
  ['metric ton', 'MT'], ['metric tonne', 'MT'],
  ['running meter', 'LM'], ['linear meter', 'LM'], ['linear metre', 'LM'],
  ['square meter', 'SQM'], ['square metre', 'SQM'],
  ['kilogram', 'KG'], ['litre', 'LTR'], ['liter', 'LTR'],
  ['tonne', 'MT'], ['bags', 'BAG'], ['bag', 'BAG'],
  ['nos', 'NOS'], ['each', 'NOS'], ['number', 'NOS'],
  ['ton', 'MT'], ['cum', 'CUM'], ['cmt', 'CUM'],
  ['sqm', 'SQM'], ['lm', 'LM'], ['rm', 'LM'],
  ['kg', 'KG'], ['mt', 'MT'], ['ltr', 'LTR'],
];

export interface Material3M { code: string; quantity: number | null; unit: string; source: string | null }
export interface Machine3M { code: string; hours: number | null; operator: string | null; count: number }
export interface Manpower3M { category: string; count: number | null; shift_type: 'DAY' | 'NIGHT' | 'GENERAL' }

function resolveHindi(word: string): number | null {
  return Object.prototype.hasOwnProperty.call(HINDI_NUMBERS, word) ? HINDI_NUMBERS[word] : null;
}

function extractQtyUnit(window: string): { qty: number | null; unit: string } {
  const t = window.toLowerCase();
  // Replace Hindi ghante → hours
  const cleaned = t.replace(/\bghante?\b/g, 'hours').replace(/\bghanta\b/g, 'hour');

  for (const [phrase, code] of UNIT_KW) {
    const pat = new RegExp(`(\\d+(?:\\.\\d+)?)\\s*${phrase.replace(/\s+/g, '\\s+')}\\b`);
    const m = pat.exec(cleaned);
    if (m) return { qty: Number(m[1]), unit: code };
    // Hindi number before unit
    for (const [hw, hv] of Object.entries(HINDI_NUMBERS)) {
      if (new RegExp(`\\b${hw}\\s+${phrase.replace(/\s+/g, '\\s+')}\\b`).test(cleaned)) {
        return { qty: hv, unit: code };
      }
    }
  }
  // bare number
  const bare = /(\d+(?:\.\d+)?)/.exec(cleaned);
  return { qty: bare ? Number(bare[1]) : null, unit: '' };
}

function extract3MMaterials(raw: string): Material3M[] {
  const t = raw.toLowerCase().replace(/[^a-z0-9\s.]/g, ' ');
  const results: Material3M[] = [];
  const seen = new Set<string>();

  for (const [kw, code] of MATERIAL_KW) {
    if (!t.includes(kw)) continue;
    if (seen.has(code)) continue;
    const idx = t.indexOf(kw);
    const window = t.slice(Math.max(0, idx - 50), idx + kw.length + 60);
    const { qty, unit } = extractQtyUnit(window);

    // source: "from <word>" — but only if word is not a unit keyword
    let source: string | null = null;
    const srcM = /\bfrom\s+(\w+)/.exec(window.slice(window.indexOf(kw)));
    if (srcM) {
      const w = srcM[1];
      const isUnit = UNIT_KW.some(([p]) => p === w || p.startsWith(w));
      if (!isUnit) source = w.charAt(0).toUpperCase() + w.slice(1);
    }

    results.push({ code, quantity: qty, unit: unit || 'NOS', source });
    seen.add(code);
  }
  return results;
}

function extract3MMachines(raw: string): Machine3M[] {
  // Normalise Hindi hours
  let t = raw.toLowerCase().replace(/\bghante?\b/g, 'hours').replace(/\bghanta\b/g, 'hour');
  t = t.replace(/[^a-z0-9\s.]/g, ' ');
  const results: Machine3M[] = [];
  const seen = new Set<string>();

  for (const [kw, code] of MACHINE_KW) {
    if (!t.includes(kw)) continue;
    if (seen.has(code)) continue;
    const idx = t.indexOf(kw);
    const window = t.slice(Math.max(0, idx - 30), idx + kw.length + 80);

    // Hours
    let hours: number | null = null;
    const hm = /(\d+(?:\.\d+)?)\s*hours?\b/.exec(window);
    if (hm) { hours = Number(hm[1]); }
    else {
      for (const [hw, hv] of Object.entries(HINDI_NUMBERS)) {
        if (new RegExp(`\\b${hw}\\s+hours?\\b`).test(window)) { hours = hv; break; }
      }
    }

    // Operator name
    let operator: string | null = null;
    const om = /\boperator\s+([a-z][a-z]+(?:\s+[a-z][a-z]+)?)/.exec(window);
    if (om) operator = om[1].replace(/\b\w/g, c => c.toUpperCase());

    // Count
    let count = 1;
    const cm = new RegExp(`(\\d+)\\s+${kw.replace(/\s+/g, '\\s+')}s?\\b`).exec(t.slice(Math.max(0, idx - 15), idx + kw.length + 5));
    if (cm?.[1]) count = Number(cm[1]);

    results.push({ code, hours, operator, count });
    seen.add(code);
  }
  return results;
}

function extract3MManpower(raw: string): Manpower3M[] {
  const t = raw.toLowerCase().replace(/[^a-z0-9\s]/g, ' ');
  const results: Manpower3M[] = [];
  const seen = new Set<string>();

  for (const [kw, code] of MANPOWER_KW) {
    if (!t.includes(kw)) continue;
    if (seen.has(code)) continue;
    const idx = t.indexOf(kw);
    const window = t.slice(Math.max(0, idx - 30), idx + kw.length + 60);

    // Count: number or Hindi word before keyword
    let count: number | null = null;
    const dm = new RegExp(`(\\d+)\\s+${kw.replace(/\s+/g, '\\s+')}`).exec(window);
    if (dm) { count = Number(dm[1]); }
    else {
      for (const [hw, hv] of Object.entries(HINDI_NUMBERS)) {
        if (new RegExp(`\\b${hw}\\s+${kw.replace(/\s+/g, '\\s+')}`).test(window)) { count = hv; break; }
      }
    }
    if (count === null) {
      const dm2 = new RegExp(`${kw.replace(/\s+/g, '\\s+')}\\s+(\\d+)`).exec(window);
      if (dm2) count = Number(dm2[1]);
    }

    // Shift
    let shift_type: 'DAY' | 'NIGHT' | 'GENERAL' = 'DAY';
    if (/\bnight\s*shift\b|\bnight\b/.test(window)) shift_type = 'NIGHT';
    else if (/\bgeneral\s*shift\b|\bgeneral\b/.test(window)) shift_type = 'GENERAL';
    else if (/\bday\s*shift\b|\bmorning\s*shift\b|\bmorning\b|\bday\b/.test(window)) shift_type = 'DAY';

    results.push({ category: code, count, shift_type });
    seen.add(code);
  }
  return results;
}

// ═══════════════════════════════════════════════════════════════════════════
// DPR PARSER MODULE: Simplified, modular, robust voice input parser
// ═══════════════════════════════════════════════════════════════════════════

// Levenshtein distance for fuzzy matching
function levenshteinDistance(a: string, b: string): number {
  const aLower = a.toLowerCase();
  const bLower = b.toLowerCase();
  const m = aLower.length;
  const n = bLower.length;
  const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (aLower[i - 1] === bLower[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }
  return dp[m][n];
}

// Fuzzy match: exact > substring > levenshtein
function fuzzyMatch(text: string, candidates: string[], threshold = 2): string | null {
  const words = text.toLowerCase().split(/\s+/);
  
  for (const word of words) {
    for (const candidate of candidates) {
      if (word === candidate.toLowerCase()) return candidate; // Exact
    }
  }

  for (const word of words) {
    for (const candidate of candidates) {
      if (candidate.toLowerCase().includes(word)) return candidate; // Substring
    }
  }

  for (const word of words) {
    for (const candidate of candidates) {
      const dist = levenshteinDistance(word, candidate);
      if (dist <= threshold) return candidate; // Fuzzy
    }
  }
  return null;
}

export interface DPRParsedEntry {
  work_type: string;
  activity: string;
  element: string;
  length_m: number | null;
  width_m: number | null;
  depth_m: number | null;
  quantity: number | null;
  unit: string;
  status: string;
  materials: string[];
  is_partial_entry: boolean;
  missing_fields: string[];
}

export function detectElementDPR(text: string): string {
  const elementKeywords = ['footing', 'pier', 'abutment', 'deck', 'girder', 'slab', 'bearing', 'foundation'];
  
  // Exact match first
  for (const keyword of elementKeywords) {
    if (text.includes(keyword)) return keyword.toUpperCase();
  }

  // Fuzzy match for speech errors
  const fuzzy = fuzzyMatch(text, elementKeywords);
  if (fuzzy) {
    // Special cases for common speech errors
    if (fuzzy.toLowerCase() === 'pier') return 'PIER'; // "peer" → PIER
    if (fuzzy.toLowerCase() === 'footing') return 'FOOTING'; // "putting" → FOOTING
    return fuzzy.toUpperCase();
  }

  return '';
}

export function detectActivityDPR(text: string): string {
  const activityKeywords = ['rcc', 'pcc', 'excavation', 'reinf', 'shutter', 'dbm', 'wmm', 'gsb'];
  const fuzzy = fuzzyMatch(text, activityKeywords);
  return fuzzy ? fuzzy.toUpperCase() : '';
}

export function parseDimensionsDPR(text: string): { length_m: number | null; width_m: number | null; depth_m: number | null } {
  let length_m: number | null = null;
  let width_m: number | null = null;
  let depth_m: number | null = null;

  // Try "by" separator (2 by 2 by 1.5)
  const byMatch = text.match(/(\d+(?:\.\d+)?)\s*by\s+(\d+(?:\.\d+)?)\s*by\s+(\d+(?:\.\d+)?)/i);
  if (byMatch) {
    length_m = Number(byMatch[1]);
    width_m = Number(byMatch[2]);
    depth_m = Number(byMatch[3]);
    return { length_m, width_m, depth_m };
  }

  // Try "x" separator (2x2x1.5)
  const xMatch = text.match(/(\d+(?:\.\d+)?)\s*x\s*(\d+(?:\.\d+)?)\s*x\s*(\d+(?:\.\d+)?)/i);
  if (xMatch) {
    length_m = Number(xMatch[1]);
    width_m = Number(xMatch[2]);
    depth_m = Number(xMatch[3]);
    return { length_m, width_m, depth_m };
  }

  // Try "/" separator (2/2/1.5)
  const slashMatch = text.match(/(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)/i);
  if (slashMatch) {
    length_m = Number(slashMatch[1]);
    width_m = Number(slashMatch[2]);
    depth_m = Number(slashMatch[3]);
    return { length_m, width_m, depth_m };
  }

  return { length_m, width_m, depth_m };
}

export function computeQuantityDPR(dims: { length_m: number | null; width_m: number | null; depth_m: number | null }): { quantity: number | null; unit: string } {
  if (dims.length_m != null && dims.width_m != null && dims.depth_m != null) {
    const quantity = Number((dims.length_m * dims.width_m * dims.depth_m).toFixed(3));
    return { quantity, unit: 'CUM' };
  }
  return { quantity: null, unit: '' };
}

export function detectStatusDPR(text: string): string {
  if (/\b(started|in progress|inprogress)\b/i.test(text)) return 'IN_PROGRESS';
  if (/\b(completed|done|finished)\b/i.test(text)) return 'COMPLETED';
  return '';
}

export function buildFinalJSON(raw: string): DPRParsedEntry {
  const t = normalize(raw);
  
  const activity = detectActivityDPR(t);
  const element = detectElementDPR(t);
  const dims = parseDimensionsDPR(t);
  const { quantity, unit } = computeQuantityDPR(dims);
  const status = detectStatusDPR(t);
  const materials = activity ? ACTIVITY_CONFIG[activity]?.materials || [] : [];

  const missingFields: string[] = [];
  if (!element) missingFields.push('element');
  if (quantity == null) missingFields.push('quantity');

  const result: DPRParsedEntry = {
    work_type: 'Structure',
    activity,
    element,
    length_m: dims.length_m,
    width_m: dims.width_m,
    depth_m: dims.depth_m,
    quantity,
    unit,
    status,
    materials,
    is_partial_entry: missingFields.length > 0,
    missing_fields: missingFields,
  };

  return result;
}