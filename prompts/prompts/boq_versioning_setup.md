# Task: BOQ Versioning — Models + Migration + Import Script

You are working on the EKK IDMS project. The backend FastAPI app
lives inside the Docker container `ekk_api`, mounted from the Mac
at the local project folder. Work only on files inside the project
directory — do NOT modify any existing files except `models/__init__.py`.

---

## Context you must read first

Before writing anything, read these existing files so you match
the exact coding pattern:

1. `models/level_register.py` — UUID PK, Base import, text() defaults
2. `models/user.py` — to see how relationships are typically declared
3. `database.py` — confirms `from database import Base` import path
4. `models/__init__.py` — to see current imports before you add to it
5. `alembic.ini` — confirm script_location for migration output path

---

## Step 1 — Create `models/boq.py`

Create a new file `models/boq.py` with these three SQLAlchemy models.
Match the exact import style and column declaration style from
`models/level_register.py`. Use UUID primary keys throughout.
Use `server_default=text("NOW()")` for timestamps.
Use `server_default=text("false")` for booleans.
Use `from database import Base`.

### Model 1: BoqVersion
Table name: `boq_versions`

Columns:
- id: UUID PK, default=uuid.uuid4
- project_id: String(100), not null, index=True
- version_no: Integer, not null, default=0
- state: String(20), not null, default="TENDER"
  (values: TENDER / SURVEY / WORKING / FINAL)
- label: String(200), nullable
- is_locked: Boolean, server_default false
- created_by: String(200), nullable  (store username string, not FK)
- approved_by: String(200), nullable
- approved_at: DateTime(timezone=True), nullable
- reason: Text, nullable
- doc_ref: String(255), nullable
- created_at: DateTime(timezone=True), server_default NOW()
- updated_at: DateTime(timezone=True), nullable
- is_deleted: Boolean, server_default false

Constraints:
- UniqueConstraint("project_id", "version_no",
  name="uq_boq_version_project_vno")
- Index("ix_boq_versions_project_id", "project_id")

Relationship:
- items → BoqItem (back_populates="version")

### Model 2: BoqItem
Table name: `boq_items`

Columns:
- id: UUID PK, default=uuid.uuid4
- version_id: UUID, not null, index=True
  (references boq_versions.id — do not use FK constraint,
   use string-based relationship join instead to avoid circular issues)
- uid: Integer, nullable  (source UID from Excel import)
- item_code: String(30), not null  (e.g. "1.01", "7c.03", "VAR-001")
- bill_no: String(10), nullable    (e.g. "01", "06a", "08j")
- bill_description: Text, nullable
- description: Text, not null
- item_type: String(20), not null, default="BOQ_ITEM"
  (values: BOQ_ITEM / NON_BOQ_ITEM)
- unit: String(20), nullable
- adjusted_rate: Numeric(14,4), nullable
- expected_scope: Numeric(14,3), nullable
- revised_scope: Numeric(14,3), nullable
- wtg: Numeric(12,8), nullable
- is_active: Boolean, server_default true
- is_deleted: Boolean, server_default false
- created_at: DateTime(timezone=True), server_default NOW()

Constraints:
- UniqueConstraint("version_id", "item_code",
  name="uq_boq_item_version_code")
- Index("ix_boq_items_version_bill", "version_id", "bill_no")

Relationships:
- version → BoqVersion (back_populates="items")
- changes → BoqItemChange (back_populates="boq_item")

### Model 3: BoqItemChange
Table name: `boq_item_changes`

Columns:
- id: UUID PK, default=uuid.uuid4
- boq_item_id: UUID, not null, index=True
- change_type: String(20), not null
  (values: QTY_REVISED / RATE_REVISED / BOTH / NEW_ITEM / DELETED)
- old_qty: Numeric(14,3), nullable
- new_qty: Numeric(14,3), nullable
- old_rate: Numeric(14,4), nullable
- new_rate: Numeric(14,4), nullable
- reason_code: String(50), nullable
  (values: POST_SURVEY / CLIENT_INSTRUCTION /
   SITE_CONDITION / ESCALATION / VARIATION_ORDER)
- remarks: Text, nullable
- doc_ref: String(255), nullable
- submitted_by: String(200), nullable
- submitted_at: DateTime(timezone=True), server_default NOW()
- approval_status: String(20), server_default 'PENDING'
  (values: PENDING / L1_APPROVED / APPROVED / REJECTED)
- l1_approved_by: String(200), nullable
- l1_approved_at: DateTime(timezone=True), nullable
- approved_by: String(200), nullable
- approved_at: DateTime(timezone=True), nullable
- rejected_by: String(200), nullable
- rejected_at: DateTime(timezone=True), nullable
- rejection_reason: Text, nullable
- is_deleted: Boolean, server_default false

Constraints:
- Index("ix_boq_item_changes_item_id", "boq_item_id")
- Index("ix_boq_item_changes_status", "approval_status")

Relationship:
- boq_item → BoqItem (back_populates="changes")

---

## Step 2 — Update `models/__init__.py`

Add these three imports at the end of the existing import block.
Do NOT remove or change any existing imports:

```python
from models.boq import BoqVersion, BoqItem, BoqItemChange
```

---

## Step 3 — Generate Alembic migration

Run this command inside the ekk_api container:

```bash
docker exec -it ekk_api alembic revision --autogenerate \
  -m "add_boq_versioning_tables"
```

After the command runs, read the generated migration file from the
alembic/versions/ folder and show me the full content.

