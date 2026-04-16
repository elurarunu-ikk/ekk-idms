"""
Schedule H to DPR conversion engine.
LM (Linear Metres) → m³ or MT depending on activity unit type.
"""

def lm_to_m3(lm: float, width: float, thickness: float) -> float:
    """Convert linear metres to cubic metres."""
    return round(lm * width * thickness, 3)

def lm_to_mt(lm: float, width: float, thickness: float, density: float) -> float:
    """Convert linear metres to metric tonnes."""
    return round(lm * width * thickness * density, 3)

def lm_to_cross_section(lm: float, cross_section: float) -> float:
    """Convert LM using cross-section area (for non-standard profiles)."""
    return round(lm * cross_section, 3)

def compute_conversion(
    lm: float,
    unit: str,
    width: float = 0,
    thickness: float = 0,
    density: float = 0,
    cross_section: float = 0,
) -> dict:
    """
    Main conversion function. Returns quantity, unit, and formula used.
    unit: 'MT' | 'm3' | 'CUM' | 'SQM' | 'NOS'
    """
    unit_upper = unit.upper().replace("CUM", "M3").replace("CuM", "M3")

    if unit_upper == "MT":
        qty = lm_to_mt(lm, width, thickness, density)
        formula = f"{lm} x {width} x {thickness} x {density} = {qty} MT"
    elif unit_upper in ("M3", "CUM"):
        if cross_section > 0:
            qty = lm_to_cross_section(lm, cross_section)
            formula = f"{lm} x {cross_section} = {qty} m3"
        else:
            qty = lm_to_m3(lm, width, thickness)
            formula = f"{lm} x {width} x {thickness} = {qty} m3"
    elif unit_upper == "SQM":
        qty = round(lm * width, 3)
        formula = f"{lm} x {width} = {qty} sqm"
    else:
        qty = lm
        formula = f"NOS / count: {qty}"

    return {"quantity": qty, "unit": unit, "formula": formula}
