"""
Grade Sheet Excel parser for Module 1.1.
Reads the original site-maintained Grade Sheet — no reformatting needed.
"""
from __future__ import annotations

import math
from datetime import datetime
from typing import Optional

import pandas as pd
from sqlalchemy.orm import Session

from models.level_register import LevelRegister
from models.ogl import OGL


# ── helpers ───────────────────────────────────────────────────────────────────

def safe_float(val) -> Optional[float]:
    try:
        v = float(val)
        if math.isnan(v):
            return None
        return round(v, 4)
    except (TypeError, ValueError):
        return None


def parse_chainage(val) -> Optional[int]:
    try:
        return int(float(str(val).replace("+", "")))
    except (TypeError, ValueError):
        return None


def detect_layer_code(sheet_name: str, title_text: str) -> tuple[Optional[str], Optional[int]]:
    RULES = {
        "BC": ("BC", 40),
        "DBM": ("DBM", 60),
        "WMM": ("WMM", 100),
        "CTB": ("CTB", 180),
        "CTSB": ("CTB", 180),
        "GSB": ("GSB", 150),
        "SUBGRADE": ("SG", None),
        "EMBANKMENT TOP": ("EMB", None),
        "EMBANKMENT": ("EMB", None),
        "OGL": ("OGL", None),
    }
    name_upper = sheet_name.upper().strip()
    if name_upper in RULES:
        return RULES[name_upper]
    # fallback to title text
    title_upper = str(title_text).upper()
    for key, result in RULES.items():
        if key in title_upper:
            return result
    return (None, None)


def parse_column_map(header_row: list) -> dict:
    headers = [str(h).strip() if h is not None else "" for h in header_row]

    # CH is always first column
    ch_idx = 0

    # Find SE%/CAMBER% positions
    camber_positions = []
    camber_type = "CAMBER %"
    for i, h in enumerate(headers):
        hu = h.upper().replace(" ", "")
        if hu in ("SE%", "CAMBER%"):
            camber_positions.append(i)
            if not camber_positions:
                camber_type = h

    if camber_positions:
        camber_type = headers[camber_positions[0]]

    camber_l_idx = camber_positions[0] if len(camber_positions) > 0 else None
    camber_r_idx = camber_positions[1] if len(camber_positions) > 1 else None

    # Find FRL positions (or SUB for SUBGRADE)
    frl_positions = []
    for i, h in enumerate(headers):
        hu = h.upper()
        if "FRL" in hu or "SUB" in hu:
            frl_positions.append(i)
    frl_l_idx = frl_positions[0] if len(frl_positions) > 0 else None
    frl_r_idx = frl_positions[1] if len(frl_positions) > 1 else None

    # Find TCS
    tcs_idx = None
    for i, h in enumerate(headers):
        if "TCS" in h.upper():
            tcs_idx = i
            break

    # LHS offsets: numeric columns between ch_idx+1 and camber_l_idx
    lhs_offsets: dict[float, int] = {}
    if camber_l_idx is not None:
        for i in range(ch_idx + 1, camber_l_idx):
            v = safe_float(headers[i])
            if v is not None:
                lhs_offsets[v] = i

    # RHS offsets: numeric columns between camber_r_idx+1 and tcs_idx
    rhs_offsets: dict[float, int] = {}
    if camber_r_idx is not None:
        end = tcs_idx if tcs_idx is not None else len(headers)
        for i in range(camber_r_idx + 1, end):
            v = safe_float(headers[i])
            if v is not None:
                rhs_offsets[v] = i

    return {
        "ch_idx": ch_idx,
        "camber_l_idx": camber_l_idx,
        "frl_l_idx": frl_l_idx,
        "frl_r_idx": frl_r_idx,
        "camber_r_idx": camber_r_idx,
        "tcs_idx": tcs_idx,
        "camber_type": camber_type,
        "lhs_offsets": lhs_offsets,
        "rhs_offsets": rhs_offsets,
    }


def nearest_11m(rl_dict: dict) -> Optional[float]:
    for key in (11.0, 11.04, 11.1, 11.2, 11.5, 11.54, 11.6, 11.7, 13.0):
        v = rl_dict.get(key)
        if v is not None:
            return v
    return None


