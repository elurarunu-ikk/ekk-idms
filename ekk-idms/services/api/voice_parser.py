"""
voice_parser.py — Extract 3M resource data from voice transcripts.

Handles Indian English and Hindi code-mixing common on infrastructure sites.
Example inputs:
    "WMM 45 cum lagaya, roller aath ghante, 12 mazdoor day shift"
    "45 cubic meter GSB from crusher, compactor 6 hours operator Ravi, 8 skilled workers"
"""

import re
import logging
from typing import Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)

# ── Unit normalisation map ────────────────────────────────────────────────────
_UNIT_MAP: Dict[str, str] = {
    # Cubic
    "cubic meter": "CUM", "cubic metre": "CUM", "cum": "CUM", "cmt": "CUM",
    "cu m": "CUM", "cu.m": "CUM", "cubic": "CUM",
    # Metric ton
    "metric ton": "MT", "metric tonne": "MT", "tonne": "MT", "ton": "MT",
    "mt": "MT",
    # Kilogram
    "kilogram": "KG", "kg": "KG",
    # Linear metre
    "linear meter": "LM", "linear metre": "LM", "running meter": "LM",
    "running metre": "LM", "rm": "LM", "lm": "LM",
    # Square metre
    "square meter": "SQM", "square metre": "SQM", "sqm": "SQM", "sq m": "SQM",
    # Numbers / each
    "nos": "NOS", "no": "NOS", "number": "NOS", "each": "NOS",
    # Litre
    "litre": "LTR", "liter": "LTR", "ltr": "LTR", "l": "LTR",
    # Bag (cement)
    "bag": "BAG", "bags": "BAG",
}

# ── Material keyword → standard code ─────────────────────────────────────────
_MATERIAL_KEYWORDS: Dict[str, str] = {
    "wmm": "WMM", "wet mix macadam": "WMM",
    "gsb": "GSB", "granular sub base": "GSB", "sub base": "GSB",
    "bitumen": "BITUMEN", "bituminous": "BITUMEN", "asphalt": "BITUMEN",
    "vg10": "BITUMEN_VG10", "vg30": "BITUMEN_VG30", "vg40": "BITUMEN_VG40",
    "cement": "CEMENT", "opc": "CEMENT", "ppc": "CEMENT",
    "aggregate": "AGGREGATE", "agg": "AGGREGATE", "grit": "AGGREGATE",
    "sand": "SAND", "fine aggregate": "SAND",
    "water": "WATER",
    "steel": "STEEL", "reinforcement": "STEEL", "tor steel": "STEEL",
    "stone": "STONE", "boulder": "STONE",
    "crusher": "CRUSHER_DUST", "crusher dust": "CRUSHER_DUST",
    "fly ash": "FLY_ASH", "flyash": "FLY_ASH",
    "lime": "LIME",
    "rmc": "RMC", "ready mix": "RMC", "ready mixed concrete": "RMC",
    "emulsion": "EMULSION", "css": "EMULSION", "crs": "EMULSION",
    "dbm": "DBM", "dense bituminous macadam": "DBM",
    "bc": "BC", "bituminous concrete": "BC",
    "ctb": "CTB", "cement treated base": "CTB",
    "geotextile": "GEOTEXTILE",
    "hdpe": "HDPE_PIPE", "pipe": "PIPE",
    "paint": "PAINT", "thermoplastic": "THERMOPLASTIC",
    "reflector": "REFLECTOR", "delineator": "DELINEATOR",
}

# ── Machine keyword → standard code ──────────────────────────────────────────
_MACHINE_KEYWORDS: Dict[str, str] = {
    "roller": "ROLLER", "compactor": "COMPACTOR", "vibratory roller": "VIB_ROLLER",
    "pneumatic roller": "PNEU_ROLLER", "smooth roller": "SMT_ROLLER",
    "paver": "PAVER", "paving machine": "PAVER",
    "grader": "GRADER", "motor grader": "GRADER",
    "excavator": "EXCAVATOR", "jcb": "EXCAVATOR", "backhoe": "BACKHOE",
    "tipper": "TIPPER", "dumper": "DUMPER", "truck": "TRUCK",
    "water tanker": "WATER_TANKER", "tanker": "WATER_TANKER",
    "loader": "LOADER", "front end loader": "LOADER",
    "crane": "CRANE", "hydra": "HYDRA_CRANE",
    "concrete mixer": "CONCRETE_MIXER", "drum mixer": "CONCRETE_MIXER",
    "transit mixer": "TRANSIT_MIXER",
    "pump": "CONCRETE_PUMP", "concrete pump": "CONCRETE_PUMP",
    "generator": "GENERATOR", "genset": "GENERATOR",
    "weigh bridge": "WEIGH_BRIDGE", "level machine": "LEVEL_MACHINE",
    "total station": "TOTAL_STATION",
    "plate compactor": "PLATE_COMPACTOR",
    "rammer": "RAMMER",
    "cutting machine": "CUTTER", "cutter": "CUTTER",
}

