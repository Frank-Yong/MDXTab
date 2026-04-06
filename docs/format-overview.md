# Format Overview

MDXTab keeps raw data in markdown tables and logic in YAML frontmatter.

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

- tables: named datasets with stable keys
- columns: allowed fields per table
- computed: per-row expressions
- aggregates: table-wide results like `sum`, `avg`, `min`, `max`, `count`
- report_tables: synthetic output tables built from source tables

## Design rule

Keep formulas in frontmatter and keep markdown tables as data only.

## Next

- [CLI Usage](cli-usage.md)
- [VS Code Extension](vscode-extension.md)
