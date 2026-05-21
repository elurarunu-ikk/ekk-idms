export interface DPRDimensions {
  length_m: number | null;
  width_m: number | null;
  depth_m: number | null;
}

export interface DPRQuantity {
  quantity: number | null;
  unit: string;
}

export interface DPRParserOutput {
  work_type: 'Structure';
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

const ELEMENT_CANONICAL: Record<string, string> = {
  footing: 'FOOTING',
  pier: 'PIER',
  abutment: 'ABUTMENT',
  deck: 'DECK',
  slab: 'DECK',
};

const ELEMENT_SPEECH_ALIASES: Record<string, string> = {
  putting: 'FOOTING',
  peer: 'PIER',
};

const ACTIVITY_CANONICAL: Record<string, string> = {
  rcc: 'RCC',
  pcc: 'PCC',
  excavation: 'EXCAVATION',
  reinf: 'REINF',
  reinforcement: 'REINF',
  rebar: 'REINF',
  shutter: 'SHUTTER',
  shuttering: 'SHUTTER',
  formwork: 'SHUTTER',
};

const STATUS_PATTERNS: Array<{ pattern: RegExp; status: string }> = [
  { pattern: /\b(in\s*progress|started|starting|putting|placing|casting)\b/i, status: 'IN_PROGRESS' },
  { pattern: /\b(completed|done|finished)\b/i, status: 'COMPLETED' },
];

const NUMBER_WORDS: Record<string, string> = {
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
  ten: '10',
};

const MATERIAL_BY_ACTIVITY: Record<string, string[]> = {
  RCC: ['CEMENT', 'STEEL', 'AGGREGATE', 'SAND', 'WATER'],
  PCC: ['CEMENT', 'AGGREGATE', 'SAND', 'WATER'],
  EXCAVATION: ['SOIL'],
  REINF: ['STEEL'],
  SHUTTER: ['PLYWOOD', 'STEEL_FORM'],
};

function normalizeText(input: string): string {
  if (!input) return '';
  let normalized = input
    .toLowerCase()
    .replace(/[^a-z0-9./+\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Normalize number words before parsing dimensions.
  for (const [word, digit] of Object.entries(NUMBER_WORDS)) {
    normalized = normalized.replace(new RegExp(`\\b${word}\\b`, 'g'), digit);
  }

  return normalized;
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]) + 1;
      }
    }
  }
  return dp[m][n];
}

function fuzzyPick(tokens: string[], candidates: string[], maxDistance = 1): string | '' {
  for (const token of tokens) {
    for (const candidate of candidates) {
      if (levenshtein(token, candidate) <= maxDistance) {
        return candidate;
      }
    }
  }
  return '';
}

export function detectElement(text: string): string {
  const normalized = normalizeText(text);
  if (!normalized) return '';
  const tokens = normalized.split(' ');

  // Priority 1: exact canonical element words.
  for (const token of tokens) {
    if (ELEMENT_CANONICAL[token]) {
      return ELEMENT_CANONICAL[token];
    }
  }

  // Priority 2: exact known speech aliases (e.g., putting -> FOOTING, peer -> PIER).
  for (const token of tokens) {
    if (ELEMENT_SPEECH_ALIASES[token]) {
      return ELEMENT_SPEECH_ALIASES[token];
    }
  }

  // Priority 3: conservative fuzzy match against canonical keys only.
  const fuzzy = fuzzyPick(tokens, Object.keys(ELEMENT_CANONICAL), 1);
  return fuzzy ? ELEMENT_CANONICAL[fuzzy] : '';
}

export function detectActivity(text: string): string {
  const normalized = normalizeText(text);
  if (!normalized) return '';
  const tokens = normalized.split(' ');

  for (const token of tokens) {
    if (ACTIVITY_CANONICAL[token]) return ACTIVITY_CANONICAL[token];
  }

  const fuzzy = fuzzyPick(tokens, Object.keys(ACTIVITY_CANONICAL), 1);
  return fuzzy ? ACTIVITY_CANONICAL[fuzzy] : '';
}

export function parseDimensions(text: string): DPRDimensions {
  const normalized = normalizeText(text);
  if (!normalized) return { length_m: null, width_m: null, depth_m: null };

  // Supports: "2 by 2 by 1.5", "2x2x1.5", "2/2/1.5"
  const triple = normalized.match(/(\d+(?:\.\d+)?)\s*(?:by|x|\/)\s*(\d+(?:\.\d+)?)\s*(?:by|x|\/)\s*(\d+(?:\.\d+)?)/i);
  if (!triple) {
    return { length_m: null, width_m: null, depth_m: null };
  }

  const length_m = Number(triple[1]);
  const width_m = Number(triple[2]);
  const depth_m = Number(triple[3]);

  if (!Number.isFinite(length_m) || !Number.isFinite(width_m) || !Number.isFinite(depth_m)) {
    return { length_m: null, width_m: null, depth_m: null };
  }

  return { length_m, width_m, depth_m };
}

export function computeQuantity(dimensions: DPRDimensions): DPRQuantity {
  if (
    dimensions.length_m == null ||
    dimensions.width_m == null ||
    dimensions.depth_m == null
  ) {
    return { quantity: null, unit: '' };
  }

  const quantity = Number((dimensions.length_m * dimensions.width_m * dimensions.depth_m).toFixed(3));
  return { quantity, unit: 'CUM' };
}

export function detectStatus(text: string): string {
  const normalized = normalizeText(text);
  if (!normalized) return '';

  for (const entry of STATUS_PATTERNS) {
    if (entry.pattern.test(normalized)) return entry.status;
  }
  return '';
}

export function buildFinalJSON(parsed: Partial<DPRParserOutput>, _text: string): DPRParserOutput {
  const missing_fields: string[] = [];

  const element = typeof parsed.element === 'string' ? parsed.element : '';
  const quantity = typeof parsed.quantity === 'number' ? parsed.quantity : null;

  if (!element) missing_fields.push('element');
  if (quantity == null) missing_fields.push('quantity');

  const clean: DPRParserOutput = {
    work_type: 'Structure',
    activity: typeof parsed.activity === 'string' ? parsed.activity : '',
    element,
    length_m: typeof parsed.length_m === 'number' ? parsed.length_m : null,
    width_m: typeof parsed.width_m === 'number' ? parsed.width_m : null,
    depth_m: typeof parsed.depth_m === 'number' ? parsed.depth_m : null,
    quantity,
    unit: typeof parsed.unit === 'string' ? parsed.unit : '',
    status: typeof parsed.status === 'string' ? parsed.status : '',
    materials: Array.isArray(parsed.materials) ? parsed.materials.map((m) => String(m)) : [],
    is_partial_entry: missing_fields.length > 0,
    missing_fields,
  };

  return clean;
}

export function parseDPRText(text: string): DPRParserOutput {
  const safeText = typeof text === 'string' ? text : '';

  const activity = detectActivity(safeText);
  const element = detectElement(safeText);
  const dimensions = parseDimensions(safeText);
  const quantityInfo = computeQuantity(dimensions);
  const status = detectStatus(safeText);
  const materials = activity ? (MATERIAL_BY_ACTIVITY[activity] || []) : [];

  return buildFinalJSON(
    {
      activity,
      element,
      length_m: dimensions.length_m,
      width_m: dimensions.width_m,
      depth_m: dimensions.depth_m,
      quantity: quantityInfo.quantity,
      unit: quantityInfo.unit,
      status,
      materials,
    },
    safeText,
  );
}
