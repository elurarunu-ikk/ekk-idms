# Task: Add BOQ and TCS to user permissions screens

Read these three files first:
1. src/pages/UserManagement.jsx
2. src/pages/users/wizard/Step2AccessConfig.jsx
3. src/pages/users/wizard/Step3Modules.jsx

## Fix 1 — UserManagement.jsx

In ALL_MODULES array (around line 36), add after refdata:
  { id: 'boq', label: 'BOQ Register' },
  { id: 'tcs', label: 'TCS' },

Also add boq and tcs icons to the icon map
(same area where gradesheet: Upload, refdata: Map appear):
  boq: FileSpreadsheet,
  tcs: Ruler,

Import FileSpreadsheet and Ruler from lucide-react if not
already imported.

## Fix 2 — Step2AccessConfig.jsx

In FALLBACK_MODULES array, add after refdata entry:
  { id: 'boq', name: 'BOQ Register', description: 'BOQ versioning and qty tracking' },
  { id: 'tcs', name: 'TCS',          description: 'Typical cross section management' },

In the icon map (where gradesheet: Upload, refdata: Map appear):
  boq: FileSpreadsheet,
  tcs: Ruler,

Import FileSpreadsheet and Ruler from lucide-react if needed.

## Fix 3 — Step3Modules.jsx

In FALLBACK_MODULES array, add after refdata entry:
  { id: 'boq', name: 'BOQ Register', description: 'BOQ versioning and qty tracking', form_count: 3 },
  { id: 'tcs', name: 'TCS',          description: 'Typical cross section management', form_count: 1 },

In the icon map (where gradesheet: Upload, refdata: Map appear):
  boq: FileSpreadsheet,
  tcs: Ruler,

Import FileSpreadsheet and Ruler from lucide-react if needed.

## Rules
- Only modify these 3 files
- Do not change any logic, just add the two new entries
- Match exact formatting style of existing entries
- No other files modified