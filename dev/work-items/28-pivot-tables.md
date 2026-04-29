# Work Item: Pivot Tables

## Status
- State: IN PROGRESS
- Priority: MEDIUM
- Branch: `issue-38-pivot-docs-tooling` (active), `issue-38-pivot-tables` (umbrella)
- Issue: https://github.com/Frank-Yong/MDXTab/issues/38

## Description
Add a `pivot_tables` frontmatter construct that renders a synthetic 2-D matrix
(rows × columns) sourced from an event table, where the column axis is derived
from another column or a date range and the cell value is an aggregate. This
removes the need to hand-author wide pivot tables, per-column `types` lists,
per-cell expressions, and per-month bookkeeping in user files.

## Background

### Current capabilities
- `tables` with `key`, `columns`, `types`, `computed`, `aggregates` (incl.
  `by` grouping), and `summary_rows`.
- `report_tables`: synthetic tables driven by `rows_from`, with statically
  declared `columns` and per-column `cells` expressions
  ([dev/work-items/21-synthetic-report-tables.md](21-synthetic-report-tables.md)).

### What's missing
A pivot/cross-tab is the natural shape for cash-flow forecasts, time tracking
by week, and similar matrices. Today every column on the column-axis must be
declared three times (in `columns`, in `types`, and in `cells`), every cell
expression must be hand-written, and the data has to be re-pivoted by hand
each period. Concretely, a 31-day liquidity forecast requires roughly:
- 31 entries in `columns`
- 31 entries in `types`
- 1 long `computed.summary` sum across 31 columns
- 31 expressions in `summary_rows.accumulated.cells`
- A 31-row hand-typed `date_index` table
- A wide markdown table re-typed every month

