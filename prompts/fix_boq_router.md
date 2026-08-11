# Task: Fix two bugs in routers/boq_router.py

Read routers/boq_router.py first. Then fix exactly these two issues:

## Fix 1 — contract_value_v0 and cumulative_variation_pct returning None

In the GET /api/boq/register endpoint, the summary calculation for
contract_value_v0 and working_value is failing because SQLAlchemy
returns Numeric columns as Python Decimal objects (or strings), and
the multiplication is not working.

Fix: when computing contract_value_v0 and working_value, explicitly
cast revised_scope and adjusted_rate to float before multiplying.
Use: float(item.revised_scope or 0) * float(item.adjusted_rate or 0)
Skip items where either revised_scope or adjusted_rate is None.

## Fix 2 — Items returning in wrong order (alphabetical not numerical)

Items are returning in alphabetical order by item_code, so "10.01"
comes before "1.01". 

Fix: after fetching items from DB, sort them in Python using a natural
sort key. Use this key function:

```python
import re

def natural_sort_key(item):
    # Split item_code into parts and convert numeric parts to int
    # e.g. "8f.41" -> ["8", 41] for correct ordering
    parts = re.split(r'(\d+)', item.item_code or '')
    return [int(p) if p.isdigit() else p.lower() for p in parts]
```

Apply this sort after fetching from DB and before applying
skip/limit pagination.

Do not change anything else. No other files modified.