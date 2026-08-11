# Task: Build BOQ Quantity Actuals screen

Read these files first:
1. src/pages/BOQRegister.jsx — match exact component pattern
2. src/services/boqService.js — add one new service function
3. src/services/apiService.js — use api instance
4. src/services/session.js — useProjectSession hook
5. src/components/Navbar.jsx — PROJECT_DATA_ITEMS pattern

---

## File 1 — Add to src/services/boqService.js

Append this function:

```js
// GET /api/boq/qty-actuals
export const getBoqQtyActuals = (projectId) =>
  api.get('/api/boq/qty-actuals', { params: { project_id: projectId } })
    .then((res) => res.data);
```

---

## File 2 — src/pages/BOQQtyActuals.jsx (new file)

### Purpose
Shows actual vs planned quantities for each BOQ item.
Updated automatically when DPR entries are approved.
Read-only screen — no editing.

### Layout

**Top bar:**
- Title: "BOQ Progress Tracker — {project name}"
- Subtitle: "{count} items with recorded actuals"
- Last updated: show most recent `last_updated_at` across all items
- Refresh button — re-fetches data

**Summary cards row (4 cards):**
- Total BOQ items tracked: count of items in actuals
- Total approved qty: sum of all approved_qty (formatted with unit)
- Overall % complete: weighted average pct_complete
  = (sum of approved_qty / sum of revised_scope) × 100
- Total DPR entries: sum of all dpr_entry_count

**Filter bar:**
- Search: filter by description or item code
- Bill filter: dropdown of unique bill prefixes
  (derive from item_code prefix e.g. "4" from "4.04")
- Progress filter: All / Not started (0%) / In progress (>0% <100%) / Complete (100%)

**Progress table:**

Columns:
- BOQ No (item_code) — bold
- Description
- Unit
- Revised Scope (planned qty) — right aligned
- Actual Qty (approved_qty) — right aligned, green
- Balance Qty (balance_qty) — right aligned,
  red if < 10% of revised_scope, amber if < 25%
- % Complete — progress bar + percentage text
  Color:
    0%: gray bar
    1-25%: red bar
    26-75%: amber bar
    76-99%: blue bar
    100%: green bar
- DPR entries: count, muted
- Last updated: relative time (e.g. "2 days ago")
- Action: "View DPR entries" button
  (links to /captures?boq_item={item_code} — just build the link,
   the captures filter page is separate work)

**Progress bar component:**
```jsx
const ProgressBar = ({ pct }) => {
  const color =
    pct === 0   ? 'bg-gray-200' :
    pct < 25    ? 'bg-red-400' :
    pct < 75    ? 'bg-amber-400' :
    pct < 100   ? 'bg-blue-500' :
                  'bg-green-500';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-gray-100 rounded-full h-2">
        <div
          className={`h-2 rounded-full ${color}`}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
      <span className="text-xs font-medium w-10 text-right">
        {pct.toFixed(1)}%
      </span>
    </div>
  );
};
```

**Empty state:**
When no actuals exist yet:
  Icon + message: "No quantity actuals recorded yet."
  Sub-message: "Actuals are updated automatically when DPR entries
  are approved. Approve a DPR entry to see progress here."

**Loading state:**
Spinner while fetching.

**Error state:**
Toast error + retry button.

### Behaviour
- On mount: fetch actuals for selected project
- Refresh button: re-fetch
- All filters: client-side on fetched data
- Sort: default by item_code natural sort
  (same natural_sort_key pattern as BOQRegister)
- Numbers: format with toLocaleString('en-IN')
- Dates: show relative time using a simple helper:
```js
const relativeTime = (iso) => {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor(diff / 3600000);
  const mins = Math.floor(diff / 60000);
  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (mins > 0) return `${mins}m ago`;
  return 'just now';
};
```

### Note on data
The API only returns items that have at least one actual entry.
Items with 0 actuals are not returned — they are not shown.
The empty state handles the case where no items have actuals yet.

---

## Route and Navbar lines (show, do not apply)

Show the lines to add to App.jsx and Navbar.jsx.
Match exact pattern of existing BOQ routes.

For navbar — add under PROJECT_DATA_ITEMS after BOQ Mapping:
  { to: '/boq/actuals', label: 'BOQ Progress', icon: 'report', permission: 'boq' }

---

## Completion checklist
- [ ] boqService.js — getBoqQtyActuals appended
- [ ] src/pages/BOQQtyActuals.jsx created
- [ ] ProgressBar component inline
- [ ] 4 summary cards
- [ ] Filter bar (search + bill + progress)
- [ ] Table with progress bar column
- [ ] Empty / loading / error states
- [ ] Route and navbar lines shown (not applied)
- [ ] No other files modified
- [ ] Tailwind only
- [ ] react-hot-toast for errors