# Task: Upgrade boq_activity_mapping + AI suggest endpoint

Read these files first before writing anything:
1. models/boq.py — BoqActivityMapping model (current columns)
2. routers/boq_router.py — update_boq_qty_on_approval, compute_dpr_qty,
   POST /activity-mapping, GET /activity-mapping
3. database.py — Base, get_db pattern
4. alembic/versions/da4cd2d73c00_add_boq_qty_actuals_tables.py
   — current head, use as down_revision

---

## Step 1 — Alembic migration

Revision message: "upgrade_boq_activity_mapping_work_type_structure"
down_revision = 'da4cd2d73c00'

### upgrade():

Add 3 nullable columns to boq_activity_mapping:
  op.add_column('boq_activity_mapping',
    sa.Column('work_type', sa.String(50), nullable=True))
  op.add_column('boq_activity_mapping',
    sa.Column('structure_type', sa.String(100), nullable=True))
  op.add_column('boq_activity_mapping',
    sa.Column('element_code', sa.String(50), nullable=True))

Backfill existing VSRP rows:
  op.execute(
    "UPDATE boq_activity_mapping SET work_type = 'ROAD' "
    "WHERE project_id = 'VSRP' AND work_type IS NULL"
  )

Drop old unique constraint and create new one:
  op.drop_constraint('uq_boq_activity_map',
    'boq_activity_mapping', type_='unique')
  op.create_unique_constraint(
    'uq_boq_activity_map_v2',
    'boq_activity_mapping',
    ['project_id', 'work_type', 'layer_code',
     'structure_type', 'element_code', 'activity_code']
  )

Add two new indexes:
  op.create_index('ix_boq_map_project_work_type',
    'boq_activity_mapping', ['project_id', 'work_type'])
  op.create_index('ix_boq_map_structure',
    'boq_activity_mapping',
    ['project_id', 'structure_type', 'element_code'])

### downgrade():
Reverse all of the above in correct order.

Show migration file content — do NOT run upgrade head yet.

---

## Step 2 — Update BoqActivityMapping model in models/boq.py

Add 3 new columns after existing columns:
  work_type      = Column(String(50), nullable=True)
  structure_type = Column(String(100), nullable=True)
  element_code   = Column(String(50), nullable=True)

Update UniqueConstraint name to 'uq_boq_activity_map_v2'
and include all 6 fields:
  ['project_id', 'work_type', 'layer_code',
   'structure_type', 'element_code', 'activity_code']

---

## Step 3 — Replace lookup logic in routers/boq_router.py

Add this helper function just before update_boq_qty_on_approval:

```python
def _find_mapping(db, project_code: str, entry) -> Optional[BoqActivityMapping]:
    """Priority cascade lookup — most specific match first."""
    wt = (entry.work_type or '').strip()
    lc = (entry.layer_code or '').strip()
    st = (entry.structure_type or '').strip()
    ec = (entry.element_code or '').strip()
    ac = (entry.activity_code or '').strip()

    base = db.query(BoqActivityMapping).filter(
        BoqActivityMapping.project_id == project_code,
        BoqActivityMapping.is_active == True,
        BoqActivityMapping.is_deleted == False,
    )

    def try_filter(**kwargs):
        q = base
        for col, val in kwargs.items():
            attr = getattr(BoqActivityMapping, col)
            if val:
                q = q.filter(attr == val)
            else:
                q = q.filter(attr == None)
        return q.first()

    # P1: ROAD — work_type + layer_code + activity_code
    if wt and lc and ac:
        m = try_filter(work_type=wt, layer_code=lc,
                       structure_type=None, element_code=None,
                       activity_code=ac)
        if m: return m

    # P2: ROAD — work_type + layer_code (any activity)
    if wt and lc:
        m = try_filter(work_type=wt, layer_code=lc,
                       structure_type=None, element_code=None,
                       activity_code=None)
        if m: return m

    # P3: STRUCTURE — work_type + structure_type + element_code + activity_code
    if wt and st and ec and ac:
        m = try_filter(work_type=wt, layer_code=None,
                       structure_type=st, element_code=ec,
                       activity_code=ac)
        if m: return m

    # P4: STRUCTURE — work_type + structure_type + element_code (any activity)
    if wt and st and ec:
        m = try_filter(work_type=wt, layer_code=None,
                       structure_type=st, element_code=ec,
                       activity_code=None)
        if m: return m

    # P5: DRAIN/ANCILLARY/MISC — work_type + activity_code
    if wt and ac:
        m = try_filter(work_type=wt, layer_code=None,
                       structure_type=None, element_code=None,
                       activity_code=ac)
        if m: return m

    # P6: catch-all — work_type only
    if wt:
        m = try_filter(work_type=wt, layer_code=None,
                       structure_type=None, element_code=None,
                       activity_code=None)
        if m: return m

    return None
```

In update_boq_qty_on_approval, replace the existing
db.query(BoqActivityMapping).filter(...).first() call
with:
  mapping = _find_mapping(db, project_code, entry)

Also update compute_dpr_qty — add QUANTITY fallback for
LxWxD when dimensions are incomplete:
```python
if formula == "LxWxD":
    vol = length * width * depth
    if vol <= 0 and (entry.quantity or 0) > 0:
        import logging
        logging.getLogger(__name__).warning(
            f"LxWxD gave 0 for entry {entry.id}, "
            f"falling back to quantity field"
        )
        return float(entry.quantity)
    return vol
```

