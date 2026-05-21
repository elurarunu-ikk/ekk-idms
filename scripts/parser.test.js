const assert = require('assert');
const path = require('path');

const parserPath = path.resolve(__dirname, '../.tmp-parser-tests/voiceParser.js');
const { parseVoiceTranscript, normalizeParsedCapture } = require(parserPath);

function near(a, b, eps = 1e-9) {
  return Math.abs(a - b) <= eps;
}

function run() {
  // Example 1: Road with chainage + LBD.
  const ex1 = parseVoiceTranscript('WMM done from 45100 to 46600 RHS 7 meter width 200 mm thickness');
  assert.strictEqual(ex1.work_type, 'Road');
  assert.strictEqual(ex1.chainage_from_km, 45);
  assert.strictEqual(ex1.chainage_from_m, 100);
  assert.strictEqual(ex1.chainage_to_km, 46);
  assert.strictEqual(ex1.chainage_to_m, 600);
  assert.strictEqual(ex1.layer, 'Base Course');
  assert.strictEqual(ex1.activity, 'WMM');
  assert.strictEqual(ex1.unit, 'CUM');
  assert.strictEqual(ex1.road_side, 'RHS');
  assert.ok(near(ex1.length_m, 1500));
  assert.ok(near(ex1.width_m, 7));
  assert.ok(near(ex1.depth_m, 0.2));
  assert.ok(near(ex1.quantity, 2100));
  assert.deepStrictEqual(ex1.materials, ['AGGREGATE', 'WATER']);

  // Example 2: Structure with LBD.
  const ex2 = parseVoiceTranscript('Footing RCC 2 by 2 by 1.5 meter');
  assert.strictEqual(ex2.work_type, 'Structure');
  assert.strictEqual(ex2.element, 'FOOTING');
  assert.strictEqual(ex2.activity, 'RCC');
  assert.strictEqual(ex2.unit, 'CUM');
  assert.ok(near(ex2.length_m, 2));
  assert.ok(near(ex2.width_m, 2));
  assert.ok(near(ex2.depth_m, 1.5));
  assert.ok(near(ex2.quantity, 6));
  assert.deepStrictEqual(ex2.materials, ['CEMENT', 'STEEL', 'AGGREGATE', 'SAND', 'WATER']);

  // Example 3: Structure direct qty.
  const ex3 = parseVoiceTranscript('Pier P2 RCC completed 5 cum');
  assert.strictEqual(ex3.work_type, 'Structure');
  assert.strictEqual(ex3.element, 'PIER');
  assert.strictEqual(ex3.activity, 'RCC');
  assert.strictEqual(ex3.unit, 'CUM');
  assert.ok(near(ex3.quantity, 5));

  // Edge: "45 hundred" chainage format.
  // In construction field speech, "N hundred" means km=N, m=100 (e.g. "45 hundred" = 45+100).
  const edge1 = parseVoiceTranscript('WMM done from 45 hundred to 46600 RHS 7 meter width 200 mm thickness');
  assert.strictEqual(edge1.chainage_from_km, 45);
  assert.strictEqual(edge1.chainage_from_m, 100);
  assert.strictEqual(edge1.chainage_to_km, 46);
  assert.strictEqual(edge1.chainage_to_m, 600);
  assert.ok(near(edge1.length_m, 1500));   // 46600 - 45100 = 1500m
  assert.ok(near(edge1.quantity, 2100));   // 1500 * 7 * 0.2 = 2100

  // Edge: preserve DBM TON quantity if explicitly provided.
  const edge2 = parseVoiceTranscript('DBM from 45100 to 46600 RHS 300 ton 7 meter width 50 mm thickness');
  assert.strictEqual(edge2.activity, 'DBM');
  assert.strictEqual(edge2.unit, 'TON');
  assert.ok(near(edge2.quantity, 300));

  // Edge: parse spaced compact chainage form "46 600" as 46+600.
  const edge3 = parseVoiceTranscript('WMM done from 4500to 46 600 RHS 7M with 200 mm thickness');
  assert.strictEqual(edge3.chainage_from_km, 45);
  assert.strictEqual(edge3.chainage_from_m, 0);
  assert.strictEqual(edge3.chainage_to_km, 46);
  assert.strictEqual(edge3.chainage_to_m, 600);
  assert.ok(near(edge3.length_m, 1600));
  assert.ok(near(edge3.width_m, 7));
  assert.ok(near(edge3.depth_m, 0.2));
  assert.ok(near(edge3.quantity, 2240));
  assert.strictEqual(edge3.unit, 'CUM');

  // Edge: explicit "km/m" chainage format should parse directly.
  const edge3b = parseVoiceTranscript('WMM from 46 km 100 m to 46 km 600 m RHS 7m 15 mm depth');
  assert.strictEqual(edge3b.chainage_from_km, 46);
  assert.strictEqual(edge3b.chainage_from_m, 100);
  assert.strictEqual(edge3b.chainage_to_km, 46);
  assert.strictEqual(edge3b.chainage_to_m, 600);
  assert.ok(near(edge3b.length_m, 500));

  // Edge: "forty six hundred" spoken form → should parse as 46+100 (construction speech)
  const edge4 = parseVoiceTranscript('GSB forty six hundred to forty six 200 8m 150mm');
  assert.strictEqual(edge4.chainage_from_km, 46);
  assert.strictEqual(edge4.chainage_from_m, 100);
  assert.strictEqual(edge4.chainage_to_km, 46);
  assert.strictEqual(edge4.chainage_to_m, 200);

  // Edge: "46 one hundred" → 46+100
  const edge5 = parseVoiceTranscript('GSB 46 one hundred to 46 200 8m 150mm');
  assert.strictEqual(edge5.chainage_from_km, 46);
  assert.strictEqual(edge5.chainage_from_m, 100);

  // Edge: "thickness 0.15 mm" (reversed order) and "point 15 mm thickness"
  const edge6 = parseVoiceTranscript('GSB 46+100 to 46+200 8m thickness 0.15 mm');
  assert.ok(near(edge6.depth_m, 0.00015));
  const edge7 = parseVoiceTranscript('GSB 46+100 to 46+200 8m point 15 mm thickness');
  assert.ok(near(edge7.depth_m, 0.00015));

  // Normalizer should force strict blanks for unknown numerics.
  const normalized = normalizeParsedCapture({
    work_type: null,
    chainage_from_km: null,
    chainage_from_m: undefined,
    materials: null,
    remarks: null,
  });
  assert.strictEqual(normalized.work_type, '');
  assert.strictEqual(normalized.chainage_from_km, '');
  assert.strictEqual(normalized.chainage_from_m, '');
  assert.deepStrictEqual(normalized.materials, []);
  assert.strictEqual(normalized.remarks, '');
  // Normalizer should default is_partial_entry and missing_fields.
  assert.strictEqual(normalized.is_partial_entry, false);
  assert.deepStrictEqual(normalized.missing_fields, []);

  // ── Relaxed Validation Tests ───────────────────────────────────────────────

  // Relaxed 1: "Pier RCC done" → partial=true, missing=["quantity"], unit empty
  const rel1 = parseVoiceTranscript('Pier RCC done');
  assert.strictEqual(rel1.work_type, 'Structure');
  assert.strictEqual(rel1.element, 'PIER');
  assert.strictEqual(rel1.activity, 'RCC');
  assert.strictEqual(rel1.quantity, '');
  assert.strictEqual(rel1.unit, '');
  assert.strictEqual(rel1.is_partial_entry, true);
  assert.ok(rel1.missing_fields.includes('quantity'), 'missing_fields should include quantity');

  // Relaxed 2: "WMM work done RHS" → partial=true, missing includes quantity and chainage
  const rel2 = parseVoiceTranscript('WMM work done RHS');
  assert.strictEqual(rel2.work_type, 'Road');
  assert.strictEqual(rel2.activity, 'WMM');
  assert.strictEqual(rel2.road_side, 'RHS');
  assert.strictEqual(rel2.quantity, '');
  assert.strictEqual(rel2.unit, '');
  assert.strictEqual(rel2.is_partial_entry, true);
  assert.ok(rel2.missing_fields.includes('quantity'), 'missing_fields should include quantity');
  assert.ok(rel2.missing_fields.includes('chainage'), 'missing_fields should include chainage');

  // Relaxed 3: "Footing RCC 2 by 2 by 1.5 meter" → partial=false, quantity computed
  const rel3 = parseVoiceTranscript('Footing RCC 2 by 2 by 1.5 meter');
  assert.strictEqual(rel3.work_type, 'Structure');
  assert.strictEqual(rel3.element, 'FOOTING');
  assert.strictEqual(rel3.activity, 'RCC');
  assert.ok(near(rel3.quantity, 6));
  assert.strictEqual(rel3.unit, 'CUM');
  assert.strictEqual(rel3.is_partial_entry, false);
  assert.deepStrictEqual(rel3.missing_fields, []);

  // Relaxed 4: Unknown work type falls back to UNKNOWN
  const rel4 = parseVoiceTranscript('done');
  assert.strictEqual(rel4.work_type, 'UNKNOWN');

  // ── Element Handling Tests ─────────────────────────────────────────────────

  // Test 1: Structure RCC with dimensions but no element keyword
  // → element empty, marked as partial (missing element)
  const elem1 = parseVoiceTranscript('RCC 2 by 2 by 1.5 meter done');
  assert.strictEqual(elem1.work_type, 'Structure');
  assert.strictEqual(elem1.element, '');
  assert.strictEqual(elem1.is_partial_entry, true);
  assert.ok(elem1.missing_fields.includes('element'), 'missing_fields should include element');

  // Test 2: Structure with direct element keyword
  // → element assigned directly
  const elem2 = parseVoiceTranscript('Footing RCC 2 by 2 by 1.5 meter');
  assert.strictEqual(elem2.work_type, 'Structure');
  assert.strictEqual(elem2.element, 'FOOTING');
  assert.strictEqual(elem2.is_partial_entry, false);
  assert.deepStrictEqual(elem2.missing_fields, []);

  // Test 3: Structure pier keyword
  // → element assigned
  const elem3 = parseVoiceTranscript('Pier RCC done');
  assert.strictEqual(elem3.work_type, 'Structure');
  assert.strictEqual(elem3.element, 'PIER');
  assert.strictEqual(elem3.is_partial_entry, true);
  assert.ok(elem3.missing_fields.includes('quantity'), 'partial because no quantity');

  // Test 4: Structure with slab keyword
  // → element DECK (from slab → DECK mapping)
  const elem4 = parseVoiceTranscript('Slab RCC 4 by 3 by 0.15 meter');
  assert.strictEqual(elem4.work_type, 'Structure');
  assert.strictEqual(elem4.element, 'DECK');
  assert.strictEqual(elem4.quantity, 1.8);

  // Test 5: Road without chainage and with missing quantity
  // → layer is auto-derived from WMM activity = 'Base Course'
  // → missing_fields includes quantity and chainage
  const elem5 = parseVoiceTranscript('WMM done RHS');
  assert.strictEqual(elem5.work_type, 'Road');
  assert.strictEqual(elem5.layer, 'Base Course');
  assert.strictEqual(elem5.quantity, '');
  assert.strictEqual(elem5.unit, '');
  assert.strictEqual(elem5.is_partial_entry, true);
  assert.ok(elem5.missing_fields.includes('quantity'), 'missing_fields should include quantity');
  assert.ok(elem5.missing_fields.includes('chainage'), 'missing_fields should include chainage');

  // Test 6: Noisy repeated speech + number words should still detect element and compute quantity.
  const elem6 = parseVoiceTranscript('We are putting, putting.RCC one by 2 by 3 by 1M');
  assert.strictEqual(elem6.work_type, 'Structure');
  assert.strictEqual(elem6.activity, 'RCC');
  assert.strictEqual(elem6.element, 'FOOTING');
  assert.ok(near(elem6.length_m, 2));
  assert.ok(near(elem6.width_m, 3));
  assert.ok(near(elem6.depth_m, 1));
  assert.ok(near(elem6.quantity, 6));
  assert.strictEqual(elem6.unit, 'CUM');
  assert.strictEqual(elem6.is_partial_entry, false);
  assert.deepStrictEqual(elem6.missing_fields, []);

  // Test 7: compact road metrics should infer width/depth and compute quantity.
  const elem7 = parseVoiceTranscript('GSB 45+100 to 45+200 8m 150mm');
  assert.strictEqual(elem7.work_type, 'Road');
  assert.strictEqual(elem7.activity, 'GSB');
  assert.strictEqual(elem7.layer, 'GSB');
  assert.ok(near(elem7.length_m, 100));
  assert.ok(near(elem7.width_m, 8));
  assert.ok(near(elem7.depth_m, 0.15));
  assert.ok(near(elem7.quantity, 120));
  assert.strictEqual(elem7.unit, 'CUM');

  // Test 8: split earth work phrase should still map to Road / EARTHWORK / Subgrade.
  const elem8 = parseVoiceTranscript('Earth work done');
  assert.strictEqual(elem8.work_type, 'Road');
  assert.strictEqual(elem8.activity, 'EARTHWORK');
  assert.strictEqual(elem8.layer, 'Subgrade');

  // Test 9: peer/pr speech mistakes should still map to Structure/Pier.
  const elem9 = parseVoiceTranscript('Peer work started');
  assert.strictEqual(elem9.work_type, 'Structure');
  assert.strictEqual(elem9.element, 'PIER');

  const elem10 = parseVoiceTranscript('PR RCC completed');
  assert.strictEqual(elem10.work_type, 'Structure');
  assert.strictEqual(elem10.element, 'PIER');
  assert.strictEqual(elem10.activity, 'RCC');

  console.log('Parser tests passed.');
}

run();
