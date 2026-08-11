# Task: Separate boq_mapping as its own permission module

Read these files first:
1. src/components/Navbar.jsx — find BOQ Mapping entry in PROJECT_DATA_ITEMS
2. src/pages/UserManagement.jsx — ALL_MODULES array
3. src/pages/users/wizard/Step2AccessConfig.jsx — FALLBACK_MODULES + icon map
4. src/pages/users/wizard/Step3Modules.jsx — FALLBACK_MODULES + icon map
5. services/api/auth.py — MODULES list

## Fix 1 — Navbar.jsx

Find the BOQ Mapping entry in PROJECT_DATA_ITEMS:
  { to: '/boq/mapping', label: 'BOQ Mapping', icon: 'report', permission: 'boq' }

Change permission from 'boq' to 'boq_mapping':
  { to: '/boq/mapping', label: 'BOQ Mapping', icon: 'report', permission: 'boq_mapping' }

## Fix 2 — auth.py (backend)

In MODULES list, add 'boq_mapping' after 'boq':
  "boq_mapping",

## Fix 3 — UserManagement.jsx

In ALL_MODULES array, add after boq entry:
  { id: 'boq_mapping', label: 'BOQ Mapping' },

## Fix 4 — Step2AccessConfig.jsx

In FALLBACK_MODULES array, add after boq entry:
  { id: 'boq_mapping', name: 'BOQ Mapping',
    description: 'DPR to BOQ activity mapping setup (admin only)' },

In icon map add:
  boq_mapping: Map,

Map is already imported from lucide-react — reuse it.

## Fix 5 — Step3Modules.jsx

In FALLBACK_MODULES array, add after boq entry:
  { id: 'boq_mapping', name: 'BOQ Mapping',
    description: 'DPR to BOQ activity mapping setup (admin only)',
    form_count: 2 },

In icon map add:
  boq_mapping: Map,

## Rules
- Only modify these 5 files
- No logic changes — only add the new module entry in each file
- Backend auth.py change requires docker restart to take effect
- Do not modify any other files