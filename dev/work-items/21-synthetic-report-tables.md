# Work Item: Synthetic Report Tables

## Status
- State: TODO
- Priority: HIGH
- Branch: `issue-30-synthetic-report-tables`
- Issue: https://github.com/Frank-Yong/MDXTab/issues/30

## Description
Add frontmatter-defined synthetic report tables that render as normal Markdown
tables in preview/output, so users can build derived reports like category
balances without hand-written HTML or manual row duplication.

## Background

### Current capabilities
- Computed columns: per-row expressions evaluated from other columns in the same
  row.
- Aggregates: scalar values such as `sum(amount)` and grouped aggregates such as
  `sum(amount) by category`.
- Summary rows: synthetic rows appended to authored Markdown tables.
- Computed-column and summary-row rendering in preview/output.

### What's missing
1. **Synthetic report tables** — there is no way to render a derived table whose
   rows come from one source table and whose cells combine row fields, grouped
   aggregates, and lookups.
2. **Keyed composition** — users can compute `opening_by_category[key]` and
   `total_by_category[key]`, but cannot combine them into `current[key]` in a
   rendered Markdown table without HTML or manual duplication.
3. **Report row generation** — users must currently hand-write HTML or repeated
   Markdown sections for report rows, even when a dictionary table already
   exists.

### Key files
- `packages/core/src/types.ts` — frontmatter and evaluation result types
- `packages/core/src/frontmatter.ts` — frontmatter parsing/validation
- `packages/core/src/document.ts` — compile pipeline, aggregate evaluation,
  interpolation, rendered output injection
- `packages/core/src/__tests__/document.spec.ts` — integration tests

### Target layout
Source document:

```md
---
mdxtab: "1.0"
tables:
  categories:
    key: id
    columns: [id, label]
  category_opening:
    key: category
    columns: [category, opening_balance]
    aggregates:
      opening_by_category: sum(opening_balance) by category
  transactions:
    key: id
    columns: [id, category, amount]
    aggregates:
      total_by_category: sum(amount) by category
report_tables:
  category_balances:
    rows_from: categories
    key: id
    columns: [label, opening, monthly_delta, current]
    cells:
      label: row.label
      opening: category_opening.opening_by_category[row.id]
      monthly_delta: transactions.total_by_category[row.id]
      current: category_opening.opening_by_category[row.id] + transactions.total_by_category[row.id]
---

## category_balances
```

Rendered output should become a normal Markdown table:

```md
| label       | opening | monthly_delta | current |
|-------------|---------|---------------|---------|
| Utilities   | 1234.38 | 71.5          | 1305.88 |
| Electricity | 740.63  | -139.37       | 601.26  |
```

## Tasks

### 1. Design the `report_tables` frontmatter schema
- [ ] Define a `report_tables` section in the frontmatter types.
- [ ] Each report table should declare at least:
  - `rows_from`
  - `columns`
  - `cells`
- [ ] Decide whether a separate `key` field is required or optional.
- [ ] Validate that report-table names are unique and do not conflict with
  authored table names.
- [ ] Emit clear diagnostics for missing required fields and invalid
  references.

### 2. Define report-table expression semantics
- [ ] Allow `row.<col>` access for the current source row.
- [ ] Allow grouped aggregate references such as
  `transactions.total_by_category[row.id]`.
- [ ] Decide whether standard table lookups should be allowed inside report
  cells.
- [ ] Ensure report-cell expressions use the existing deterministic expression
  language.
- [ ] Define error behavior for missing grouped keys and invalid row fields.

### 3. Evaluate report tables in the compile pipeline
- [ ] Add a post-aggregate evaluation phase for report tables.
- [ ] Generate report rows from the `rows_from` source table.
- [ ] Evaluate each configured report-table cell expression per generated row.
- [ ] Store evaluated report-table results in the compile result structure.

### 4. Render report tables into Markdown output
- [ ] Detect matching Markdown headings such as `## category_balances`.
- [ ] Replace or inject rendered Markdown table output for the report table.
- [ ] Keep source markdown unchanged; rendering should happen in preview/output.
- [ ] Preserve deterministic column order and row order from `rows_from`.

### 5. Add example documents
- [ ] Add or update an example document showing category balances without HTML.
- [ ] Demonstrate `opening`, `monthly_delta`, and `current`.
- [ ] Verify the example renders as a standard Markdown table.

### 6. Write tests
- [ ] Test successful report-table rendering from a dictionary/source table.
- [ ] Test grouped aggregate composition per generated row.
- [ ] Test `current = opening + monthly_delta` for a bookkeeping example.
- [ ] Test invalid `rows_from` table.
- [ ] Test invalid `row.<col>` reference.
- [ ] Test invalid grouped aggregate reference/key.
- [ ] Test behavior when a matching report heading is absent.
- [ ] Test that authored tables continue to work unchanged.

### 7. Documentation
- [ ] Document `report_tables` in the README/spec docs.
- [ ] Explain when to use report tables vs summary rows vs grouped aggregates.
- [ ] Include a migration note for users currently relying on HTML report
  tables.

## Acceptance criteria
- [ ] `report_tables` can be declared in frontmatter and validated.
- [ ] Matching report headings render as standard Markdown tables in
  preview/output.
- [ ] Report cells can reference source-row fields and grouped aggregate values.
- [ ] The bookkeeping example `current = opening + monthly_delta` renders the
  correct values per category.
- [ ] Users no longer need HTML tables for category-balance style reports.
- [ ] Diagnostics clearly identify invalid report-table definitions or cells.