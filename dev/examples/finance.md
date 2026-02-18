---
mdxtab: "1.0"
tables:
  expenses:
    key: id
    columns: [id, category, net]
    types:
      net: number
      tax: number
      gross: number
    computed:
      tax: round(net * 0.25, 2)
      gross: round(net + tax, 2)
    aggregates:
      net_total: sum(net)
      tax_total: sum(tax)
      gross_total: sum(gross)
---

### Explanation
Computes per-row tax and gross, then aggregates totals. Calculation: tax = round(net * 0.25, 2); gross = round(net + tax, 2); net_total = sum(net), tax_total = sum(tax), gross_total = sum(gross).

## expenses

| id | category | net |
|----|----------|-----|
| h1 | Hosting  | 100 |
| a1 | Ads      | 200 |
| s1 | Support  | 150 |

### Totals
- Net: {{ expenses.net_total }}
- Tax: {{ expenses.tax_total }}
- Gross: {{ expenses.gross_total }}

### Expected
- Row tax: 25.00, 50.00, 37.50
- Row gross: 125.00, 250.00, 187.50
- Aggregates: net_total=450, tax_total=112.5, gross_total=562.5
- Interpolation renders those numeric values as strings without extra rounding.
