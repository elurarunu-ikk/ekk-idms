# Task: Reorganise Navbar.jsx — add Project Data group

Read src/components/Navbar.jsx fully before making any changes.

## Goal

Reorganise the navigation into three clear groups:

### Group 1 — NAV_ITEMS (main navigation, unchanged except remove BOQ)
Keep exactly as-is:
- Dashboard
- Captures
- Pending
- Report
- AI Assistant

Remove BOQ from here — it moves to the new group below.

### Group 2 — PROJECT_DATA_ITEMS (new group, add after NAV_ITEMS)
This is a new constant. These are project-level data import and
reference screens:

```js
const PROJECT_DATA_ITEMS = [
  { to: '/boq',            label: 'BOQ Register',    icon: 'report',     permission: 'boq' },
  { to: '/grade-sheet',    label: 'Grade Sheet',     icon: 'gradesheet', permission: 'gradesheet' },
  { to: '/reference-data', label: 'Reference Data',  icon: 'refdata',    permission: 'refdata' },
  { to: '/tcs',            label: 'TCS',             icon: 'report',     permission: 'tcs' },
];
```

TCS has no page yet — use `/tcs` as the path. It will show a
"Coming soon" state when clicked (handle with a simple check:
if the path is /tcs, the route doesn't exist yet so React Router
will show nothing — that's acceptable for now).

### Group 3 — ADMIN_ITEMS (admin navigation)
Keep these only:
- Companies
- Projects
- Users
- Masters
- 3M Resources

Remove Grade Sheet and Reference Data from here
(they move to PROJECT_DATA_ITEMS above).

## Sidebar rendering

In the sidebar JSX, render three sections with small section labels: