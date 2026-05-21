const assert = require('assert');
const path = require('path');

const parserPath = path.resolve(__dirname, '../.tmp-parser-tests/dprParser.js');
const {
  detectElement,
  detectActivity,
  parseDimensions,
  computeQuantity,
  detectStatus,
  buildFinalJSON,
  parseDPRText,
} = require(parserPath);

function run() {
  console.log('Starting DPR Parser Tests...\n');

  // Test 1: Full example from spec
  const test1 = parseDPRText('I started putting Footing RCC 2 by 2 by 1.5 meter');
  assert.strictEqual(test1.work_type, 'Structure');
  assert.strictEqual(test1.activity, 'RCC');
  assert.strictEqual(test1.element, 'FOOTING');
  assert.strictEqual(test1.length_m, 2);
  assert.strictEqual(test1.width_m, 2);
  assert.strictEqual(test1.depth_m, 1.5);
  assert.strictEqual(test1.quantity, 6);
  assert.strictEqual(test1.unit, 'CUM');
  assert.strictEqual(test1.status, 'IN_PROGRESS');
  assert.deepStrictEqual(test1.materials, ['CEMENT', 'STEEL', 'AGGREGATE', 'SAND', 'WATER']);
  assert.strictEqual(test1.is_partial_entry, false);
  assert.deepStrictEqual(test1.missing_fields, []);

  // Test 2: Speech mistake mapping for element
  assert.strictEqual(detectElement('peer rcc'), 'PIER');
  assert.strictEqual(detectElement('started putting rcc'), 'FOOTING');

  // Test 3: Activity detection
  assert.strictEqual(detectActivity('RCC work started'), 'RCC');
  assert.strictEqual(detectActivity('pcc done'), 'PCC');
  assert.strictEqual(detectActivity('excavation in progress'), 'EXCAVATION');
  assert.strictEqual(detectActivity('reinf tying'), 'REINF');
  assert.strictEqual(detectActivity('shuttering completed'), 'SHUTTER');

  // Test 4: Dimension parsing formats
  const dims1 = parseDimensions('2 by 2 by 1.5');
  assert.deepStrictEqual(dims1, { length_m: 2, width_m: 2, depth_m: 1.5 });
  const dims2 = parseDimensions('2x2x1.5');
  assert.deepStrictEqual(dims2, { length_m: 2, width_m: 2, depth_m: 1.5 });
  const dims3 = parseDimensions('2/2/1.5');
  assert.deepStrictEqual(dims3, { length_m: 2, width_m: 2, depth_m: 1.5 });

  // Test 5: Quantity computation
  const q = computeQuantity({ length_m: 2, width_m: 2, depth_m: 1.5 });
  assert.strictEqual(q.quantity, 6);
  assert.strictEqual(q.unit, 'CUM');
  const qMissing = computeQuantity({ length_m: 2, width_m: null, depth_m: 1.5 });
  assert.strictEqual(qMissing.quantity, null);
  assert.strictEqual(qMissing.unit, '');

  // Test 6: Status detection
  assert.strictEqual(detectStatus('started footing work'), 'IN_PROGRESS');
  assert.strictEqual(detectStatus('in progress rcc footing'), 'IN_PROGRESS');
  assert.strictEqual(detectStatus('footing completed'), 'COMPLETED');
  assert.strictEqual(detectStatus('work done'), 'COMPLETED');

  // Test 7: Partial entry logic
  const partialElement = parseDPRText('RCC 2 by 2 by 1.5 meter done');
  assert.strictEqual(partialElement.is_partial_entry, true);
  assert.ok(partialElement.missing_fields.includes('element'));

  const partialQty = parseDPRText('Footing done');
  assert.strictEqual(partialQty.is_partial_entry, true);
  assert.ok(partialQty.missing_fields.includes('quantity'));

  // Test 8: Material inference for RCC
  const mat = parseDPRText('Footing RCC 2 by 2 by 1.5 meter');
  assert.deepStrictEqual(mat.materials, ['CEMENT', 'STEEL', 'AGGREGATE', 'SAND', 'WATER']);

  // Test 9: buildFinalJSON creates clean stable object (no unsafe merging)
  const clean = buildFinalJSON(
    {
      activity: 'RCC',
      element: 'FOOTING',
      length_m: 2,
      width_m: 2,
      depth_m: 1.5,
      quantity: 6,
      unit: 'CUM',
      status: 'IN_PROGRESS',
      materials: ['CEMENT'],
    },
    'sample',
  );
  assert.strictEqual(clean.work_type, 'Structure');
  assert.strictEqual(clean.activity, 'RCC');
  assert.strictEqual(clean.element, 'FOOTING');
  assert.deepStrictEqual(clean.missing_fields, []);

  // Test 10: bad input does not crash
  const safe = parseDPRText('xyz abc ???');
  assert.strictEqual(safe.work_type, 'Structure');
  assert.strictEqual(safe.is_partial_entry, true);

  // Test 11: repeated fuzzy word + number word dimensions
  const test11 = parseDPRText('We are putting putting RCC 2 by 3 by one metre');
  assert.strictEqual(test11.work_type, 'Structure');
  assert.strictEqual(test11.activity, 'RCC');
  assert.strictEqual(test11.element, 'FOOTING');
  assert.strictEqual(test11.length_m, 2);
  assert.strictEqual(test11.width_m, 3);
  assert.strictEqual(test11.depth_m, 1);
  assert.strictEqual(test11.quantity, 6);
  assert.strictEqual(test11.unit, 'CUM');
  assert.strictEqual(test11.status, 'IN_PROGRESS');
  assert.strictEqual(test11.is_partial_entry, false);
  assert.deepStrictEqual(test11.missing_fields, []);

  console.log('DPR Parser tests passed.');
}

run();