### Motivating user file
[Likviditet-2026.05.md](https://github.com/Frank-Yong/Personal/blob/main/Regnskap/Likviditet/2026/202605/Likviditet-2026.05.md)
(private repo): a monthly cash-flow forecast pivoted as `category × date`,
where the source data is a flat `likviditet_entries` table of
`(id, date, category, amount)`. The frontmatter is dominated by date-axis
boilerplate that should be generated from the source data and a date range.

### Key files (expected impact)
- `packages/core/src/types.ts` — frontmatter schema additions
- `packages/core/src/frontmatter.ts` — parse/validate `pivot_tables`
- `packages/core/src/document.ts` — evaluation phase + render injection
- `packages/core/src/dependency-graph.ts` — register pivots in eval order
- `packages/core/src/__tests__/` — integration tests
- `packages/vscode/syntaxes/`, snippets, schema command — optional follow-up

## Target layout

### Minimum viable pivot

```yaml
---
mdxtab: "1.0"
tables:
  likviditet_entries:
    key: id
    columns: [id, date, category, amount]
    types: { id: string, date: date, category: string, amount: number }
pivot_tables:
  likviditet:
    source: likviditet_entries
    rows:
      from: category                       # distinct values from source.category
    columns:
      from: date
      range: { start: 2026-04-24, end: 2026-05-24, step: day }
      label: short_month_day               # apr_24, may_01, ...
    value: sum(amount)                     # aggregator over matching events
    empty_cells: zero
    totals:
      row: summary                         # adds a per-row total column
      column:                              # adds a footer row
        accumulated:
          mode: running_sum                # = self[prev_col] + col_total
---

# Likviditet 25.04.2026-24.05.2026

## likviditet_entries

| id   | date       | category    | amount   |
|------|------------|-------------|----------|
| e001 | 2026-03-25 | Salary      | 51067.66 |
| ...  | ...        | ...         | ...      |

## likviditet
```

The `## likviditet` heading is the render target; the body is generated
synthetically (same model as `report_tables`).

### Optional knobs (deferred unless needed)
- `rows.from: <table>.<column>` — drive rows from a stable list (e.g.,
  `categories`) so empty rows still render in deterministic order.
- `rows.order: [Salary, Mortgage, ...]` — explicit row order.
- `value: <expr>` — full expression context (`row.<source_col>`,
  `column.<axis_value>`), defaulting to `sum(amount)`.
- `columns.from: <table>.<column>` — distinct values from another table.
- `columns.range.step: week | month` — coarser axes.
- Column-header formatting: `label: iso_date | short_month_day | <expr>`.

## Tasks

### 1. Design the `pivot_tables` frontmatter schema
- [x] Add `pivot_tables` to frontmatter types.
- [x] Required fields: `source`, `rows`, `columns`, `value`.
- [x] Optional fields: `empty_cells`, `totals`, `key`.
- [x] Validate name uniqueness against `tables` and `report_tables`.
- [x] Validate `source` references an authored table; `rows.from` and
      `columns.from` reference real columns or table.column paths.
- [x] Diagnostics for missing/invalid fields, unknown identifiers, unsupported
      `step`, invalid date ranges (`start > end`, non-ISO dates).

### 2. Define column-axis generation
- [x] Derive the ordered axis from either:
  - distinct source-column values (sorted deterministically), or
  - a `range` over `date` with `step`.
- [x] Generate stable header identifiers (must satisfy identifier rules so
      they can be referenced by `totals` and downstream lookups).
- [x] Surface header derivation in compile output for tooling.

### 3. Define row-axis generation
- [x] Derive the ordered row list from distinct source values, or from a
      referenced table column when `rows.from: <table>.<col>` is used.
- [x] Preserve declared order when sourced from a table; sort deterministically
      otherwise.

### 4. Evaluate pivot cells
- [x] For each (row, column) pair, evaluate `value` over the subset of
      `source` rows matching that row key and column-axis value.
- [x] Apply `empty_cells` policy when no events match.
- [x] Reuse the existing aggregate evaluator; no new functions required for
      MVP (`sum` only).
- [x] Define error behavior consistent with `report_tables` (missing source,
      type mismatch on axis values, etc.).

### 5. Totals
- [x] `totals.row: <name>` adds a synthesized trailing column equal to
      `sum` across the row's pivot cells.
- [x] `totals.column.<name>.mode: sum | running_sum` adds a footer row.
- [x] Names must satisfy identifier rules and not collide with axis headers.

### 6. Render injection
- [x] Detect `## <pivot_name>` headings and inject the rendered Markdown
      table (same mechanism as `report_tables`).
- [x] Preserve deterministic header and row order.
- [x] Source markdown remains unchanged; rendering occurs in preview/output
      and CLI `render` only.

### 7. Dependency graph & evaluation order
- [x] Register pivot tables after row evaluation and aggregates of the source
      table.
- [x] Detect cycles if a pivot is referenced from another pivot or report
      table (deferred: pivot output is not addressable in expressions in MVP).

### 8. Tests
- [x] Unit: axis generation (distinct values, date range, deterministic order).
- [x] Unit: cell evaluation with `empty_cells` policies.
- [x] Unit: row/column totals (including running sum).
- [x] Integration: full compile + render of a `category × date` pivot matching
      the motivating user file.
- [x] Diagnostics: missing source, invalid range, unknown columns, identifier
      collisions.

### 9. Docs & spec
- [x] Update `specs/formal-format-spec.md` with the `pivot_tables` schema and
      evaluation order entry.
- [x] Add `docs/format-overview.md` mention and a worked example under
      `dev/examples/`.

### 10. Tooling (follow-up, not blocking MVP)
- [ ] Snippets for `pivot_tables`.
- [ ] Schema-command output includes `pivot_tables`.
- [ ] Hover/completion in the VS Code extension.

## Sub-branch plan (4 PRs)

### 1) Schema + validation
- Branch: `issue-38-pivot-schema-validation`
- Scope: frontmatter shape, parser validation, and diagnostics.
- Includes tasks: 1
- Stretch in same PR if small: diagnostic tests from task 8.
- Progress: completed in commit `9252d56`.

### 2) Axes + cell evaluation + totals
- Branch: `issue-38-pivot-eval-core`
- Scope: row/column axis generation, cell aggregation, totals behavior.
- Includes tasks: 2, 3, 4, 5
- Tests in same PR: unit tests for axis/cell/totals from task 8.
- Progress: completed in commit `8e2fa0c`, merged into `issue-38-pivot-tables`.

### 3) Pipeline + rendering
- Branch: `issue-38-pivot-render-pipeline`
- PR: https://github.com/Frank-Yong/MDXTab/pull/41
- Scope: evaluation order integration, dependency graph hooks, heading-based
      render injection.
- Includes tasks: 6, 7
- Tests in same PR: compile/render integration coverage from task 8.
- Progress: merged into `issue-38-pivot-tables`.

### 4) Docs + examples + tooling polish
- Branch: `issue-38-pivot-docs-tooling`
- Scope: spec/docs updates, examples, optional VS Code/schema/snippet polish.
- Includes tasks: 9, 10

### Merge order
1. `issue-38-pivot-schema-validation`
2. `issue-38-pivot-eval-core`
3. `issue-38-pivot-render-pipeline`
4. `issue-38-pivot-docs-tooling`

### Notes
- Keep `issue-38-pivot-tables` as umbrella tracking branch only.
- Open each sub-branch PR against `issue-38-pivot-tables` for staged integration.

## Out of scope (v1 of this work item)
- Multiple aggregators per cell.
- Custom expressions referencing other pivot cells.
- Non-`sum` aggregators in the cell value (can be added without schema
  changes).
- Nested row/column axes (multi-level pivots).
- Editing the rendered pivot back into source data.

## Acceptance criteria
- A monthly liquidity file can drop the wide `likviditet` table, the
  `date_index` table, the per-day `types`, the long `computed.summary`, and
  the per-day `summary_rows.accumulated.cells` and still render the same
  category × date matrix with row totals and a running-sum footer.
- New month: only the `range` (and source events) needs to change.

## Alternatives considered
- **Multi-key grouped aggregates** (`sum(amount) by category, date`) plus a
  `report_tables` entry: still requires N hand-written cell expressions for
  N axis values; does not solve the "awful to recreate every month" problem.
- **Filtered aggregates** (`sum(amount where ...)`): same downside; also
  expands the expression language surface.
- **External pre-generation script**: rejected by user (out of scope for the
  authoring workflow).
