---
mdxtab: "1.0"
tables:
  expenses:
    key: category
    columns: [category, p1, p2, p3, p4, p5, row_total]
    empty_cells: zero
    types:
      p1: number
      p2: number
      p3: number
      p4: number
      p5: number
      row_total: number
    computed:
      row_total: p1 + p2 + p3 + p4 + p5
    summary_rows:
      running_balance:
        label: Running Balance
        cells:
          p1: sum(p1)
          p2: self.p1 + sum(p2)
          p3: self.p2 + sum(p3)
          p4: self.p3 + sum(p4)
          p5: self.p4 + sum(p5)
---

### Explanation
Matrix-style expense table with sparse period columns.
- `row_total` is computed per row.
- `running_balance` is a synthetic summary row evaluated left-to-right via `self.<col>`.

## expenses

| category    | p1   | p2   | p3   | p4 | p5   | row_total |
|-------------|------|------|------|----|------|-----------|
| Salary      | 1000 |      |      |    |      |           |
| Electricity |      | -100 |      |    |      |           |
| Mortgage    |      |      | -200 |    |      |           |
| Food        | -10  |      | -10  |    | -10  |           |

### Expected when preview settings are enabled
- Row totals: `1000`, `-100`, `-200`, `-30`
- Running Balance row: `990`, `890`, `680`, `680`, `670`
