# Task: Build boq_qty_actuals table + DPR-to-BOQ link

Read these files first:
1. `models/site_data.py` — SiteDataTransaction model
2. `models/boq.py` — BoqItem, BoqVersion models
3. `models/level_register.py` — match Column/UUID pattern
4. `database.py` — Base import
5. `routers/capture_router.py` — find the approve_capture function
   (POST /{entry_id}/approve) — we will add BOQ qty update here

---

## Step 1 — Alembic migration (2 new tables)

### Table 1: boq_activity_mapping

This maps a layer_code + activity_code combination to a BOQ item.
It tells the system: "when a DPR entry with layer_code=WMM is approved,
add its volume to BOQ item 3.03".

Columns:
- id: UUID PK, default uuid.uuid4
- project_id: String(100), not null, index
  (use project_code string like "VSRP", not UUID FK)
- layer_code: String(50), not null
  (matches SiteDataTransaction.layer_code e.g. "WMM", "DBM", "BC")
- activity_code: String(50), nullable
  (optional further filter on SiteDataTransaction.activity_code)
- boq_item_code: String(30), not null
  (the item_code in boq_items e.g. "3.03", "4.04")
- volume_formula: String(20), not null, default "LxWxD"
  (how to compute qty: "LxWxD" = length×width×depth,
   "LxW" = length×width, "LENGTH" = chainage_to - chainage_from,
   "QUANTITY" = use quantity field directly)
- unit_conversion: Numeric(10, 6), default 1.0
  (multiplier if unit conversion needed)
- is_active: Boolean, server_default true
- created_at: DateTime(timezone=True), server_default NOW()
- is_deleted: Boolean, server_default false

UniqueConstraint: (project_id, layer_code, activity_code)
  — use name="uq_boq_activity_map"
  — activity_code nullable so use partial unique in postgres:
    just define the constraint normally, handle in app layer

### Table 2: boq_qty_actuals

Running cumulative quantity tracker per BOQ item.
One row per BOQ item per project. Updated on each DPR approval.

Columns:
- id: UUID PK, default uuid.uuid4
- project_id: String(100), not null, index
- boq_item_id: UUID, not null, index
  (FK to boq_items.id — the specific version's item,
   use the WORKING version item or v0 item)
- boq_item_code: String(30), not null
  (denormalised for fast lookup)
- cumulative_actual_qty: Numeric(14, 3), default 0
- approved_qty: Numeric(14, 3), default 0
  (qty from approved DPR entries only)
- last_dpr_id: UUID, nullable
  (id of the last SiteDataTransaction that updated this)
- last_updated_at: DateTime(timezone=True), nullable
- dpr_entry_count: Integer, default 0
  (how many DPR entries have contributed)
- is_deleted: Boolean, server_default false

UniqueConstraint: (project_id, boq_item_code)
  name="uq_boq_qty_actuals_project_item"

Index: (project_id, boq_item_code)

---

## Step 2 — SQLAlchemy models

Add to models/boq.py (append at the bottom, do not touch existing
classes):

class BoqActivityMapping(Base):
    __tablename__ = "boq_activity_mapping"
    ... (all columns as above)

class BoqQtyActual(Base):
    __tablename__ = "boq_qty_actuals"
    ... (all columns as above)

---

## Step 3 — Update models/__init__.py

Add imports:
from models.boq import BoqActivityMapping, BoqQtyActual

---

## Step 4 — Helper function in routers/boq_router.py

Add this function at the bottom of boq_router.py (do not expose as
an endpoint — internal use only):

