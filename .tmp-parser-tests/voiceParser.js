"use strict";
// ekk-mobile/utils/voiceParser.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.ACTIVITY_CONFIG = void 0;
exports.normalizeParsedCapture = normalizeParsedCapture;
exports.parseVoiceTranscript = parseVoiceTranscript;
exports.formatChainage = formatChainage;
exports.detectElementDPR = detectElementDPR;
exports.detectActivityDPR = detectActivityDPR;
exports.parseDimensionsDPR = parseDimensionsDPR;
exports.computeQuantityDPR = computeQuantityDPR;
exports.detectStatusDPR = detectStatusDPR;
exports.buildFinalJSON = buildFinalJSON;
const STT_CORRECTIONS = [
    [/\bgsp\b/gi, 'gsb'],
    [/\bwmp\b/gi, 'wmm'],
    [/\bdbp\b/gi, 'dbm'],
    [/\blionis\b/gi, 'layer'],
    [/\bchinese\b/gi, ''],
    [/\bmillimet(?:er|re)s?\b/gi, 'mm'],
    [/\bcentimet(?:er|re)s?\b/gi, 'cm'],
    [/இரு பக்கம்/g, 'both sides'],
    [/இடது/g, 'left side'],
    [/வலது/g, 'right side'],
    [/மழை/g, 'rain'],
    [/தாமதம்/g, 'delay'],
    [/दोनों तरफ/g, 'both sides'],
    [/बारिश/g, 'rain'],
    [/देरी/g, 'delay'],
];
// Tens-words used in spoken chainage (e.g. "forty six" → 46)
const TENS_WORDS = [
    ['nineteen', '19'], ['eighteen', '18'], ['seventeen', '17'], ['sixteen', '16'],
    ['fifteen', '15'], ['fourteen', '14'], ['thirteen', '13'], ['twelve', '12'],
    ['eleven', '11'], ['ninety', '90'], ['eighty', '80'], ['seventy', '70'],
    ['sixty', '60'], ['fifty', '50'], ['forty', '40'], ['thirty', '30'],
    ['twenty', '20'], ['ten', '10'],
];
const DIGIT_WORDS = {
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
const ELEMENT_SPEECH_ALIASES = {
    putting: 'FOOTING',
    peer: 'PIER',
    pr: 'PIER',
};
exports.ACTIVITY_CONFIG = {
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
const ACTIVITY_KEYWORDS = [
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
const WORK_TYPE_KEYWORDS = {
    Road: ['dbm', 'bc', 'sdbc', 'wmm', 'gsb', 'earthwork', 'earth work', 'prime coat', 'tack coat'],
    Structure: ['pier', 'footing', 'foundation', 'girder', 'deck', 'abutment', 'bearing'],
    Drain: ['drain'],
    Ancillary: ['kerb', 'road marking', 'guard rail'],
};
const LAYER_MAP = {
    EARTHWORK: 'Subgrade',
    GSB: 'GSB',
    WMM: 'Base Course',
    DBM: 'Binder Course',
    BC: 'Wearing Course',
    SDBC: 'Wearing Course',
    PRIME_COAT: 'Prime Coat',
    TACK_COAT: 'Tack Coat',
};
const ELEMENT_MAP = [
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
function normalize(raw) {
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
function toMetres(value, unit) {
    if (!unit || /^(m|meter|metre)$/i.test(unit))
        return value;
    if (/^mm$/i.test(unit))
        return value / 1000;
    if (/^cm$/i.test(unit))
        return value / 100;
    return value;
}
function parseChainageToken(tokenRaw) {
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
    const compact = token.match(/^(\d{4,6})$/);
    if (compact) {
        // Ambiguous 4-digit compact forms like "4600" are used in field speech for 46+000.
        if (compact[1].length === 4 && compact[1].endsWith('00')) {
            return { km: Number(compact[1].slice(0, 2)), m: 0 };
        }
        const n = Number(compact[1]);
        return { km: Math.floor(n / 1000), m: n % 1000 };
    }
    // "N hundred" in construction chainage speech means km=N, m=100 (e.g. "46 hundred" = 46+100)
    const hundred = token.match(/^(\d{1,4})\s*hundred$/);
    if (hundred) {
        return { km: Number(hundred[1]), m: 100 };
    }
    return null;
}
function parseChainage(text) {
    const range = text.match(/(\d+\+\d+|\d{4,6}|\d{1,4}\s+\d{3}|\d+\s*hundred|\d{1,4}\s*km\s*\d{1,3}\s*m)\s*(?:to|\-|→)\s*(\d+\+\d+|\d{4,6}|\d{1,4}\s+\d{3}|\d+\s*hundred|\d{1,4}\s*km\s*\d{1,3}\s*m)/i);
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
function toChainageDecimal(point) {
    if (!point)
        return null;
    return point.km + point.m / 1000;
}
function detectActivity(text) {
    for (const [key, value] of ACTIVITY_KEYWORDS) {
        if (text.includes(key))
            return value;
    }
    return null;
}
function detectWorkType(text, activity) {
    for (const [workType, keywords] of Object.entries(WORK_TYPE_KEYWORDS)) {
        if (keywords.some((key) => text.includes(key)))
            return workType;
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
function detectRoadSide(text) {
    if (/\bmedian\b/i.test(text))
        return 'Median';
    if (/\b(both|both side|both sides)\b/i.test(text))
        return 'Both';
    if (/\b(lhs|left side|left)\b/i.test(text))
        return 'LHS';
    if (/\b(rhs|right side|right)\b/i.test(text))
        return 'RHS';
    return '';
}
function detectElement(text) {
    // Direct keyword match: assign immediately
    for (const [key, value] of ELEMENT_MAP) {
        if (text.includes(key))
            return value;
    }
    // Common speech mistakes for element words.
    const tokens = text.split(/\s+/).filter(Boolean);
    for (const token of tokens) {
        if (ELEMENT_SPEECH_ALIASES[token])
            return ELEMENT_SPEECH_ALIASES[token];
    }
    return '';
}
function suggestElement(text, activity, dims) {
    // If RCC/PCC with all dimensions present, suggest FOOTING but don't auto-assign
    if ((activity === 'RCC' || activity === 'PCC') && dims.length_m != null && dims.width_m != null && dims.depth_m != null) {
        return 'FOOTING';
    }
    return null;
}
function detectLayer(activity) {
    if (!activity)
        return '';
    return LAYER_MAP[activity] || '';
}
function extractDimensions(text) {
    let length_m = null;
    let width_m = null;
    let depth_m = null;
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
    if (width)
        width_m = toMetres(Number(width[1]), width[2]);
    // "0.15 mm thickness" or "thickness 0.15 mm" (reversed order also supported)
    // Try reversed form first (keyword before value) — more explicit and avoids false matches like \"8m thickness\"
    const depthRev = text.match(/(?:thickness|depth|thick)\s+(\d+(?:\.\d+)?)\s*(mm|cm|m|meter|metre)?/i);
    if (depthRev) {
        depth_m = toMetres(Number(depthRev[1]), depthRev[2]);
    }
    else {
        const depth = text.match(/(\d+(?:\.\d+)?)\s*(mm|cm|m|meter|metre)?\s*(?:thickness|depth|thick)/i);
        if (depth)
            depth_m = toMetres(Number(depth[1]), depth[2]);
    }
    const length = text.match(/(?:length|len)\s*(?:is|=)?\s*(\d+(?:\.\d+)?)\s*(mm|cm|m|meter|metre)?/i);
    if (length)
        length_m = toMetres(Number(length[1]), length[2]);
    // Fallback for compact road phrases like "45+100 to 45+200 8m 150mm".
    if (width_m == null || depth_m == null) {
        const unitPairs = Array.from(text.matchAll(/(\d+(?:\.\d+)?)\s*(mm|cm|m|meter|metre)\b/gi));
        if (unitPairs.length >= 2) {
            if (width_m == null) {
                const widthPair = unitPairs.find((pair) => /^(m|meter|metre)$/i.test(pair[2]));
                if (widthPair)
                    width_m = toMetres(Number(widthPair[1]), widthPair[2]);
            }
            if (depth_m == null) {
                const depthPair = unitPairs.find((pair) => /^(mm|cm)$/i.test(pair[2]));
                if (depthPair)
                    depth_m = toMetres(Number(depthPair[1]), depthPair[2]);
            }
        }
        else if (unitPairs.length === 1 && depth_m == null) {
            // Single compact unit: treat mm/cm as depth (e.g. "GSB 46+100 to 46+200 150mm")
            const [pair] = unitPairs;
            if (/^(mm|cm)$/i.test(pair[2])) {
                depth_m = toMetres(Number(pair[1]), pair[2]);
            }
        }
    }
    return { length_m, width_m, depth_m };
}
function extractQuantity(text) {
    const m = text.match(/(\d+(?:\.\d+)?)\s*(ton|tons|mt|kg|cum|m3|sqm|rm)\b/i);
    if (!m)
        return { quantity: null, unit: null };
    const rawUnit = m[2].toUpperCase();
    const unit = rawUnit === 'TONS' || rawUnit === 'MT' ? 'TON' : rawUnit;
    return { quantity: Number(m[1]), unit };
}
function computeQuantity(args) {
    const { workType, activity, lengthM, widthM, depthM, chainageFrom, chainageTo, givenQty, givenUnit, } = args;
    const autoUnit = exports.ACTIVITY_CONFIG[activity || '']?.unit ||
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
        if (givenQty != null)
            return { quantity: givenQty, unit: givenUnit || autoUnit || '' };
        return { quantity: null, unit: '' };
    }
    if (workType === 'Structure') {
        if ((activity === 'RCC' || activity === 'PCC') && lengthM != null && widthM != null && depthM != null) {
            return { quantity: Number((lengthM * widthM * depthM).toFixed(3)), unit: 'CUM' };
        }
        if (givenQty != null)
            return { quantity: givenQty, unit: givenUnit || autoUnit || '' };
        return { quantity: null, unit: '' };
    }
    if (givenQty != null)
        return { quantity: givenQty, unit: givenUnit || autoUnit || '' };
    return { quantity: null, unit: '' };
}
function normalizeParsedCapture(input) {
    const obj = input || {};
    const numOrBlank = (value) => {
        if (value === '' || value == null)
            return '';
        const n = Number(value);
        return Number.isFinite(n) ? n : '';
    };
    const strOrBlank = (value) => (value == null ? '' : String(value));
    const normalized = {
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
    };
    return normalized;
}
function parseVoiceTranscript(raw) {
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
    const materials = exports.ACTIVITY_CONFIG[activity || '']?.materials || [];
    // Relaxed validation: compute missing_fields and is_partial_entry
    const missingFields = [];
    if (quantityComputed.quantity == null)
        missingFields.push('quantity');
    if (workType === 'Road' && chainage.from == null)
        missingFields.push('chainage');
    if (workType === 'Road' && !layer)
        missingFields.push('layer');
    if (workType === 'Structure' && !element)
        missingFields.push('element');
    const isPartialEntry = missingFields.length > 0;
    const result = {
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
    };
    const normalized = normalizeParsedCapture(result);
    console.log('[voiceParser] raw:', raw);
    console.log('[voiceParser] result:', normalized);
    return normalized;
}
function formatChainage(decimal) {
    const km = Math.floor(decimal);
    const mt = Math.round((decimal - km) * 1000);
    return `${km}+${String(mt).padStart(3, '0')}`;
}
// ═══════════════════════════════════════════════════════════════════════════
// DPR PARSER MODULE: Simplified, modular, robust voice input parser
// ═══════════════════════════════════════════════════════════════════════════
// Levenshtein distance for fuzzy matching
function levenshteinDistance(a, b) {
    const aLower = a.toLowerCase();
    const bLower = b.toLowerCase();
    const m = aLower.length;
    const n = bLower.length;
    const dp = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
    for (let i = 0; i <= m; i++)
        dp[i][0] = i;
    for (let j = 0; j <= n; j++)
        dp[0][j] = j;
    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            if (aLower[i - 1] === bLower[j - 1]) {
                dp[i][j] = dp[i - 1][j - 1];
            }
            else {
                dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
            }
        }
    }
    return dp[m][n];
}
// Fuzzy match: exact > substring > levenshtein
function fuzzyMatch(text, candidates, threshold = 2) {
    const words = text.toLowerCase().split(/\s+/);
    for (const word of words) {
        for (const candidate of candidates) {
            if (word === candidate.toLowerCase())
                return candidate; // Exact
        }
    }
    for (const word of words) {
        for (const candidate of candidates) {
            if (candidate.toLowerCase().includes(word))
                return candidate; // Substring
        }
    }
    for (const word of words) {
        for (const candidate of candidates) {
            const dist = levenshteinDistance(word, candidate);
            if (dist <= threshold)
                return candidate; // Fuzzy
        }
    }
    return null;
}
function detectElementDPR(text) {
    const elementKeywords = ['footing', 'pier', 'abutment', 'deck', 'girder', 'slab', 'bearing', 'foundation'];
    // Exact match first
    for (const keyword of elementKeywords) {
        if (text.includes(keyword))
            return keyword.toUpperCase();
    }
    // Fuzzy match for speech errors
    const fuzzy = fuzzyMatch(text, elementKeywords);
    if (fuzzy) {
        // Special cases for common speech errors
        if (fuzzy.toLowerCase() === 'pier')
            return 'PIER'; // "peer" → PIER
        if (fuzzy.toLowerCase() === 'footing')
            return 'FOOTING'; // "putting" → FOOTING
        return fuzzy.toUpperCase();
    }
    return '';
}
function detectActivityDPR(text) {
    const activityKeywords = ['rcc', 'pcc', 'excavation', 'reinf', 'shutter', 'dbm', 'wmm', 'gsb'];
    const fuzzy = fuzzyMatch(text, activityKeywords);
    return fuzzy ? fuzzy.toUpperCase() : '';
}
function parseDimensionsDPR(text) {
    let length_m = null;
    let width_m = null;
    let depth_m = null;
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
function computeQuantityDPR(dims) {
    if (dims.length_m != null && dims.width_m != null && dims.depth_m != null) {
        const quantity = Number((dims.length_m * dims.width_m * dims.depth_m).toFixed(3));
        return { quantity, unit: 'CUM' };
    }
    return { quantity: null, unit: '' };
}
function detectStatusDPR(text) {
    if (/\b(started|in progress|inprogress)\b/i.test(text))
        return 'IN_PROGRESS';
    if (/\b(completed|done|finished)\b/i.test(text))
        return 'COMPLETED';
    return '';
}
function buildFinalJSON(raw) {
    const t = normalize(raw);
    const activity = detectActivityDPR(t);
    const element = detectElementDPR(t);
    const dims = parseDimensionsDPR(t);
    const { quantity, unit } = computeQuantityDPR(dims);
    const status = detectStatusDPR(t);
    const materials = activity ? exports.ACTIVITY_CONFIG[activity]?.materials || [] : [];
    const missingFields = [];
    if (!element)
        missingFields.push('element');
    if (quantity == null)
        missingFields.push('quantity');
    const result = {
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
