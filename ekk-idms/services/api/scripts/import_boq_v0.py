# python scripts/import_boq_v0.py \
#   --file /path/to/VSRP_REVISED_BOQ_SCOPE-23Jun2026.xlsx \
#   --project_id VSRP

import argparse
import os
import re
import sys
from datetime import date

import pandas as pd

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import SessionLocal
from models.boq import BoqItem, BoqVersion

ABBR_MAP = {
    "CTSB":  "Crusher-run Granular Sub Base",
    "WMM":   "Wet Mix Macadam",
    "DBM":   "Dense Bituminous Macadam",
    "BC":    "Bituminous Concrete",
    "HYSD":  "High Yield Strength Deformed bars",
    "HTS":   "High Tensile Strand",
    "GSB":   "Granular Sub Base",
    "DLC":   "Dry Lean Concrete",
    "PQC":   "Pavement Quality Concrete",
    "PCC":   "Plain Cement Concrete",
    "RCC":   "Reinforced Cement Concrete",
    "VUP":   "Vehicular Underpass",
    "LVUP":  "Light Vehicular Underpass",
    "PUP":   "Pedestrian Underpass",
    "MNB":   "Minor Bridge",
    "MJB":   "Major Bridge",
    "ROB":   "Road Over Bridge",
    "AIL":   "Aggregate Interlayer",
    "SG":    "Sub Grade",
    "SS":    "Seal Coat",
    "RS":    "Tack Coat",
    "NJCB":  "New Jersey Concrete Barrier",
    "ATMS":  "Advanced Traffic Management System",
}

# RE → Reinforced Earth only when followed by "Wall"
_RE_PATTERN = re.compile(r'\bRE\b(?=\s+Wall)')

# Suffix chars for duplicate item_code deduplication (1st dup → -b, 2nd → -c, …)
_SUFFIX_CHARS = "bcdefghijklmnopqrstuvwxyz"

# Desc keywords that mark a blank-BOQ_NO row as non-data
_SKIP_KEYWORDS = ("TOTAL", "VERIFIED BY", "PREPARED BY", "APPROVED BY")


def _expand_abbr(value):
    if not isinstance(value, str):
        return value
    result = _RE_PATTERN.sub("Reinforced Earth", value)
    for abbr, expansion in ABBR_MAP.items():
        result = re.sub(r'\b' + re.escape(abbr) + r'\b', expansion, result)
    return result


def _normalise_item_type(value):
    if not isinstance(value, str):
        return "NON_BOQ_ITEM"
    v = value.strip()
    if v == "BOQ Item":
        return "BOQ_ITEM"
    return "NON_BOQ_ITEM"


def _safe_float(v):
    try:
        return float(v) if pd.notna(v) else None
    except (ValueError, TypeError):
        return None


def _safe_int(v):
    try:
        return int(v) if pd.notna(v) else None
    except (ValueError, TypeError):
        return None