```python
def compute_dpr_qty(entry: SiteDataTransaction, formula: str) -> float:
    """Compute quantity from DPR entry based on formula."""
    ch_from = float(entry.chainage_from or 0)
    ch_to   = float(entry.chainage_to or 0)
    length  = ch_to - ch_from
    width   = float(entry.width_m or 0)
    depth   = float(entry.depth_m or 0)

    if formula == "LxWxD":
        return length * width * depth
    elif formula == "LxW":
        return length * width
    elif formula == "LENGTH":
        return length
    elif formula == "QUANTITY":
        return float(entry.quantity or entry.quantity_lm or 0)
    return 0.0


def update_boq_qty_on_approval(
    db: Session,
    entry: SiteDataTransaction,
    project_code: str,
) -> None:
    """
    Called when a DPR entry is approved.
    Looks up boq_activity_mapping for this project + layer_code,
    computes quantity, then upserts boq_qty_actuals.
    Silently does nothing if no mapping found.
    """
    if not entry.layer_code:
        return

    mapping = db.query(BoqActivityMapping).filter(
        BoqActivityMapping.project_id == project_code,
        BoqActivityMapping.layer_code == entry.layer_code,
        BoqActivityMapping.is_active == True,
        BoqActivityMapping.is_deleted == False,
    ).first()

    if not mapping:
        return

    qty = compute_dpr_qty(entry, mapping.volume_formula)
    if qty <= 0:
        return

    qty *= float(mapping.unit_conversion or 1.0)

    # Upsert boq_qty_actuals
    actual = db.query(BoqQtyActual).filter(
        BoqQtyActual.project_id == project_code,
        BoqQtyActual.boq_item_code == mapping.boq_item_code,
        BoqQtyActual.is_deleted == False,
    ).first()

    if actual:
        actual.cumulative_actual_qty = float(
            actual.cumulative_actual_qty or 0) + qty
        actual.approved_qty = float(actual.approved_qty or 0) + qty
        actual.last_dpr_id = entry.id
        actual.last_updated_at = datetime.utcnow()
        actual.dpr_entry_count = (actual.dpr_entry_count or 0) + 1
    else:
        # Find the boq_item_id from v0 for this project
        from models.boq import BoqVersion, BoqItem
        v0 = db.query(BoqVersion).filter(
            BoqVersion.project_id == project_code,
            BoqVersion.version_no == 0,
            BoqVersion.is_deleted == False,
        ).first()
        boq_item_id = None
        if v0:
            item = db.query(BoqItem).filter(
                BoqItem.version_id == v0.id,
                BoqItem.item_code == mapping.boq_item_code,
                BoqItem.is_deleted == False,
            ).first()
            if item:
                boq_item_id = item.id

        actual = BoqQtyActual(
            project_id=project_code,
            boq_item_id=boq_item_id,
            boq_item_code=mapping.boq_item_code,
            cumulative_actual_qty=qty,
            approved_qty=qty,
            last_dpr_id=entry.id,
            last_updated_at=datetime.utcnow(),
            dpr_entry_count=1,
        )
        db.add(actual)
```

Import `datetime` at the top of boq_router.py if not already imported.
Import `SiteDataTransaction` from models.site_data.
Import `BoqActivityMapping`, `BoqQtyActual` from models.boq.

---

## Step 5 — Hook into capture approval

In routers/capture_router.py, find the endpoint that approves a
DPR entry (look for `approved = True` being set on the entry).

After the line that sets `entry.approved = True` and BEFORE
`db.commit()`, add:

```python
# Update BOQ quantity actuals
try:
    from routers.boq_router import update_boq_qty_on_approval
    from models.project import Project
    project = db.query(Project).filter(
        Project.id == entry.project_id
    ).first()
    project_code = project.project_code if project else None
    if project_code:
        update_boq_qty_on_approval(db, entry, project_code)
except Exception as e:
    # Never let BOQ update failure break DPR approval
    import logging
    logging.getLogger(__name__).warning(
        f"BOQ qty update failed for entry {entry.id}: {e}"
    )
```

The try/except is critical — BOQ update failure must NEVER
block or roll back the DPR approval.

---

## Step 6 — New endpoint: GET /boq/qty-actuals

Add to boq_router.py:
GET /boq/qty-actuals?project_id=VSRP
Returns list of BOQ items with actual quantities vs revised scope.

Response per item:

{

"boq_item_code": "3.03",

"description": "Wet Mix Macadam",

"unit": "Cum",

"revised_scope": 126064.27,

"cumulative_actual_qty": 15420.5,

"approved_qty": 15420.5,

"pct_complete": 12.23,

"balance_qty": 110643.77,

"dpr_entry_count": 47,

"last_updated_at": "2026-06-23T..."

}
Logic:

Join boq_qty_actuals with boq_items (v0, latest version)
pct_complete = (approved_qty / revised_scope) * 100
balance_qty = revised_scope - approved_qty
Only return BOQ_ITEM type items
Only items that have at least one actual entry

(inner join on boq_qty_actuals)
project_id query param required


---

## Step 7 — New endpoint: POST /boq/activity-mapping

Add to boq_router.py for admin to set up the layer→BOQ mappings:
POST /boq/activity-mapping

Body:

{

"project_id": "VSRP",

"layer_code": "WMM",

"activity_code": null,

"boq_item_code": "3.03",

"volume_formula": "LxWxD",

"unit_conversion": 1.0

}
GET /boq/activity-mapping?project_id=VSRP

Returns list of all active mappings for the project.

---

## Step 8 — Generate and apply migration

Run:
alembic revision --autogenerate -m "add_boq_qty_actuals_tables"

Then show me the generated migration file content.
Stop — do NOT run alembic upgrade head yet.

---

## Completion checklist
- [ ] boq_activity_mapping table in migration
- [ ] boq_qty_actuals table in migration
- [ ] BoqActivityMapping model in models/boq.py
- [ ] BoqQtyActual model in models/boq.py
- [ ] models/__init__.py updated
- [ ] compute_dpr_qty helper in boq_router.py
- [ ] update_boq_qty_on_approval helper in boq_router.py
- [ ] capture_router.py hooked (with try/except guard)
- [ ] GET /boq/qty-actuals endpoint
- [ ] POST /boq/activity-mapping endpoint
- [ ] GET /boq/activity-mapping endpoint
- [ ] Migration file shown, upgrade NOT run yet