Do NOT run `alembic upgrade head` yet — stop here and show me
the migration file for review.

---

## Step 4 — Create import script `scripts/import_boq_v0.py`

Create the file at `scripts/import_boq_v0.py`.

This script imports the tender BOQ Excel file as version 0 (locked baseline).

The Excel file path will be passed as a command-line argument.
The project_id will also be passed as a command-line argument.

### What the script must do:

1. Accept two CLI args: `--file` (path to xlsx) and `--project_id`

2. Read the Excel file using pandas, sheet name "%", header=None.
   The actual column headers are in row index 1 (0-based).
   Data starts at row index 2.
   Use these column positions (0-based index within the sheet):
   - Col 10: SNO
   - Col 11: WTG
   - Col 12: UID
   - Col 13: BOQ_NO
   - Col 14: DESCRIPTION
   - Col 15: ITEM_TYPE   (values: "BOQ Item", "NON BOQ ITEM", "NO")
   - Col 16: UNIT
   - Col 17: AMOUNT      (bill section total — ignore this column)
   - Col 18: ADJ_RATE
   - Col 19: EXPECTED_SCOPE
   - Col 20: REVISED_SCOPE
   - Col 21: REVISED_RATE (ignore — not needed)

3. Identify bill section header rows:
   A row is a BILL HEADER if col 13 (BOQ_NO) contains
   "Bill No" or "Non BoQ" (case-insensitive).
   Extract bill_no and bill_description from these rows.
   bill_no = the part after "Bill No - " e.g. "01", "06a", "08j"
   bill_description = col 14 value for that row.
   For "Non BoQ" rows, bill_no = the Non BoQ number e.g. "NB-01".

4. For all non-header data rows, assign the most recent
   bill_no and bill_description seen above that row.

5. Normalise item_type:
   "BOQ Item"     → "BOQ_ITEM"
   "NON BOQ ITEM" → "NON_BOQ_ITEM"
   "NO"           → "NON_BOQ_ITEM"
   anything else  → "NON_BOQ_ITEM"

6. Skip rows where both BOQ_NO and DESCRIPTION are blank/NaN.
   Skip the final TOTAL row (where DESCRIPTION contains "TOTAL").

7. Use this abbreviation expansion map on the DESCRIPTION field
   before inserting. Replace whole words only (case-sensitive):
   "CTSB"  → "Crusher-run Granular Sub Base"
   "WMM"   → "Wet Mix Macadam"
   "DBM"   → "Dense Bituminous Macadam"
   "BC"    → "Bituminous Concrete"
   "HYSD"  → "High Yield Strength Deformed bars"
   "HTS"   → "High Tensile Strand"
   "GSB"   → "Granular Sub Base"
   "DLC"   → "Dry Lean Concrete"
   "PQC"   → "Pavement Quality Concrete"
   "PCC"   → "Plain Cement Concrete"
   "RCC"   → "Reinforced Cement Concrete"
   "RE"    → "Reinforced Earth"  (only when followed by "Wall")
   "VUP"   → "Vehicular Underpass"
   "LVUP"  → "Light Vehicular Underpass"
   "PUP"   → "Pedestrian Underpass"
   "MNB"   → "Minor Bridge"
   "MJB"   → "Major Bridge"
   "ROB"   → "Road Over Bridge"
   "AIL"   → "Aggregate Interlayer"
   "SG"    → "Sub Grade"
   "SS"    → "Seal Coat"
   "RS"    → "Tack Coat"
   "NJCB"  → "New Jersey Concrete Barrier"
   "ATMS"  → "Advanced Traffic Management System"

8. Database operations using SQLAlchemy (not raw SQL):
   a. Connect using DATABASE_URL from environment variable.
      Fall back to: postgresql://ekk:ekk_dev_2026@localhost:5432/ekk_idms
   b. Check if a BoqVersion already exists for this project_id
      with version_no=0. If yes, print a warning and exit
      without inserting anything — never overwrite v0.
   c. Create a BoqVersion record:
      - project_id = from CLI arg
      - version_no = 0
      - state = "TENDER"
      - label = "Tender BOQ — imported {today's date}"
      - is_locked = True
      - created_by = "system_import"
   d. For each valid data row, create a BoqItem record linked
      to the new BoqVersion.id.
   e. Commit once after all items are inserted (single transaction).
   f. Print a summary: version id, total rows processed,
      BOQ_ITEM count, NON_BOQ_ITEM count, skipped count.

9. Use a progress indicator — print a dot every 50 rows processed.

10. Handle errors gracefully: if any DB error occurs, rollback
    the entire transaction and print the error. Never leave a
    partial v0 import.

### Required imports for the script:
pandas, sqlalchemy, os, sys, argparse, re, datetime
Import BoqVersion and BoqItem from models.boq
Import SessionLocal from database

### Usage example (show this in a comment at the top):
# python scripts/import_boq_v0.py \
#   --file /path/to/VSRP_REVISED_BOQ_SCOPE-23Jun2026.xlsx \
#   --project_id VSRP

---

## Completion checklist

After all steps, confirm:
- [ ] models/boq.py created with 3 classes
- [ ] models/__init__.py updated (no existing imports removed)
- [ ] Migration file generated and shown for review
- [ ] scripts/import_boq_v0.py created
- [ ] No existing files modified except models/__init__.py

Stop after showing the migration file content.
Wait for my confirmation before suggesting to run alembic upgrade head.