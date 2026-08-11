# Task: Build BOQ Activity Mapping UI screen

Read these files first:
1. src/services/boqService.js — add 4 new service functions here
2. src/pages/BOQRegister.jsx — match exact component pattern
3. src/pages/BOQApprovals.jsx — match table and badge patterns
4. src/services/apiService.js — use api instance, getApiErrorMessage
5. src/services/session.js — useProjectSession hook

---

## File 1 — Add to src/services/boqService.js

Append these 4 functions (do not change existing ones):

```js
// GET /api/boq/activity-mapping
export const listActivityMappings = (projectId) =>
  api.get('/api/boq/activity-mapping', { params: { project_id: projectId } })
    .then((res) => res.data);

// POST /api/boq/activity-mapping/suggest
export const suggestActivityMappings = (projectId) =>
  api.post('/api/boq/activity-mapping/suggest', {}, { params: { project_id: projectId } })
    .then((res) => res.data);

// POST /api/boq/activity-mapping/bulk-confirm
export const bulkConfirmMappings = (projectId, suggestions) =>
  api.post('/api/boq/activity-mapping/bulk-confirm',
    { project_id: projectId, mappings: suggestions })
    .then((res) => res.data);

// POST /api/boq/activity-mapping (single manual entry)
export const createActivityMapping = (payload) =>
  api.post('/api/boq/activity-mapping', payload).then((res) => res.data);
```

---

## File 2 — src/pages/BOQMapping.jsx (new file)

### Overall layout
Full page. Two sections:
1. Top — existing confirmed mappings table
2. Bottom — AI suggest panel (collapsible, opens on button click)

### Top bar
- Title: "BOQ Activity Mapping — {project name}"
- Subtitle: "{count} active mappings"
- Two buttons right side:
  "✨ AI Suggest" — triggers suggest call
  "+ Add Manual" — opens AddMappingModal

### Section 1 — Confirmed mappings table

Columns:
- Work Type (badge — ROAD=teal, STRUCTURE=purple,
  DRAIN=blue, ANCILLARY=amber, MISC=gray)
- Layer / Structure (show layer_code if ROAD,
  structure_type + element_code if STRUCTURE,
  "—" otherwise)
- Activity code (or "Any")
- → BOQ item code + description (two lines,
  code bold, description muted)
- Formula badge (LxWxD / QUANTITY / LENGTH / LxW)
- Status (Active green / Inactive gray)
- Actions: deactivate button (soft delete)

Loading spinner while fetching.
Empty state: "No mappings yet. Use AI Suggest to get started."

### Section 2 — AI Suggest Panel

Hidden by default. Opens when "✨ AI Suggest" clicked.

#### States:

STATE 1 — Ready (before calling API)
  Gray panel with message:
  "Click 'Run AI Analysis' to let GPT-4o analyse your BOQ items
  and master activity combinations and suggest mappings."
  Button: "Run AI Analysis →"

STATE 2 — Loading
  Spinner + message: "GPT-4o is analysing 440 BOQ items and
  your master activity combinations..."
  (call suggestActivityMappings, disable button)

STATE 3 — Results
  Summary bar: "{total} suggestions · {already_mapped} already mapped"

  Suggestions table columns:
  - Confidence badge:
    HIGH = green pill
    MEDIUM = amber pill  
    LOW = red pill
  - Work Type badge (same colors as above)
  - Layer / Structure / Element
  - Activity
  - → BOQ item code + description
  - Formula
  - Reasoning (italic, muted, truncated to 60 chars)
  - Checkbox (pre-checked for HIGH, unchecked for MEDIUM/LOW)

  Bottom action bar:
  - "Select all HIGH confidence" button
  - "Deselect all" button  
  - "Confirm selected ({n})" primary button
    → calls bulkConfirmMappings with checked items
    → on success: refresh mappings table, show toast,
      collapse suggest panel

STATE 4 — Empty (no new suggestions)
  Green message: "✅ All combinations are already mapped.
  No new suggestions available."

### AddMappingModal component (inline, not separate file)

Simple modal for manual entry. Fields:
- Work Type: dropdown from fixed list
  [ROAD, STRUCTURE, DRAIN, ANCILLARY, MISC]
- Layer Code: text input (shown when work_type = ROAD)
  placeholder "e.g. WEARING"
- Structure Type: text input (shown when work_type = STRUCTURE)
  placeholder "e.g. MINOR_BRIDGE"
- Element Code: text input (shown when work_type = STRUCTURE)
  placeholder "e.g. FOOTING"
- Activity Code: text input (optional)
  placeholder "e.g. RCC (leave blank for any)"
- BOQ Item Code: text input required
  placeholder "e.g. 4.05"
- Volume Formula: dropdown
  [LxWxD, LxW, LENGTH, QUANTITY]
- Unit Conversion: number input, default 1.0

Validation:
- work_type required
- boq_item_code required
- volume_formula required

On submit: call createActivityMapping, refresh list, close modal, toast.

### Formatting helpers
```js
const WORK_TYPE_COLORS = {
  ROAD:      'bg-teal-100 text-teal-800',
  STRUCTURE: 'bg-purple-100 text-purple-800',
  DRAIN:     'bg-blue-100 text-blue-800',
  ANCILLARY: 'bg-amber-100 text-amber-800',
  MISC:      'bg-gray-100 text-gray-700',
};

const CONFIDENCE_COLORS = {
  high:   'bg-green-100 text-green-800',
  medium: 'bg-amber-100 text-amber-800',
  low:    'bg-red-100 text-red-800',
};

const FORMULA_COLORS = {
  LxWxD:    'bg-blue-50 text-blue-700',
  LxW:      'bg-indigo-50 text-indigo-700',
  LENGTH:   'bg-violet-50 text-violet-700',
  QUANTITY: 'bg-orange-50 text-orange-700',
};
```

### Behaviour rules
- On mount: fetch existing mappings
- After bulk confirm: re-fetch mappings, collapse panel,
  clear suggestions state
- All API errors: use getApiErrorMessage + toast.error
- All loading states: show spinner, disable action buttons

---

## Route registration

Show the lines to add to App.jsx — do NOT modify App.jsx.
Match the exact import and Route pattern from existing BOQ routes.

---

## Navbar

Show the line to add BOQMapping under Project Data section
in Navbar.jsx — do NOT modify Navbar.jsx.

---

## Completion checklist
- [ ] boqService.js — 4 new functions appended
- [ ] src/pages/BOQMapping.jsx — created
- [ ] AddMappingModal — inline in BOQMapping.jsx
- [ ] Route lines shown (not applied)
- [ ] Navbar line shown (not applied)
- [ ] No other files modified
- [ ] Uses api from apiService.js
- [ ] react-hot-toast for all notifications
- [ ] Tailwind only
- [ ] All 4 states implemented (ready/loading/results/empty)