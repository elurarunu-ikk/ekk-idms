// ekk-mobile/utils/voiceParser.ts

const STT_CORRECTIONS: [RegExp, string][] = [
  // Activity mishears
  [/\bgsp\b/gi,    'gsb'],
  [/\bwmp\b/gi,    'wmm'],
  [/\bdbp\b/gi,    'dbm'],
  [/\bwbp\b/gi,    'wbm'],
  // Common STT noise words
  [/\blionis\b/gi, 'layer'],
  [/\bchinese\b/gi, ''],
  // Tamil words → English equivalents for matching
  [/இன்று/g,       'today'],       // today
  [/நேற்று/g,      'yesterday'],   // yesterday
  [/முடிந்தது/g,   'completed'],   // completed
  [/தொடங்கியது/g,  'started'],     // started
  [/இரு பக்கம்/g,  'both sides'],  // both sides
  [/இடது/g,        'left side'],   // left side
  [/வலது/g,        'right side'],  // right side
  [/மழை/g,         'rain'],        // rain
  [/வெயில்/g,      'sunny'],       // sunny
  [/தாமதம்/g,      'delay'],       // delay
  [/நிறுத்தம்/g,   'stop'],        // stop
  [/பிரச்சனை/g,    'issue'],       // issue
  [/முன்னேற்றம்/g, 'progress'],    // progress
  // Hindi words → English equivalents
  [/आज/g,          'today'],       // today
  [/कल/g,          'yesterday'],   // yesterday
  [/पूरा/g,        'completed'],   // completed
  [/शुरू/g,        'started'],     // started
  [/दोनों तरफ/g,   'both sides'],  // both sides
  [/बारिश/g,       'rain'],        // rain
  [/देरी/g,        'delay'],       // delay
  [/रुका/g,        'stop'],        // stop
  [/समस्या/g,      'issue'],       // issue
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

function normalize(raw: string): string {
  let t = raw.toLowerCase();

  for (const [pattern, replacement] of STT_CORRECTIONS) {
    t = t.replace(pattern, replacement);
  }

  // Normalize spoken chainage fragments like "one plus 100" / "oneplus 100".
  t = t.replace(/\b(zero|one|two|three|four|five|six|seven|eight|nine)\s*plus\b/g, (_m, word) => `${DIGIT_WORDS[word]}+`);
  t = t.replace(/\bplus\b/g, '+');

  // Convert spoken digit words before a plus sign into numeric digits.
  t = t.replace(/\b(zero|one|two|three|four|five|six|seven|eight|nine)\b(?=\s*\+)/g, (_m, word) => DIGIT_WORDS[word]);

  t = t.replace(/\s*\+\s*/g, '+');
  t = t.replace(/\s*-\s*/g, '+');

  // Normalize noisy range separators recognized as to/two/2 between chainages.
  t = t.replace(/(\d+\+\d+)\s*(?:\/|\\|\|)?\s*(?:to|two|2)\s*(?:\/|\\|\|)?\s*(?=\d+\+\d+)/g, '$1 to ');

  return t;
}

const ACTIVITY_MAP: Record<string, string> = {
  gsb: 'GSB', wmm: 'WMM', wbm: 'WBM', dbm: 'DBM',
  sdbc: 'SDBC', bc: 'BC', ew: 'EW', kerb: 'KERB', drain: 'DRAIN',
};

const STAGE_MAP: Record<string, string> = {
  subgrade: 'SUBGRADE', gsb: 'GSB', wmm: 'WMM',
  'base course': 'BASE_COURSE', dbm: 'DBM', bc: 'BC', sdbc: 'SDBC',
};

const REMARK_WORDS: string[] = [
  'rain', 'rainy', 'sunny', 'cloudy', 'delay', 'stop', 'issue',
  'problem', 'complete', 'completed', 'done', 'pending', 'hold',
  'மழை', 'வெயில்', 'தாமதம்', 'बारिश', 'देरी',
];

export interface ParsedCapture {
  activity_code:   string | null;
  stage:           string | null;
  chainage_from:   number | null;
  chainage_to:     number | null;
  road_side:       string | null;
  contractor_name: string | null;
  rfi_number:      number | null;
  layer_section:   string | null;
  remarks:         string | null;
}

export function parseVoiceTranscript(raw: string): ParsedCapture {
  const t = normalize(raw);

  const result: ParsedCapture = {
    activity_code:   null,
    stage:           null,
    chainage_from:   null,
    chainage_to:     null,
    road_side:       null,
    contractor_name: null,
    rfi_number:      null,
    layer_section:   null,
    remarks:         null,
  };

  // Activity
  for (const [key, code] of Object.entries(ACTIVITY_MAP)) {
    if (t.includes(key)) { result.activity_code = code; break; }
  }

  // Stage
  for (const [key, code] of Object.entries(STAGE_MAP)) {
    if (t.includes(key)) { result.stage = code; break; }
  }

  // Chainage
  const cm = t.match(/(\d+)\+(\d+)/g);
  if (cm && cm.length >= 1) {
    const parts = cm[0].split('+');
    result.chainage_from = parseFloat(parts[0]) + parseFloat(parts[1]) / 1000;
  }
  if (cm && cm.length >= 2) {
    const parts = cm[1].split('+');
    result.chainage_to = parseFloat(parts[0]) + parseFloat(parts[1]) / 1000;
  }

  // Road side
  if      (t.includes('both side') || t.includes('both sides') || t.includes('both')) result.road_side = 'Both';
  else if (t.includes('left side') || t.includes('lhs') || /\blhs\b/.test(t))         result.road_side = 'LHS';
  else if (t.includes('right side') || t.includes('rhs') || /\brhs\b/.test(t))        result.road_side = 'RHS';
  else if (t.includes('median'))                                                        result.road_side = 'Median';

  // RFI
  const rfi = raw.match(/rfi\s*(\d+)/i);
  if (rfi) result.rfi_number = parseInt(rfi[1], 10);

  // Layer
  const lyr = raw.match(/\bl(\d+)\b|layer\s*(\d+)|section[\s-]*([a-z0-9]+)/i);
  if (lyr) result.layer_section = lyr[0].toUpperCase();

  // Contractor
  if (t.includes('self')) result.contractor_name = 'Self';

  // Remarks
  for (const word of REMARK_WORDS) {
    if (t.includes(word)) { result.remarks = raw.trim(); break; }
  }

  console.log('[voiceParser] raw:', raw);
  console.log('[voiceParser] result:', result);
  return result;
}

export function formatChainage(decimal: number): string {
  const km = Math.floor(decimal);
  const mt = Math.round((decimal - km) * 1000);
  return `${km}+${String(mt).padStart(3, '0')}`;
}