# ── Layer sheet parser ────────────────────────────────────────────────────────

def parse_layer_sheet(
    wb_path: str,
    sheet_name: str,
    project_id: str,
    uploaded_by: str,
) -> tuple[list[dict], Optional[str]]:
    try:
        df = pd.read_excel(wb_path, sheet_name=sheet_name, header=None, engine="openpyxl")
    except Exception as exc:
        return [], f"Failed to read sheet '{sheet_name}': {exc}"

    # Detect layer
    title_text = str(df.iloc[1, 0]) if len(df) > 1 else ""
    layer_code, thickness_mm = detect_layer_code(sheet_name, title_text)
    if layer_code is None:
        return [], f"Unknown layer sheet: {sheet_name}"
    if layer_code == "OGL":
        return [], None  # handled separately

    layer_desc = str(df.iloc[1, 0]).strip() if len(df) > 1 else None

    # Find header row: first row where col 0 is 'CH' or 'CHAINAGE'
    header_row_idx = None
    for i, row in df.iterrows():
        cell = str(row.iloc[0]).strip().upper()
        if cell in ("CH", "CHAINAGE"):
            header_row_idx = i
            break
    if header_row_idx is None:
        return [], f"No CH column found in sheet '{sheet_name}'"

    header_list = [df.iloc[header_row_idx, c] for c in range(len(df.columns))]
    col_map = parse_column_map(header_list)

    now = datetime.utcnow()
    records = []
    prev_tcs = None

    for i in range(header_row_idx + 1, len(df)):
        row = df.iloc[i]

        chainage = parse_chainage(row.iloc[col_map["ch_idx"]])
        if chainage is None:
            continue

        # TCS — carry forward if blank; truncate to 200 chars for safety
        if col_map["tcs_idx"] is not None:
            tcs_val = row.iloc[col_map["tcs_idx"]]
            tcs_str = str(tcs_val).strip() if tcs_val is not None and str(tcs_val).strip() not in ("", "nan", "None") else None
            if tcs_str:
                prev_tcs = tcs_str[:200]
        tcs_ref = prev_tcs

        frl_l = safe_float(row.iloc[col_map["frl_l_idx"]]) if col_map["frl_l_idx"] is not None else None
        frl_r = safe_float(row.iloc[col_map["frl_r_idx"]]) if col_map["frl_r_idx"] is not None else None

        # Camber: values in sheet are raw % (e.g. -2.5), not decimals
        camber_l_raw = safe_float(row.iloc[col_map["camber_l_idx"]]) if col_map["camber_l_idx"] is not None else None
        camber_r_raw = safe_float(row.iloc[col_map["camber_r_idx"]]) if col_map["camber_r_idx"] is not None else None

        # Build LHS RL dict
        lhs_rl: dict[float, Optional[float]] = {}
        for offset, col_idx in col_map["lhs_offsets"].items():
            lhs_rl[offset] = safe_float(row.iloc[col_idx])

        # Build RHS RL dict
        rhs_rl: dict[float, Optional[float]] = {}
        for offset, col_idx in col_map["rhs_offsets"].items():
            rhs_rl[offset] = safe_float(row.iloc[col_idx])

        lhs_offsets_sorted = sorted(col_map["lhs_offsets"].keys())
        rhs_offsets_sorted = sorted(col_map["rhs_offsets"].keys())

        base = dict(
            project_id=project_id,
            layer_code=layer_code,
            layer_desc=layer_desc,
            thickness_mm=thickness_mm,
            chainage=chainage,
            camber_type=col_map["camber_type"],
            tcs_ref=tcs_ref,
            version=1,
            is_active=True,
            uploaded_by=uploaded_by,
            uploaded_at=now,
        )

        # LHS record
        lhs_max = max(lhs_offsets_sorted) if lhs_offsets_sorted else None
        records.append({
            **base,
            "road_side": "L",
            "frl_center": frl_l,
            "camber_pct": camber_l_raw,
            "road_width_m": lhs_max,
            "offset_widths": lhs_offsets_sorted,
            "rl_values": {str(k): v for k, v in lhs_rl.items()},
            "rl_at_0m": lhs_rl.get(0.0),
            "rl_at_2m": lhs_rl.get(2.0),
            "rl_at_6m": lhs_rl.get(6.0),
            "rl_at_9_5m": lhs_rl.get(9.5),
            "rl_at_11m": nearest_11m(lhs_rl),
            "rl_at_edge": lhs_rl.get(lhs_max) if lhs_max is not None else None,
        })

        # RHS record
        rhs_max = max(rhs_offsets_sorted) if rhs_offsets_sorted else None
        records.append({
            **base,
            "road_side": "R",
            "frl_center": frl_r,
            "camber_pct": camber_r_raw,
            "road_width_m": rhs_max,
            "offset_widths": rhs_offsets_sorted,
            "rl_values": {str(k): v for k, v in rhs_rl.items()},
            "rl_at_0m": rhs_rl.get(0.0),
            "rl_at_2m": rhs_rl.get(2.0),
            "rl_at_6m": rhs_rl.get(6.0),
            "rl_at_9_5m": rhs_rl.get(9.5),
            "rl_at_11m": nearest_11m(rhs_rl),
            "rl_at_edge": rhs_rl.get(rhs_max) if rhs_max is not None else None,
        })

    return records, None


