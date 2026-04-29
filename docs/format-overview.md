# Format Overview

MDXTab keeps raw data in markdown tables and logic in YAML frontmatter.

## Mental model

- Markdown tables hold source data.
- Frontmatter defines schema and formulas.
- Render/validate evaluates formulas and outputs diagnostics.

## File shape

```md
---
mdxtab: "1.0"
tables:
  expenses:
    key: id
    columns: [id, category, net]
    computed:
      tax: net * 0.25
    aggregates:
      total_net: sum(net)
---

## expenses
| id | category | net |
|----|----------|-----|
| a1 | Ads      | 200 |
```

## Key concepts

- `tables`: named datasets with stable keys
- `columns`: allowed fields per table
- `types`: optional type hints (`number`, `string`, `bool`, `date`, `time`)
- `computed`: per-row expressions
- `aggregates`: table-wide results (`sum`, `avg`, `min`, `max`, `count`)
- `summary_rows`: synthetic footer-style rows
- `report_tables`: synthetic derived tables rendered at matching headings
- `pivot_tables`: synthetic matrix tables rendered at matching headings

## Common expression inputs

- `row.<column>` for current row values
- aggregate functions like `sum(net)`
- lookup paths like `transactions.total_by_category[row.id]`

## Pivot tables

- Use `pivot_tables` when you need a matrix layout such as `category x date`.
- Define `source`, `rows.from`, `columns.from`, and `value`.
- Optional `columns.range` generates a deterministic date axis (`day`, `week`, `month`).
- Optional `totals` adds row-total and footer rows.

## Design rule

Keep formulas in frontmatter and keep markdown tables as data only.

## Example files

- `dev/examples/expenses.md`
- `dev/examples/time-entries.md`
- `dev/examples/grouped-aggregates.md`
- `dev/examples/transactions.md`
- `dev/examples/pivot-liquidity.md`

## Next

- [CLI Usage](cli-usage.md)
- [VS Code Extension](vscode-extension.md)
