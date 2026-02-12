# Work Item: Spec lock and golden examples

## Description
Freeze v1 rules and provide canonical examples with expected outputs and errors.

## Sub-items
- Finalize empty-cell policy, type coercion, numeric rounding, and lookup failure rules.
- Add 2–3 sample MDXTab docs (finance, planning, docs-with-math).
- Record expected computed columns, aggregates, and interpolation results.
- Add error cases (missing columns, bad types, cycles) with expected messages.

## Canonical examples (to be checked into `dev/examples/`)

### Finance (expenses)
```
---
mdxtab: 1.0
tables:
	expenses:
		key: id
		columns: [id, category, net, tax, gross]
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

## Expenses

| id | category | net |
|----|----------|-----|
| h1 | Hosting  | 100 |
| a1 | Ads      | 200 |
| s1 | Support  | 150 |

### Totals
- Net: {{ expenses.net_total }}
- Tax: {{ expenses.tax_total }}
- Gross: {{ expenses.gross_total }}
```

Expected:
- Row tax: 25.00, 50.00, 37.50
- Row gross: 125.00, 250.00, 187.50
- Aggregates: net_total=450, tax_total=112.5, gross_total=562.5
- Interpolation renders those numeric values as strings (no extra rounding).

### Planning (headcount + payroll)
```
---
mdxtab: 1.0
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

## Roles

| id | title       | monthly_base |
|----|-------------|--------------|
| se | Engineer    | 12000        |
| pm | PM          | 11000        |

## Hires

| id | role_id | start_month | fte |
|----|---------|-------------|-----|
| h1 | se      | 2026-03     | 1.0 |
| h2 | se      | 2026-04     | 0.5 |
| h3 | pm      | 2026-03     | 1.0 |
```

Expected:
- monthly_cost: 12000.00, 6000.00, 11000.00
- total_monthly: 29000.00
- Lookup failure if role_id missing (see error cases).

### Docs-with-math (interpolation skips code spans)
```
---
mdxtab: 1.0
tables:
	sample:
		columns: [id, value]
		types:
			value: number
		aggregates:
			total: sum(value)
---

| id | value |
|----|-------|
| a  | 1.5   |
| b  | 2.25  |

Narrative uses {{ sample.total }} outside code.

`Inline code with {{ sample.total }} stays literal.`
```

Expected:
- total = 3.75
- Only the narrative line interpolates; code span remains unchanged.

## Error cases (with expected diagnostics)
- Missing column in frontmatter `columns` vs header row: error code `E_COLUMN_MISMATCH`, message references table name and offending header.
- Bad type coercion (non-number in numeric column) during eval: `E_TYPE`, referencing column and row id.
- Divide-by-zero: `E_DIV_ZERO` when evaluating `/` with zero divisor.
- Cycle between computed columns: `E_CYCLE` listing involved columns.
- Lookup miss `roles[bad].col`: `E_LOOKUP` with table/key detail; null does not silently propagate.
- Aggregate argument not a bare column (e.g., `sum(net + 1)`): `E_AGG_ARGUMENT` in aggregate context.