# ── OGL sheet parser ──────────────────────────────────────────────────────────

_LHS_OFFSETS = [30, 28, 26, 24, 22, 20, 18, 16, 14, 12, 10, 8, 6, 4, 2]
_RHS_OFFSETS = [2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30]


def parse_ogl_sheet(
    wb_path: str,
    project_id: str,
    uploaded_by: str,
) -> tuple[list[dict], Optional[str]]:
    try:
        df = pd.read_excel(wb_path, sheet_name="OGL", header=2, engine="openpyxl")
    except Exception as exc:
        return [], f"Failed to read OGL sheet: {exc}"

    # Rename first column to 'chainage'
    cols = list(df.columns)
    cols[0] = "chainage"
    df.columns = cols

    now = datetime.utcnow()
    records = []

    for _, row in df.iterrows():
        chainage = parse_chainage(row["chainage"])
        if chainage is None:
            continue

        ogl_cl = safe_float(row.get("RL_CL"))

        lhs_rl: dict[int, Optional[float]] = {}
        for off in _LHS_OFFSETS:
            col = f"RL_L{off}"
            lhs_rl[off] = safe_float(row.get(col))

        rhs_rl: dict[int, Optional[float]] = {}
        for off in _RHS_OFFSETS:
            col = f"RL_R{off}"
            rhs_rl[off] = safe_float(row.get(col))

        base = dict(
            project_id=project_id,
            layer_code="OGL",
            chainage=chainage,
            ogl_cl=ogl_cl,
            frl_center=ogl_cl,
            road_width_m=30.0,
            version=1,
            is_active=True,
            uploaded_by=uploaded_by,
            uploaded_at=now,
        )

        records.append({
            **base,
            "road_side": "L",
            "offset_widths": sorted(_LHS_OFFSETS),
            "rl_values": {str(k): v for k, v in lhs_rl.items()},
            "rl_at_2m": lhs_rl.get(2),
            "rl_at_6m": lhs_rl.get(6),
            "rl_at_edge": lhs_rl.get(30),
        })

        records.append({
            **base,
            "road_side": "R",
            "offset_widths": sorted(_RHS_OFFSETS),
            "rl_values": {str(k): v for k, v in rhs_rl.items()},
            "rl_at_2m": rhs_rl.get(2),
            "rl_at_6m": rhs_rl.get(6),
            "rl_at_edge": rhs_rl.get(30),
        })

    return records, None


# ── GPS sheet parser ──────────────────────────────────────────────────────────

_GPS_COLS = [
    "upc", "nh_new", "nh_old", "section", "state", "district", "ro", "piu",
    "status", "ch_from", "ch_to",
    "lat_start", "lon_start", "alt_start",
    "lat_end", "lon_end", "alt_end", "entrusted",
]


