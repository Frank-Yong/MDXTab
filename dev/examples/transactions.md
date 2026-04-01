---
mdxtab: "1.0"
tables:
  categories:
    key: id
    columns: [id, label]
    types:
      id: string
      label: string
  category_opening:
    key: category
    columns: [category, opening_balance]
    types:
      category: string
      opening_balance: number
    computed:
      category_guard: categories[category].id
    aggregates:
      opening_total: sum(opening_balance)
      opening_by_category: sum(opening_balance) by category
  transactions:
    key: id
    columns: [id, date, period, description, category, amount]
    empty_cells: "null"
    types:
      id: string
      date: date
      period: string
      description: string
      category: string
      amount: number
    computed:
      category_guard: categories[category].id
    aggregates:
      total_amount: sum(amount)
      avg_amount: avg(amount)
      tx_count: count(amount)
      total_by_category: sum(amount) by category
      total_by_period: sum(amount) by period
  category_closing:
    key: category
    columns: [category, closing_balance]
    types:
      category: string
      closing_balance: number
    computed:
      category_guard: categories[category].id
    aggregates:
      closing_total: sum(closing_balance)
      closing_by_category: sum(closing_balance) by category
report_tables:
  category_balances:
    rows_from: categories
    key: id
    columns: [category, opening, monthly_delta, closing]
    cells:
      category: row.label
      opening: category_opening.opening_by_category[row.id]
      monthly_delta: transactions.total_by_category[row.id]
      closing: category_closing.closing_by_category[row.id]
---

# Transactions (Non-Excel Pattern)

Keep raw events in the table. Put all totals and analysis in separate sections below.

## categories

| id            | label         |
|---------------|---------------|
| Income        | Income        |
| Housing       | Housing       |
| Food          | Food          |
| Transport     | Transport     |
| Utilities     | Utilities     |
| Entertainment | Entertainment |
| Savings       | Savings       |

## transactions

| id   | date       | period  | description         | category      | amount |
|------|------------|---------|---------------------|---------------|--------|
| t001 | 2026-03-01 | 2026-03 | Salary              | Income        | 4200   |
| t002 | 2026-03-02 | 2026-03 | Rent                | Housing       | -1700  |
| t003 | 2026-03-03 | 2026-03 | Groceries           | Food          | -140   |
| t004 | 2026-03-04 | 2026-03 | Train pass          | Transport     | -75    |
| t005 | 2026-03-05 | 2026-03 | Coffee              | Food          | -9     |
| t006 | 2026-03-06 | 2026-03 | Internet bill       | Utilities     | -55    |
| t007 | 2026-03-08 | 2026-03 | Freelance invoice   | Income        | 600    |
| t008 | 2026-03-09 | 2026-03 | Movie tickets       | Entertainment | -36    |
| t009 | 2026-03-11 | 2026-03 | Electricity bill    | Utilities     | -98    |
| t010 | 2026-03-12 | 2026-03 | Savings transfer    | Savings       | -800   |

## category_opening

| category      | opening_balance |
|---------------|-----------------|
| Income        | 1200            |
| Housing       | -200            |
| Food          | 100             |
| Transport     | 40              |
| Utilities     | 20              |
| Entertainment | 0               |
| Savings       | 500             |

## category_closing

| category      | closing_balance |
|---------------|-----------------|
| Income        | 6000            |
| Housing       | -1900           |
| Food          | -49             |
| Transport     | -35             |
| Utilities     | -133            |
| Entertainment | -36             |
| Savings       | -300            |

## KPI summary

- Transaction count: {{ transactions.tx_count }}
- Average transaction amount: {{ transactions.avg_amount }}
- Net total: {{ transactions.total_amount }}

## Breakdown by category

- Income: {{ transactions.total_by_category[Income] }}
- Housing: {{ transactions.total_by_category[Housing] }}
- Food: {{ transactions.total_by_category[Food] }}
- Transport: {{ transactions.total_by_category[Transport] }}
- Utilities: {{ transactions.total_by_category[Utilities] }}
- Entertainment: {{ transactions.total_by_category[Entertainment] }}
- Savings: {{ transactions.total_by_category[Savings] }}

## Breakdown by period

- 2026-03: {{ transactions.total_by_period["2026-03"] }}

## category_balances

### Reconciliation checks

- Opening total: {{ category_opening.opening_total }}
- Monthly net change: {{ transactions.total_amount }}
- Closing total: {{ category_closing.closing_total }}

## Notes

- This style keeps the table as raw input and avoids synthetic summary rows in table data.
- Add new report sections by reusing aggregates and `report_tables`, instead of changing table structure or writing HTML.
- Category typo guards in `transactions`, `category_opening`, and `category_closing` raise `E_LOOKUP` if a category is not declared in `categories`.
- For monthly rollover, copy `closing_balance` into next month's `category_opening`.
