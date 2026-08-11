# Task: Fix BOQ Mapping screen — 4 issues

Read these files first:
1. src/pages/BOQMapping.jsx
2. src/services/boqService.js
3. routers/boq_router.py — suggest endpoint and activity-mapping endpoints

---

## Fix 1 — Backend: exclude already-mapped from suggestions

In routers/boq_router.py, in suggest_activity_mappings:

The endpoint currently returns suggestions including already-mapped
combinations. Fix the prompt sent to OpenAI to explicitly list
already-mapped combinations and instruct it to exclude them.

Also fix the already_mapped count — it should count how many of the
master combinations are already in boq_activity_mapping, not how many
suggestions overlap.

After getting suggestions back from OpenAI, filter out any suggestion
where (work_type + layer_code + structure_type + element_code +
activity_code) already exists in boq_activity_mapping for this project.

---

## Fix 2 — Backend: add confidence_override test parameter

Add optional query param to suggest endpoint:
  force_test_confidence: bool = False

When force_test_confidence=True:
  - Take the real suggestions from OpenAI
  - Override first suggestion confidence to "high"
  - Override second suggestion confidence to "medium" (if exists)
  - Override third suggestion confidence to "low" (if exists)
  - This lets admin test the UI without needing real uncertain data

---

## Fix 3 — Frontend: Add Edit button to confirmed mappings table

In src/pages/BOQMapping.jsx, in the confirmed mappings table:

Add an "Edit" button alongside the existing deactivate button on each row.

Clicking Edit opens the AddMappingModal pre-filled with that mapping's
values. On submit, call a PUT/PATCH endpoint... 

Actually — since we don't have a PUT endpoint yet, implement edit as:
1. Soft-delete the existing mapping (set is_active=false via deactivate)
2. Create a new mapping with the updated values
Do this automatically when user clicks Save in edit mode.
Show a single modal — detect edit vs add mode from whether an
existing mapping object is passed as prop.

Add editMapping state to track which row is being edited.
When editMapping is set, open modal pre-filled with its values.

---

## Fix 4 — Frontend: Improve AddMappingModal with master data dropdowns

Replace free-text inputs with proper dropdowns loaded from API.

Add a new service function to boqService.js:
```js
export const getMasterData = (projectId) =>
  api.get('/api/masters/all', { params: { project_id: projectId } })
    .then((res) => res.data);
```

Actually — check what master data endpoints exist by reading
routers/master_data_router.py first. Use whatever endpoint
returns work_types, layers, activities, elements, structure_types.

In the modal:

Work Type: dropdown from master_work_types
  [ROAD, STRUCTURE, DRAIN, ANCILLARY, MISC]

Layer Code: dropdown from master_layers
  (shown only when work_type = ROAD)
  Show: "WEARING — Wearing Course (BC)"

Structure Type: dropdown from master_structure_types  
  (shown only when work_type = STRUCTURE)

Element Code: dropdown from master_elements
  (shown only when work_type = STRUCTURE)

Activity Code: dropdown from master_activities
  filtered by selected work_type if possible
  Label: "Optional — leave blank to match any activity"

BOQ Item Code: searchable dropdown from boq_items
  (current version for selected project)
  Show: "4.05 — Bituminous Concrete - VG 40 (Cum)"
  Searchable by typing item code or description

Volume Formula: dropdown with explanations:
  "LxWxD — Length × Width × Depth (pavement layers, Cum)"
  "LxW   — Length × Width (surface area, Sqm)"  
  "LENGTH — Chainage length only (linear items, RM)"
  "QUANTITY — Engineer-entered quantity (structures, any unit)"

Unit Conversion: number input with helper text:
  "Multiplier applied after formula. Default 1.0.
   Example: enter 0.001 to convert mm³ to m³"

Load master data on modal open (lazy load, show spinner).
Cache it in component state so subsequent opens are instant.

---

## Completion checklist
- [ ] suggest endpoint filters already-mapped from results
- [ ] already_mapped count fixed
- [ ] force_test_confidence param works
- [ ] Edit button on each mapping row
- [ ] Modal works in both add and edit mode
- [ ] Modal uses master data dropdowns
- [ ] BOQ item searchable dropdown
- [ ] Volume formula dropdown with explanations
- [ ] Unit conversion with helper text
- [ ] No other files modified except boqService.js,
      BOQMapping.jsx, boq_router.py