def parse_gps_sheet(
    wb_path: str,
    project_id: str,
    uploaded_by: str,
) -> tuple[list[dict], Optional[str]]:
    try:
        df = pd.read_excel(wb_path, sheet_name="GPS", header=0, engine="openpyxl")
    except Exception as exc:
        return [], f"Failed to read GPS sheet: {exc}"

    # Normalise column names to lowercase+strip
    df.columns = [str(c).strip().lower() for c in df.columns]

    # Detect chainage column (may be named 'chainage', 'ch', 'chainage_from', etc.)
    ch_col = next((c for c in df.columns if c in ("chainage", "ch", "chainage_from")), None)
    lat_col = next((c for c in df.columns if c in ("latitude", "lat", "lat_start")), None)
    lon_col = next((c for c in df.columns if c in ("longitude", "lon", "lon_start")), None)
    if ch_col is None:
        return [], "GPS sheet skipped: no chainage column found"

    df = df[pd.to_numeric(df[ch_col], errors="coerce").notna()]

    now = datetime.utcnow()
    records = []

    def _str(v):
        s = str(v).strip()
        return s if s not in ("nan", "None", "") else None

    for _, row in df.iterrows():
        ch_from = safe_float(row.get(ch_col))
        if ch_from is None:
            continue

        # Single-point GPS format: chainage_to = chainage_from (point entry)
        ch_to = safe_float(row.get("ch_to")) or ch_from

        # NH number may appear as float (e.g. 45.0) — strip decimal
        nh_raw = row.get("nh_number") or row.get("nh_new")
        nh_number = _str(nh_raw).split(".")[0] if nh_raw is not None and _str(nh_raw) else None

        records.append(dict(
            project_id=project_id,
            chainage_from=int(ch_from),
            chainage_to=int(ch_to),
            nh_number=nh_number,
            state=_str(row.get("state")),
            district=_str(row.get("district")),
            ro=_str(row.get("ro")),
            piu=_str(row.get("piu")),
            lat_start=safe_float(row.get(lat_col)) if lat_col else None,
            lon_start=safe_float(row.get(lon_col)) if lon_col else None,
            alt_start_m=safe_float(row.get("altitude") or row.get("alt_start")),
            lat_end=None,
            lon_end=None,
            alt_end_m=None,
            uploaded_at=now,
        ))

    return records, None


# ── OGL Analysis compute ──────────────────────────────────────────────────────

def compute_ogl_analysis(project_id: str, db: Session) -> list[dict]:
    ogl_rows = db.query(OGL).filter(OGL.project_id == project_id).all()
    emb_rows = (
        db.query(LevelRegister)
        .filter(
            LevelRegister.project_id == project_id,
            LevelRegister.layer_code == "EMB",
            LevelRegister.is_active == True,
        )
        .all()
    )

    # Index EMB by (chainage, road_side)
    emb_index: dict[tuple[int, str], LevelRegister] = {
        (r.chainage, r.road_side): r for r in emb_rows
    }

    now = datetime.utcnow()
    results = []

    for ogl in ogl_rows:
        emb = emb_index.get((ogl.chainage, ogl.road_side))
        if emb is None or ogl.ogl_cl is None:
            continue

        ogl_rl = float(ogl.ogl_cl)
        emb_frl = float(emb.frl_center) if emb.frl_center is not None else None
        if emb_frl is None:
            continue

        cut_fill_m = round(emb_frl - ogl_rl, 4)
        if cut_fill_m > 0.001:
            cut_fill_type = "FILL"
        elif cut_fill_m < -0.001:
            cut_fill_type = "CUT"
        else:
            cut_fill_type = "ZERO"

        results.append(dict(
            project_id=project_id,
            chainage=ogl.chainage,
            road_side=ogl.road_side,
            ogl_rl=ogl_rl,
            emb_frl=emb_frl,
            cut_fill_m=cut_fill_m,
            cut_fill_type=cut_fill_type,
            cross_area_sqm=None,
            volume_cum=None,
            version=1,
            is_active=True,
            computed_at=now,
        ))

    return results
