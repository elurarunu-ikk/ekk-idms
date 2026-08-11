# Task: Build routers/boq_router.py — BOQ versioning API

Read these files first before writing anything:
1. `routers/capture_router.py` — match the exact auth pattern, Depends(get_db), verify_token usage
2. `models/boq.py` — BoqVersion, BoqItem, BoqItemChange models
3. `database.py` — SessionLocal, get_db
4. `models/user_project_access.py` — for permission check pattern

---

## What to build

A FastAPI router mounted at prefix `/boq` with these endpoints.
Use the same `verify_token` dependency and `get_db` pattern as capture_router.py.
All endpoints require authentication. project_id always comes from the request
(query param or body), never from JWT — VSRP is the only project right now
but the system is multi-project.

---

## Endpoint 1 — GET /boq/register

List all BOQ items for a project version. Default to the latest non-deleted
version. Allow comparing any version against v0.

Query params:
- project_id: str (required)
- version_no: int (optional, default = latest active version)
- compare_v0: bool (optional, default = False)
- bill_no: str (optional, filter by bill)
- item_type: str (optional, BOQ_ITEM or NON_BOQ_ITEM)
- search: str (optional, filter description contains)
- skip: int (default 0)
- limit: int (default 200, max 500)

Response per item (when compare_v0=False):
```json
{
  "id": "uuid",
  "item_code": "3.02",
  "bill_no": "03",
  "bill_description": "GRANULAR BASE AND SUB BASE COURSE",
  "description": "Crusher-run Granular Sub Base",
  "item_type": "BOQ_ITEM",
  "unit": "Cum",
  "adjusted_rate": 1949.7831,
  "expected_scope": 175513.424,
  "revised_scope": 190449.670,
  "wtg": 0.05877838,
  "is_active": true,
  "version_no": 0,
  "approval_status": null
}
```

When compare_v0=True, add these extra fields for each item:
- `v0_qty`: revised_scope from v0 (null if item did not exist in v0)
- `v0_rate`: adjusted_rate from v0
- `delta_qty`: revised_scope - v0_qty (null if new item)
- `delta_rate`: adjusted_rate - v0_rate
- `delta_amount`: delta_qty * adjusted_rate (null if either is null)
- `change_flag`: "NO_CHANGE" | "QTY_CHANGED" | "RATE_CHANGED" |
                 "BOTH_CHANGED" | "NEW_ITEM" | "DELETED"

Also return a summary block at the top level:
```json
{
  "version_no": 2,
  "state": "WORKING",
  "is_locked": false,
  "project_id": "VSRP",
  "total_items": 440,
  "boq_item_count": 407,
  "non_boq_count": 33,
  "contract_value_v0": 6317553292.69,
  "working_value": 6522999999.97,
  "cumulative_variation_pct": 3.24,
  "items": [...]
}
```

contract_value_v0 = SUM(revised_scope * adjusted_rate) for v0 BOQ_ITEMs
working_value = SUM(revised_scope * adjusted_rate) for current version BOQ_ITEMs
cumulative_variation_pct = ((working_value - contract_value_v0) / contract_value_v0) * 100

---

## Endpoint 2 — GET /boq/versions

List all versions for a project.

Query params:
- project_id: str (required)

Response:
```json
[
  {
    "id": "uuid",
    "version_no": 0,
    "state": "TENDER",
    "label": "Tender BOQ — imported 2026-06-23",
    "is_locked": true,
    "created_by": "system_import",
    "approved_by": null,
    "created_at": "2026-06-23T...",
    "item_count": 440
  }
]
```

---

## Endpoint 3 — POST /boq/change-request

Raise a change request on a BOQ item. Creates a BoqItemChange record
with approval_status = "PENDING". Does NOT create a new version yet —
version is created only when the change is approved.