def main():
    parser = argparse.ArgumentParser(description="Import tender BOQ Excel as version 0")
    parser.add_argument("--file", required=True, help="Path to .xlsx file")
    parser.add_argument("--project_id", required=True, help="Project ID string")
    parser.add_argument("--dry-run", action="store_true",
                        help="Parse and print rows without connecting to the database")
    args = parser.parse_args()

    # Column positions (0-based)
    COL_WTG            = 11
    COL_UID            = 12
    COL_BOQ_NO         = 13
    COL_DESC           = 14
    COL_ITEM_TYPE      = 15
    COL_UNIT           = 16
    COL_ADJ_RATE       = 18
    COL_EXPECTED_SCOPE = 19
    COL_REVISED_SCOPE  = 20

    print(f"Reading {args.file} ...")
    raw = pd.read_excel(args.file, sheet_name="%", header=None)
    data_rows = raw.iloc[2:].reset_index(drop=True)

    current_bill_no   = None
    current_bill_desc = None
    pending_items     = []          # accumulated before any DB work
    seen_codes: dict  = {}          # Fix 1: track original codes for deduplication
    total      = 0
    boq_count  = 0
    nboq_count = 0
    skipped    = 0

    for pandas_idx, row in data_rows.iterrows():
        def col(idx, _row=row):
            return _row.iloc[idx] if idx < len(_row) else None

        boq_no_raw = col(COL_BOQ_NO)
        desc_raw   = col(COL_DESC)

        boq_no_str = str(boq_no_raw).strip() if pd.notna(boq_no_raw) else ""
        desc_str   = str(desc_raw).strip()   if pd.notna(desc_raw)   else ""

        # Fix 2: blank BOQ_NO handling
        if not boq_no_str:
            if not desc_str:
                skipped += 1
                continue
            if any(kw in desc_str.upper() for kw in _SKIP_KEYWORDS):
                skipped += 1
                continue
            # Real description with no BOQ_NO — assign a synthetic code
            uid_val = _safe_int(col(COL_UID))
            boq_no_str = f"NB-{uid_val}" if uid_val is not None else f"NB-AUTO-{pandas_idx}"

        if "TOTAL" in desc_str.upper():
            skipped += 1
            continue

        boq_lower = boq_no_str.lower()
        if "bill no" in boq_lower:
            parts = boq_no_str.split("-", 1)
            current_bill_no   = parts[1].strip() if len(parts) > 1 else boq_no_str
            current_bill_desc = desc_str
            skipped += 1
            continue
        if "non boq" in boq_lower:
            parts = boq_no_str.split("-", 1)
            current_bill_no   = parts[1].strip() if len(parts) > 1 else boq_no_str
            current_bill_desc = desc_str
            skipped += 1
            continue

        # Fix 1: deduplicate item_code within this import
        dup_count = seen_codes.get(boq_no_str, 0)
        seen_codes[boq_no_str] = dup_count + 1
        item_code = boq_no_str if dup_count == 0 else f"{boq_no_str}-{_SUFFIX_CHARS[dup_count - 1]}"

        total += 1
        if total % 50 == 0:
            print(".", end="", flush=True)

        item_type = _normalise_item_type(col(COL_ITEM_TYPE))

        unit_raw = col(COL_UNIT)
        unit_val = str(unit_raw).strip() if pd.notna(unit_raw) else None

        pending_items.append({
            "uid"             : _safe_int(col(COL_UID)),
            "item_code"       : item_code,
            "bill_no"         : current_bill_no,
            "bill_description": current_bill_desc,
            "description"     : _expand_abbr(desc_str),
            "item_type"       : item_type,
            "unit"            : unit_val,
            "adjusted_rate"   : _safe_float(col(COL_ADJ_RATE)),
            "expected_scope"  : _safe_float(col(COL_EXPECTED_SCOPE)),
            "revised_scope"   : _safe_float(col(COL_REVISED_SCOPE)),
            "wtg"             : _safe_float(col(COL_WTG)),
        })

        if item_type == "BOQ_ITEM":
            boq_count  += 1
        else:
            nboq_count += 1

    print()  # newline after progress dots

    # Fix 3: dry-run — print and exit without touching the database
    if args.dry_run:
        for item in pending_items:
            print(f"{item['item_code']} | {item['description']} | {item['item_type']}")
        print()
        print("DRY RUN — no data written.")
        print(f"  Total rows   : {total}")
        print(f"  BOQ_ITEM     : {boq_count}")
        print(f"  NON_BOQ_ITEM : {nboq_count}")
        print(f"  Skipped      : {skipped}")
        return

    db = SessionLocal()
    try:
        existing = db.query(BoqVersion).filter_by(
            project_id=args.project_id, version_no=0
        ).first()
        if existing:
            print(
                f"WARNING: BoqVersion v0 already exists for project "
                f"'{args.project_id}' (id={existing.id}). Exiting without changes."
            )
            return

        version = BoqVersion(
            project_id=args.project_id,
            version_no=0,
            state="TENDER",
            label=f"Tender BOQ — imported {date.today().isoformat()}",
            is_locked=True,
            created_by="system_import",
        )
        db.add(version)
        db.flush()

        for item_data in pending_items:
            db.add(BoqItem(version_id=version.id, **item_data))

        db.commit()
        print("Import complete.")
        print(f"  Version ID   : {version.id}")
        print(f"  Total rows   : {total}")
        print(f"  BOQ_ITEM     : {boq_count}")
        print(f"  NON_BOQ_ITEM : {nboq_count}")
        print(f"  Skipped      : {skipped}")

    except Exception as exc:
        db.rollback()
        print(f"\nERROR: {exc}")
        print("Transaction rolled back. No data was imported.")
        sys.exit(1)
    finally:
        db.close()


if __name__ == "__main__":
    main()
