---
mdxtab: "1.0"
tables:
  roles:
    key: id
    columns: [id, title, monthly_base]
    types:
      monthly_base: number
  hires:
    key: id
    columns: [id, role_id, start_month, fte]
    types:
      fte: number
      start_month: string
    computed:
      monthly_cost: round(fte * roles[role_id].monthly_base, 2)
    aggregates:
      total_monthly: sum(monthly_cost)
---

## roles

| id | title    | monthly_base |
|----|----------|--------------|
| se | Engineer | 12000        |
| pm | PM       | 11000        |

## hires

| id | role_id | start_month | fte |
|----|---------|-------------|-----|
| h1 | se      | 2026-03     | 1.0 |
| h2 | se      | 2026-04     | 0.5 |
| h3 | pm      | 2026-03     | 1.0 |

### Summary (rendered)
- Total monthly: {{ hires.total_monthly }}

### Expected
- monthly_cost: 12000.00, 6000.00, 11000.00
- total_monthly: 29000.00
- Lookup failure if role_id is missing should raise E_LOOKUP (no silent null).
