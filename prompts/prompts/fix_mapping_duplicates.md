# Task: Fix BOQ mapping duplicate issue in boq_router.py

Read routers/boq_router.py — find suggest_activity_mappings
and bulk_confirm_mappings endpoints.

## Problem

GPT-4o sometimes returns layer labels instead of codes:
"BINDER COURSE (DBM)" instead of "BINDER"
"WEARING COURSE (BC)" instead of "WEARING"

This causes duplicates because the unique constraint uses
the code not the label.

## Fix 1 — Normalise suggestion values against master data

After parsing OpenAI JSON response, before filtering:

Load master layer codes from DB:
  layer_codes = {r.code for r in db.query(MasterLayer).all()}
  structure_type_codes = {r.code for r in db.query(MasterStructureType).all()}
  element_codes = {r.code for r in db.query(MasterElement).all()}
  activity_codes = {r.code for r in db.query(MasterActivity).all()}

For each suggestion:
  - If suggestion.layer_code not in layer_codes → set to None
    (GPT returned a label, not a code — discard it)
  - If suggestion.structure_type not in structure_type_codes → set to None
  - If suggestion.element_code not in element_codes → set to None  
  - If suggestion.activity_code not in activity_codes → set to None

Also import these models at top of function:
  from models.master_data import (MasterLayer, MasterStructureType,
    MasterElement, MasterActivity)

Check what these models are actually called by reading
models/master_data.py first — use the correct class names.

## Fix 2 — Fix existing_keys set construction

The existing_keys set must use the same 5-tuple as the
suggestion filter. Build it as:

```python
existing_keys = set()
existing_mappings = db.query(BoqActivityMapping).filter(
    BoqActivityMapping.project_id == project_id,
    BoqActivityMapping.is_active == True,
    BoqActivityMapping.is_deleted == False,
).all()
for m in existing_mappings:
    existing_keys.add((
        m.work_type or '',
        m.layer_code or '',
        m.structure_type or '',
        m.element_code or '',
        m.activity_code or '',
    ))
```

And build suggestion key the same way:
```python
key = (
    s.work_type or '',
    s.layer_code or '',
    s.structure_type or '',
    s.element_code or '',
    s.activity_code or '',
)
if key in existing_keys:
    # skip
```

## Fix 3 — Deduplicate within suggestions list itself

After normalising and filtering against existing_keys,
also deduplicate within the suggestions list itself:
```python
seen = set()
deduped = []
for s in filtered:
    key = (s.work_type or '', s.layer_code or '',
           s.structure_type or '', s.element_code or '',
           s.activity_code or '')
    if key not in seen:
        seen.add(key)
        deduped.append(s)
filtered = deduped
```

## Fix 4 — bulk_confirm_mappings deduplication

In bulk_confirm_mappings, before inserting each mapping,
check if it already exists using the same 5-tuple key
(not just the unique constraint catch). Skip silently if exists.

Also normalise layer_code/structure_type/element_code/activity_code
against master data before inserting — same logic as Fix 1.

## Fix 5 — Clean up existing duplicate rows

Add a one-time cleanup in the upgrade endpoint or as a
separate admin endpoint:

POST /api/boq/activity-mapping/cleanup-duplicates

Logic:
- Find all active mappings for the project grouped by
  (work_type, layer_code, structure_type, element_code, activity_code)
- Where count > 1, keep the most recently created one,
  soft-delete the others
- Return {cleaned: n} count

## Completion checklist
- [ ] Master data normalisation in suggest endpoint
- [ ] existing_keys built correctly as 5-tuple
- [ ] Within-batch deduplication
- [ ] bulk_confirm deduplication + normalisation  
- [ ] POST /api/boq/activity-mapping/cleanup-duplicates endpoint
- [ ] Only boq_router.py modified