# ── Manpower keyword → standard category code ─────────────────────────────────
_MANPOWER_KEYWORDS: Dict[str, str] = {
    "skilled": "SKILLED", "skilled worker": "SKILLED", "skilled labour": "SKILLED",
    "semiskilled": "SEMISKILLED", "semi skilled": "SEMISKILLED",
    "semi-skilled": "SEMISKILLED", "semi skilled worker": "SEMISKILLED",
    "unskilled": "UNSKILLED", "unskilled worker": "UNSKILLED",
    "labour": "UNSKILLED", "laborer": "UNSKILLED", "labourer": "UNSKILLED",
    "mazdoor": "UNSKILLED", "majdoor": "UNSKILLED",
    "mason": "MASON", "mistri": "MASON", "mistry": "MASON",
    "carpenter": "CARPENTER", "shuttering": "CARPENTER",
    "electrician": "ELECTRICIAN",
    "welder": "WELDER",
    "helper": "HELPER",
    "operator": "OPERATOR", "machine operator": "OPERATOR",
    "supervisor": "SUPERVISOR", "foreman": "SUPERVISOR",
    "engineer": "ENGINEER", "site engineer": "ENGINEER",
    "worker": "UNSKILLED",
}

# Hindi number words → digits
_HINDI_NUMBERS: Dict[str, int] = {
    "ek": 1, "do": 2, "teen": 3, "tin": 3, "char": 4, "paanch": 5, "panch": 5,
    "chhe": 6, "chh": 6, "saat": 7, "sat": 7, "aath": 8, "aat": 8,
    "nau": 9, "das": 10, "gyarah": 11, "barah": 12, "tera": 13, "chaudah": 14,
    "pandrah": 15, "solah": 16, "satrah": 17, "atharah": 18, "unnis": 19,
    "bees": 20, "pacchis": 25, "tees": 30, "chalees": 40, "pachaas": 50,
    "saath": 60, "sattar": 70, "assi": 80, "nabbe": 90, "sau": 100,
}

# Shift keywords
_SHIFT_MAP: Dict[str, str] = {
    "day shift": "DAY", "day": "DAY", "morning shift": "DAY", "morning": "DAY",
    "night shift": "NIGHT", "night": "NIGHT",
    "general shift": "GENERAL", "general": "GENERAL",
}

# ── Helpers ───────────────────────────────────────────────────────────────────

