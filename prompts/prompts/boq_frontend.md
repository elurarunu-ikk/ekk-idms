# Task: Build BOQ frontend — 3 pages + 1 service file

Read these files first before writing anything:
1. `src/services/apiService.js` — the `api` axios instance, interceptors,
   `getApiErrorMessage` — import from here, do NOT create a new axios instance
2. `src/services/session.js` — `useProjectSession` hook pattern,
   `hasPermission`, `getSelectedProjectId`
3. `src/pages/PendingApprovals.jsx` — match exact component structure,
   hooks pattern, toast usage, loading states, filter pattern
4. `src/pages/UserManagement.jsx` — match table and modal patterns

---

## File 1 — src/services/boqService.js

Add all BOQ API calls here. Use the existing `api` instance imported
from `./apiService`. Match the exact pattern of other service functions.

```js
import api, { getApiErrorMessage } from './apiService';

// GET /api/boq/versions
export const listBoqVersions = async (projectId) => { ... }

// GET /api/boq/register
// params: { project_id, version_no?, compare_v0?, bill_no?,
//           item_type?, search?, skip?, limit? }
export const getBoqRegister = async (params) => { ... }

// GET /api/boq/change-requests
// params: { project_id, approval_status?, skip?, limit? }
export const listChangeRequests = async (params) => { ... }

// POST /api/boq/change-request
export const createChangeRequest = async (payload) => { ... }

// POST /api/boq/change-request/{change_id}/approve
export const approveChangeRequest = async (changeId, payload) => { ... }

// POST /api/boq/change-request/{change_id}/reject
export const rejectChangeRequest = async (changeId, payload) => { ... }
```

All functions return `response.data` on success.
On error, throw the error so the calling component can catch it
and use `getApiErrorMessage`.

---

## File 2 — src/pages/BOQRegister.jsx

The main BOQ register screen. Matches Screen 1 from our design.

### Layout
Full page. Top bar with:
- Page title "BOQ Register — {project name}"
- Version selector dropdown (fetched from listBoqVersions)
- "Compare vs v0" toggle (checkbox, only shown when version > 0)
- Search input (filters description)
- Bill No filter dropdown (populated from unique bill_no values in data)
- Item type filter (All / BOQ Item / Non-BOQ Item)
- "Raise change" button — right side, opens ChangeRequestModal

### Summary cards row (4 cards)
Below the top bar, show 4 metric cards in a row:
- Contract value (v0): formatted as ₹ X.XX Cr
- Working BOQ value: formatted as ₹ X.XX Cr
- Cumulative variation: +X.XX% (green if 0, amber if <5%, red if ≥5%)
- Pending approvals: count (link to BOQApprovals page)

### Table
Columns:
- BOQ No (item_code) — bold, fixed width
- Description
- Unit
- Tender qty (expected_scope) — right aligned
- Revised qty (revised_scope) — right aligned
- Rate (adjusted_rate) — right aligned, formatted ₹
- Status badge — show change_flag when compare_v0=true:
  NO_CHANGE: gray
  QTY_CHANGED: amber
  RATE_CHANGED: blue
  BOTH_CHANGED: orange
  NEW_ITEM: green
  DELETED: red strikethrough row
- Action button — "Raise change" on each row (opens modal with item
  pre-filled)

When compare_v0=true, add two extra columns:
- Δ Qty (delta_qty) — show + or - prefix, color green/red
- Δ Amount (delta_amount) — show + or - prefix, formatted ₹

### Behaviour
- On mount: fetch versions, fetch register data for latest version
- When version selector changes: refetch register
- When compare_v0 toggle changes: refetch with compare_v0 param
- Search and bill filter: client-side filter on already-fetched data
  (BOQ is small, no need to re-fetch)
- Loading spinner while fetching
- Empty state message when no items
- Pagination: show 50 items per page with simple prev/next buttons

### Formatting helpers (define at top of file)
```js
const formatCr = (val) => val == null ? '—'
  : '₹ ' + (val / 1e7).toFixed(2) + ' Cr';

const formatQty = (val) => val == null ? '—'
  : Number(val).toLocaleString('en-IN', { maximumFractionDigits: 3 });

const formatRate = (val) => val == null ? '—'
  : '₹ ' + Number(val).toLocaleString('en-IN', { maximumFractionDigits: 2 });
```

---

## File 3 — src/components/ChangeRequestModal.jsx