Request body:
```json
{
  "project_id": "VSRP",
  "boq_item_id": "uuid of the item in current working version",
  "change_type": "QTY_REVISED",
  "new_qty": 739284.0,
  "new_rate": null,
  "reason_code": "POST_SURVEY",
  "remarks": "Site survey completed CH 0+000 to 37+000...",
  "doc_ref": "Survey_Report_Jun2026.pdf"
}
```

Validations:
- change_type must be one of: QTY_REVISED, RATE_REVISED, BOTH, NEW_ITEM, DELETED
- If change_type is QTY_REVISED, new_qty is required
- If change_type is RATE_REVISED, new_rate is required
- If change_type is BOTH, both new_qty and new_rate required
- Cannot raise a change request on a locked version's items
  (v0 items are locked — user must work against a WORKING version)
- Cannot raise a duplicate pending change on the same item
  (check: existing PENDING change for same boq_item_id)
- submitted_by = current user's username from JWT

Capture old_qty and old_rate from the item's current values before saving.

Response:
```json
{
  "id": "uuid",
  "boq_item_id": "uuid",
  "item_code": "2.03",
  "description": "Embankment with Borrow Earth",
  "change_type": "QTY_REVISED",
  "old_qty": 650399.558,
  "new_qty": 739284.0,
  "delta_qty": 88884.442,
  "delta_amount": 31584847.23,
  "approval_status": "PENDING",
  "submitted_by": "username",
  "submitted_at": "2026-06-23T..."
}
```

---

## Endpoint 4 — GET /boq/change-requests

List pending (or all) change requests for a project.

Query params:
- project_id: str (required)
- approval_status: str (optional, default = "PENDING")
- submitted_by: str (optional)
- skip: int (default 0)
- limit: int (default 50)

Response: list of change request objects same shape as POST response,
plus include item description and bill_no for display.

---

## Endpoint 5 — POST /boq/change-request/{change_id}/approve

Approve a change request (L1 or final approval).

Request body:
```json
{
  "project_id": "VSRP",
  "level": 1
}
```

Logic:
- level=1: set l1_approved_by, l1_approved_at, approval_status = "L1_APPROVED"
- level=2 (final): set approved_by, approved_at, approval_status = "APPROVED"
  Then apply the change:
  - Find the current WORKING version for this project
  - If no WORKING version exists, create one:
    version_no = (max version_no for project) + 1
    state = "WORKING"
    is_locked = False
    created_by = current user
  - Copy the boq_item into the new version with updated qty/rate
    (do NOT modify the original item — insert a new boq_item row
     with same item_code, new version_id, updated fields)
  - The change record approval_status stays "APPROVED"

approver = current user's username from JWT

Response: updated change request object.

---

## Endpoint 6 — POST /boq/change-request/{change_id}/reject

Reject a change request.

Request body:
```json
{
  "project_id": "VSRP",
  "rejection_reason": "Qty not supported by survey report"
}
```

Logic:
- Set rejected_by, rejected_at, rejection_reason
- Set approval_status = "REJECTED"
- The boq_item is NOT modified

Response: updated change request object.

---

## Pydantic schemas

Define all request/response schemas in the same file using Pydantic v2
(model_config = ConfigDict(from_attributes=True)).
Put schemas above the router definition.
Use Optional[...] with None defaults for nullable fields.
Use datetime for timestamp fields.
Use Decimal for monetary/quantity fields where precision matters.

---

## Router registration

After creating the file, show me the line to add to main.py to register
the router. Match the exact pattern used for other routers in main.py.

Do NOT modify main.py — just show me the line so I can add it.

---

## File structure

- routers/boq_router.py (create new)
- No other files modified

---

## Completion checklist

- [ ] 6 endpoints implemented
- [ ] All Pydantic schemas defined
- [ ] Auth (verify_token) on all endpoints
- [ ] get_db dependency on all endpoints
- [ ] Validation errors return HTTP 400 with clear message
- [ ] Not found returns HTTP 404
- [ ] Conflict (duplicate pending change) returns HTTP 409
- [ ] main.py registration line shown (not applied)