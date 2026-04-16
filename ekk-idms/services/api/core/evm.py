"""
EVM (Earned Value Management) computation logic.
BCWP = Budgeted Cost of Work Performed (Earned Value)
BCWS = Budgeted Cost of Work Scheduled (Planned Value)
ACWP = Actual Cost of Work Performed (Actual Cost)
CPI  = BCWP / ACWP  (>1 = under budget)
SPI  = BCWP / BCWS  (>1 = ahead of schedule)
EAC  = BAC / CPI    (Estimate at Completion)
ETC  = EAC - ACWP   (Estimate to Complete)
"""

def compute_evm(bcwp: float, bcws: float, acwp: float, bac: float) -> dict:
    cpi = round(bcwp / acwp, 3) if acwp > 0 else 0
    spi = round(bcwp / bcws, 3) if bcws > 0 else 0
    eac = round(bac / cpi, 2) if cpi > 0 else 0
    etc = round(eac - acwp, 2)
    pct = round((bcwp / bac) * 100, 2) if bac > 0 else 0
    return {
        "bcwp": bcwp, "bcws": bcws, "acwp": acwp, "bac": bac,
        "cpi": cpi, "spi": spi, "eac": eac, "etc": etc,
        "pct_complete": pct,
        "cpi_alert": cpi < 0.95,
        "spi_alert": spi < 0.95,
    }