---

## Step 4 — Update ActivityMappingCreate schema

Add optional fields to the Pydantic schema:
  work_type: Optional[str] = None
  structure_type: Optional[str] = None
  element_code: Optional[str] = None

Update ActivityMappingResponse schema to include same fields.

Update POST /boq/activity-mapping to save these fields.
Update GET /boq/activity-mapping to return these fields.

---

## Step 5 — New endpoint: POST /boq/activity-mapping/suggest

This endpoint calls the Claude API (claude-sonnet-4-6) to suggest
BOQ mappings for a project.

```python
@router.post("/activity-mapping/suggest")
async def suggest_activity_mappings(
    project_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
```

### What this endpoint does:

1. Load all BOQ items for this project (latest version, BOQ_ITEM only):
   fields needed: item_code, description, unit, bill_no, bill_description

2. Load all master combinations from DB:
   - master_work_types: code, label
   - master_layers: code, label
   - master_activities: code, label
   - master_elements: code, label
   - master_structure_types: code, label
   - master_activity_layers: activity_code, layer_code
   - master_activity_work_types: activity_code, work_type_code
   - master_structure_element_activities: structure_type_code,
     element_code, activity_code

3. Load existing confirmed mappings for this project
   (to exclude already-mapped combinations from suggestions)

4. Build the Claude API prompt:

```python
system_prompt = """You are a construction BOQ mapping expert for
Indian highway EPC projects. Your job is to match field DPR capture
combinations to the correct BOQ line items.

Rules:
- Match based on construction activity meaning, not just text similarity
- A DPR combination maps to exactly ONE BOQ item
- Consider the work type hierarchy: ROAD uses layers, STRUCTURE uses
  structure_type + element_code, DRAIN/ANCILLARY use activity_code
- For ROAD pavement layers: match layer material to BOQ description
- For STRUCTURE: match structure type + element + activity to BOQ item
- volume_formula rules:
  ROAD pavement (LM captures): use LxWxD
  STRUCTURE concrete/RCC: use QUANTITY (engineer enters Cum directly)
  STRUCTURE reinforcement: use QUANTITY (engineer enters MT)
  STRUCTURE shuttering: use QUANTITY (engineer enters Sqm)
  DRAIN concrete: use QUANTITY
  Linear items (drain, kerb): use LENGTH or LxW
- Confidence scoring:
  high: description clearly matches, unit matches
  medium: likely match but BOQ has multiple similar items
  low: uncertain, multiple candidates
- Return ONLY valid JSON, no explanation text"""

user_prompt = f"""
Project: {project_id}

BOQ ITEMS (item_code | description | unit | bill):
{boq_items_text}

MASTER DPR COMBINATIONS (work_type | layer | structure_type | element | activity):
{combinations_text}

ALREADY MAPPED (skip these):
{existing_mappings_text}

Return a JSON array of mapping suggestions:
[
  {{
    "work_type": "ROAD",
    "layer_code": "WEARING",
    "structure_type": null,
    "element_code": null,
    "activity_code": "BC",
    "boq_item_code": "4.05",
    "boq_description": "Bituminous Concrete - VG 40",
    "volume_formula": "LxWxD",
    "unit_conversion": 1.0,
    "confidence": "high",
    "reasoning": "BC activity on WEARING layer = Bituminous Concrete"
  }}
]

Map ALL combinations that have a clear BOQ match.
Skip combinations with no reasonable BOQ match.
"""
```

5. Call Claude API:
```python
import anthropic
client = anthropic.Anthropic()
response = client.messages.create(
    model="claude-sonnet-4-6",
    max_tokens=4000,
    messages=[{"role": "user", "content": user_prompt}],
    system=system_prompt,
)
```

6. Parse the JSON response and return it.
   Handle JSON parse errors gracefully — return empty list with error message.

7. Response schema:
```python
class MappingSuggestion(BaseModel):
    work_type: Optional[str]
    layer_code: Optional[str]
    structure_type: Optional[str]
    element_code: Optional[str]
    activity_code: Optional[str]
    boq_item_code: str
    boq_description: str
    volume_formula: str
    unit_conversion: float
    confidence: str  # high / medium / low
    reasoning: str

class SuggestResponse(BaseModel):
    suggestions: List[MappingSuggestion]
    total: int
    already_mapped: int
    error: Optional[str] = None
```

---

## Step 6 — New endpoint: POST /boq/activity-mapping/bulk-confirm

Admin sends the approved suggestions from the UI in one call.

```python
@router.post("/activity-mapping/bulk-confirm")
```

Request body: list of MappingSuggestion objects (only approved ones).

Logic: for each item, create a BoqActivityMapping row.
Skip any that already exist (upsert by unique constraint).
Return count of created mappings.

---

## Completion checklist
- [ ] Migration file shown (not applied)
- [ ] BoqActivityMapping model updated
- [ ] _find_mapping priority cascade added
- [ ] compute_dpr_qty QUANTITY fallback added
- [ ] ActivityMappingCreate/Response schemas updated
- [ ] POST/GET /activity-mapping updated
- [ ] POST /activity-mapping/suggest endpoint with Claude API
- [ ] POST /activity-mapping/bulk-confirm endpoint
- [ ] No other files modified

Stop after showing migration file. Wait for my confirmation
before proceeding to upgrade head.