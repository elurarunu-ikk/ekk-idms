# Task: Fix number parsing in BOQApprovals.jsx and ChangeRequestModal.jsx

The FastAPI backend returns Numeric/Decimal fields as strings in JSON.
This causes `.toFixed()` and arithmetic to fail in the frontend.
Fix all string-to-number conversions in these two files only.

## File 1 — src/pages/BOQApprovals.jsx

Read the file first. Then fix every place where a value coming from
the API (delta_amount, contract_value_v0, working_value,
cumulative_variation_pct, adjusted_rate, revised_scope, expected_scope,
old_qty, new_qty, old_rate, new_rate) is used in:
- arithmetic operations (+ - * /)
- comparison operators (> < >= <=)
- .toFixed() calls
- .toLocaleString() calls

Wrap each such value with Number() before use.
Also wrap any value passed to formatCr() or formatQty() helper
functions with Number() inside those helper functions at the top,
so callers don't need to worry about it.

Specifically ensure:
- formatCr: use Number(val) / 1e7
- formatQty: use Number(val) before toLocaleString
- pendingDeltaAmount reduce: use Number(c.delta_amount) || 0
- variationPct calculation: use Number(contractValueV0)
- variationPct.toFixed: use Number(variationPct).toFixed(2)
- Any other arithmetic on API numeric fields

## File 2 — src/components/ChangeRequestModal.jsx

Read the file first. Fix the same pattern:
- currentQty, currentRate (from item.revised_scope, item.adjusted_rate)
  wrap with Number() when used in arithmetic or display
- Live delta calculation: ensure Number() wrapping before subtraction
  and multiplication
- Any .toFixed() calls: wrap the value with Number() first
- formatCr helper if present: wrap val with Number()

## Rule

Do not change any logic, layout, or other functionality.
Only add Number() wrapping around API numeric string values.
Do not modify any other files.