Modal for raising a change request. Opens from BOQRegister.
Matches the change request form from our design (Screen 2).

### Props
```js
{ isOpen, onClose, onSuccess, item, projectId }
```
`item` is the boq_item object. When null, show "Add new variation item"
mode (change_type = NEW_ITEM).

### Form fields
- Item code (read-only if editing existing, editable if new item)
- Description (read-only if existing, editable if new)
- Unit (read-only if existing, editable if new)
- Change type selector:
  Edit existing: QTY_REVISED / RATE_REVISED / BOTH
  New item: NEW_ITEM (pre-selected, locked)
- Current qty (read-only, shows item.revised_scope)
- New quantity input (shown when change_type is QTY_REVISED or BOTH)
- Current rate (read-only, shows item.adjusted_rate)
- New rate input (shown when change_type is RATE_REVISED or BOTH)
- Reason code selector:
  POST_SURVEY / CLIENT_INSTRUCTION / SITE_CONDITION /
  ESCALATION / VARIATION_ORDER
- Remarks textarea (required)
- Document reference input (optional, e.g. filename or ref number)

### Financial impact row (live calculation)
Show below the form fields:
- Δ Qty: new_qty - current_qty (when applicable)
- Δ Amount: Δ qty × current rate (when applicable)
- Formatted as ₹ X.XX Cr

### Buttons
- Cancel
- Save draft (not implemented yet — show toast "Draft saving coming soon")
- Submit for approval (calls createChangeRequest, then onSuccess())

### Validation
- New qty required if change_type is QTY_REVISED or BOTH
- New rate required if change_type is RATE_REVISED or BOTH
- Remarks required (min 10 chars)
- Show inline error messages below each field

### Style
Use Tailwind. Match the modal pattern from UserManagement.jsx.
Semi-transparent overlay, white card, max-w-2xl, rounded-xl.
Use react-hot-toast for success/error notifications.

---

## File 4 — src/pages/BOQApprovals.jsx

The approval queue screen. Matches Screen 3 from our design.

### Layout
Full page. Title "BOQ change approvals — {project name}".

### Summary bar (4 cards)
- Total pending: count
- Total Δ amount pending: formatted ₹ Cr
- Cumulative variation if approved: X.XX%
- Variation threshold: 10% · Safe / Warning / Exceeded

### Filters
- Status filter: PENDING / L1_APPROVED / APPROVED / REJECTED / All
- Submitted by: text search

### Table
Columns:
- Item code + description (two lines)
- Change type badge:
  QTY_REVISED: amber
  RATE_REVISED: blue
  BOTH: orange
  NEW_ITEM: purple
  DELETED: red
- Submitted by + date (two lines)
- Change detail (show old→new qty or rate)
- Δ Amount (formatted ₹)
- Approval steps indicator:
  PENDING: show "L1 pending"
  L1_APPROVED: show "L1 ✓ → L2 pending"
  APPROVED: show "Approved ✓"
  REJECTED: show "Rejected ✗"
- Actions:
  PENDING: Approve (L1) + Reject buttons
  L1_APPROVED: Approve (Final) + Reject buttons
  APPROVED / REJECTED: View only

### Approve flow
Click Approve → show small inline confirm: "Approve this change?"
with level auto-detected (PENDING → level=1, L1_APPROVED → level=2).
On confirm: call approveChangeRequest, refresh list, show toast.

### Reject flow
Click Reject → show rejection reason textarea modal.
On confirm: call rejectChangeRequest with reason, refresh, toast.

### Permission guard
Only show Approve/Reject buttons if hasPermission('boq', 'approve').
Read-only view otherwise.

---

## Route registration

After creating the files, show me the lines to add to the router
(likely src/App.jsx or src/router.jsx). Do NOT modify the router file —
just show me the lines.

Match the exact import and Route pattern used in the existing router.

---

## Completion checklist
- [ ] src/services/boqService.js
- [ ] src/pages/BOQRegister.jsx
- [ ] src/components/ChangeRequestModal.jsx
- [ ] src/pages/BOQApprovals.jsx
- [ ] Route lines shown (not applied)
- [ ] No other files modified
- [ ] No new axios instance created — use api from apiService.js
- [ ] All monetary values formatted as ₹ X.XX Cr
- [ ] Tailwind only — no inline style objects
- [ ] react-hot-toast for all notifications
- [ ] Loading spinners on all async operations
- [ ] Empty states on all tables