def _normalise(text: str) -> str:
    """Lowercase, collapse whitespace, remove punctuation except . and +."""
    text = text.lower()
    text = re.sub(r"[^\w\s\.\+]", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def _resolve_number(token: str) -> Optional[float]:
    """Parse a token as a number, including Hindi word-numbers."""
    token = token.strip()
    try:
        return float(token)
    except ValueError:
        return float(_HINDI_NUMBERS[token]) if token in _HINDI_NUMBERS else None


def _extract_quantity_unit(segment: str) -> Tuple[Optional[float], Optional[str]]:
    """Return (quantity, normalised_unit) from a text segment."""
    # Try pattern: <number> <unit_phrase>
    for unit_phrase in sorted(_UNIT_MAP, key=len, reverse=True):
        pattern = rf"(\d+(?:\.\d+)?)\s+{re.escape(unit_phrase)}\b"
        m = re.search(pattern, segment)
        if m:
            return float(m.group(1)), _UNIT_MAP[unit_phrase]

    # Try Hindi numbers before unit phrase
    for word, val in _HINDI_NUMBERS.items():
        for unit_phrase in sorted(_UNIT_MAP, key=len, reverse=True):
            pattern = rf"\b{word}\s+{re.escape(unit_phrase)}\b"
            if re.search(pattern, segment):
                return float(val), _UNIT_MAP[unit_phrase]

    # Bare number only (no unit found)
    m = re.search(r"(\d+(?:\.\d+)?)", segment)
    if m:
        return float(m.group(1)), None

    return None, None


def _normalise_unit(raw: str) -> str:
    raw = raw.lower().strip()
    return _UNIT_MAP.get(raw, raw.upper())


# ── Core extractors ───────────────────────────────────────────────────────────

def _extract_materials(text: str) -> List[Dict]:
    """
    Extract material entries from normalised transcript.

    Patterns handled:
        "45 cum wmm from crusher"
        "wmm 45 cubic meter"
        "cement 10 bags"
        "aggregate 20 ton from pit"
    """
    results: List[Dict] = []
    seen_codes: set = set()

    for keyword in sorted(_MATERIAL_KEYWORDS, key=len, reverse=True):
        if not re.search(rf"\b{re.escape(keyword)}\b", text):
            continue
        code = _MATERIAL_KEYWORDS[keyword]
        if code in seen_codes:
            continue

        # Find window around keyword (±60 chars)
        idx = text.find(keyword)
        # Skip if keyword appears only after "from" (it's a source reference, not a material)
        prefix = text[max(0, idx - 10):idx]
        if re.search(r"\bfrom\s*$", prefix):
            continue
        window = text[max(0, idx - 60): idx + len(keyword) + 60]

        qty, unit = _extract_quantity_unit(window)

        # Source: "from <word>" after keyword — exclude unit words only
        source = None
        src_m = re.search(r"\bfrom\s+(\w+)", window[window.find(keyword):])
        if src_m:
            src_word = src_m.group(1)
            if src_word not in _UNIT_MAP:
                source = src_word.title()

        # Test ref: "test ref <id>" or "ref <id>"
        test_ref = None
        ref_m = re.search(r"\b(?:test\s+ref|ref)\s+([\w\-]+)", window)
        if ref_m:
            test_ref = ref_m.group(1).upper()

        results.append({
            "material_code": code,
            "material_name": keyword.title(),
            "quantity": qty,
            "unit": unit,
            "source": source,
            "test_ref": test_ref,
        })
        seen_codes.add(code)

    return results


def _extract_machines(text: str) -> List[Dict]:
    """
    Extract machine entries from normalised transcript.

    Patterns handled:
        "roller 8 hours operator Ravi"
        "two compactor 6 ghante"
        "paver 4 hours"
    """
    results: List[Dict] = []
    seen_codes: set = set()

    # Replace Hindi "ghante" → "hours"
    text = re.sub(r"\bghante?\b", "hours", text)
    text = re.sub(r"\bghanta\b", "hour", text)

    for keyword in sorted(_MACHINE_KEYWORDS, key=len, reverse=True):
        if keyword not in text:
            continue
        code = _MACHINE_KEYWORDS[keyword]
        if code in seen_codes:
            continue

        idx = text.find(keyword)
        window = text[max(0, idx - 30): idx + len(keyword) + 80]

        # Hours: <number> hour(s)
        hours = None
        h_m = re.search(r"(\d+(?:\.\d+)?)\s*hours?\b", window)
        if h_m:
            hours = float(h_m.group(1))
        else:
            # Hindi number before hours
            for word, val in _HINDI_NUMBERS.items():
                if re.search(rf"\b{word}\s+hours?\b", window):
                    hours = float(val)
                    break

        # Operator name: "operator <Name>" (capitalised or next word)
        operator = None
        op_m = re.search(r"\boperator\s+([A-Za-z][a-z]+(?:\s+[A-Za-z][a-z]+)?)", window)
        if op_m:
            operator = op_m.group(1).title()

        # Count of machines (e.g. "two rollers", "3 rollers")
        count = 1
        cnt_m = re.search(
            rf"(\d+)\s+{re.escape(keyword)}|{re.escape(keyword)}s?\b",
            text[max(0, idx - 15): idx + len(keyword) + 5],
        )
        if cnt_m and cnt_m.group(1):
            count = int(cnt_m.group(1))

        # Log ref: "log ref <id>"
        log_ref = None
        lr_m = re.search(r"\blog\s*ref\s*([\w\-]+)", window)
        if lr_m:
            log_ref = lr_m.group(1).upper()

        results.append({
            "machine_code": code,
            "machine_name": keyword.title(),
            "count": count,
            "hours": hours,
            "operator_name": operator,
            "log_ref": log_ref,
        })
        seen_codes.add(code)

    return results


def _extract_manpower(text: str) -> List[Dict]:
    """
    Extract manpower entries from normalised transcript.

    Patterns handled:
        "12 skilled workers day shift"
        "8 mazdoor"
        "5 mason night shift"
        "teen mason morning"
    """
    results: List[Dict] = []
    seen_codes: set = set()

    # Build set of character positions occupied by machine operator references
    # so we can skip "operator" that appears as a machine qualifier
    machine_operator_spans: list[tuple[int, int]] = []
    for m_kw in _MACHINE_KEYWORDS:
        if m_kw not in text:
            continue
        for op_m in re.finditer(r"\boperator\s+[A-Za-z][a-z]+", text[text.find(m_kw):]):
            base = text.find(m_kw)
            machine_operator_spans.append((base + op_m.start(), base + op_m.end()))

    for keyword in sorted(_MANPOWER_KEYWORDS, key=len, reverse=True):
        # Require word-boundary match to prevent "worker" matching inside "workers" etc.
        if not re.search(rf"\b{re.escape(keyword)}\b", text):
            continue
        code = _MANPOWER_KEYWORDS[keyword]
        if code in seen_codes:
            continue

        idx = text.find(keyword)

        # Skip "operator" occurrences that are part of a machine "operator <Name>" phrase
        if keyword == "operator" and any(s <= idx < e for s, e in machine_operator_spans):
            continue

        window = text[max(0, idx - 30): idx + len(keyword) + 60]

        # Count: number or Hindi word before or after keyword
        count = None
        cnt_m = re.search(r"(\d+)\s+" + re.escape(keyword), window)
        if cnt_m:
            count = int(cnt_m.group(1))
        else:
            for word, val in _HINDI_NUMBERS.items():
                if re.search(rf"\b{word}\s+{re.escape(keyword)}", window):
                    count = val
                    break
        if count is None:
            cnt_m2 = re.search(re.escape(keyword) + r"\s+(\d+)", window)
            if cnt_m2:
                count = int(cnt_m2.group(1))

        # Shift
        shift = "DAY"
        for shift_phrase, shift_code in sorted(_SHIFT_MAP.items(), key=lambda x: len(x[0]), reverse=True):
            if shift_phrase in window:
                shift = shift_code
                break

        # Shift hours from pattern "X hours"
        shift_hours = 8.0
        sh_m = re.search(r"(\d+(?:\.\d+)?)\s*hours?\b", window)
        if sh_m:
            shift_hours = float(sh_m.group(1))

        # Subcategory from parenthetical or adjacent qualifier
        subcategory = None
        sub_m = re.search(r"\(([^)]+)\)", window)
        if sub_m:
            subcategory = sub_m.group(1).title()

        results.append({
            "category": code,
            "subcategory": subcategory,
            "count": count,
            "shift_type": shift,
            "shift_hours": shift_hours,
        })
        seen_codes.add(code)

    return results


# ── Confidence scorer ─────────────────────────────────────────────────────────

def _compute_confidence(
    transcript: str,
    materials: List[Dict],
    machines: List[Dict],
    manpower: List[Dict],
) -> float:
    """
    Score 0.0–1.0 based on how much of the transcript was successfully parsed.

    Logic:
    - Each recognised entity contributes weight.
    - Quantities and units further raise confidence.
    - Very short transcripts get a slight penalty.
    """
    score = 0.0
    word_count = len(transcript.split())

    if not (materials or machines or manpower):
        return 0.0

    total_entities = len(materials) + len(machines) + len(manpower)
    score += min(total_entities * 0.15, 0.45)  # up to 0.45 for entity count

    # Reward quantities being parsed
    qty_found = sum(1 for m in materials if m.get("quantity") is not None)
    qty_found += sum(1 for m in machines if m.get("hours") is not None)
    qty_found += sum(1 for m in manpower if m.get("count") is not None)
    score += min(qty_found * 0.1, 0.40)

    # Reward units being normalised
    unit_found = sum(1 for m in materials if m.get("unit") is not None)
    score += min(unit_found * 0.05, 0.15)

    # Penalty for very short transcripts (likely noise)
    if word_count < 5:
        score *= 0.6

    return round(min(score, 1.0), 3)


# ── Public API ────────────────────────────────────────────────────────────────

def parse_voice_transcript(transcript: str) -> Dict:
    """
    Parse a raw voice transcript and extract structured 3M resource data.

    Args:
        transcript: Raw text from STT / Whisper (any mix of English + Hindi).

    Returns:
        {
            "materials":  [ MaterialUsed-compatible dicts ],
            "machines":   [ MachineDeployed-compatible dicts ],
            "manpower":   [ ManpowerDeployed-compatible dicts ],
            "confidence": float (0.0 – 1.0),
            "raw":        original transcript,
        }
    """
    if not transcript or not transcript.strip():
        return {
            "materials": [], "machines": [], "manpower": [],
            "confidence": 0.0, "raw": transcript or "",
        }

    normalised = _normalise(transcript)
    logger.debug("voice_parser input: %s", normalised)

    # Replace Hindi numbers throughout for uniform processing
    for word, val in sorted(_HINDI_NUMBERS.items(), key=lambda x: -len(x[0])):
        normalised = re.sub(rf"\b{word}\b", str(val), normalised)

    materials = _extract_materials(normalised)
    machines  = _extract_machines(normalised)
    manpower  = _extract_manpower(normalised)

    confidence = _compute_confidence(normalised, materials, machines, manpower)

    logger.info(
        "voice_parser: %d materials, %d machines, %d manpower — confidence=%.3f",
        len(materials), len(machines), len(manpower), confidence,
    )

    return {
        "materials":  materials,
        "machines":   machines,
        "manpower":   manpower,
        "confidence": confidence,
        "raw":        transcript,
    }


def normalise_unit(raw_unit: str) -> str:
    """Public helper — normalise a raw unit string to standard code."""
    return _normalise_unit(raw_unit)
