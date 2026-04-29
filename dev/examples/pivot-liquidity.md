---
mdxtab: "1.0"
tables:
  entries:
    key: id
    columns: [id, date, category, amount]
    types:
      date: date
      amount: number
pivot_tables:
  liquidity:
    source: entries
    rows:
      from: category
      order: [Salary, Food, Rent]
    columns:
      from: date
      range:
        start: 2026-04-24
        end: 2026-04-26
        step: day
      label: short_month_day
    value: sum(amount)
    empty_cells: zero
    totals:
      row: total
      column:
        accumulated:
          mode: running_sum
---

### Explanation
Builds a synthetic liquidity matrix from event rows. Rows are categories, columns are daily dates, cells are sum(amount), row totals are enabled, and footer row accumulated is a running sum across column totals.

## entries

| id | date | category | amount |
|----|------|----------|--------|
| e1 | 2026-04-24 | Salary | 100 |
| e2 | 2026-04-25 | Salary | 50 |
| e3 | 2026-04-25 | Food | -30 |
| e4 | 2026-04-26 | Rent | -40 |

## liquidity

### Expected (rendered)
- Header contains apr_24, apr_25, apr_26, total.
- Salary row values are 100, 50, 0 with total 150.
- Food row values are 0, -30, 0 with total -30.
- Rent row values are 0, 0, -40 with total -40.
- Footer row accumulated is 100, 120, 80 with total 300.
