# Work Item: Expenses 2D Sheet

## Status
- State: IN PROGRESS
- Branch: `issue-21-expenses-2d-sheet`
- Issue: https://github.com/Frank-Yong/MDXTab/issues/21

## Description
Support a matrix-style expenses sheet where rows are categories (Salary,
Electricity, …) and columns are periods (1, 2, 3, …). The table needs:
- per-row totals (`Row Total` computed column),
- per-column summaries (column sums), and
- a **Running Balance** summary row where each period cell is the cumulative sum
  of all data rows up to and including that period.

All formulas live in frontmatter; no inline cell formulas.

## Background

### Current capabilities
- Computed columns: per-row expressions evaluated from other columns in the same
  row (e.g., `duration: hours(end) - hours(start)`).
- Aggregates: `sum`, `avg`, `min`, `max`, `count` over a single column, with
  optional `… by <group>` grouping.
- Computed-column preview rendering (v0.3.0): appends/fills computed column
  values into the rendered markdown.

### What's missing
1. **Summary rows** — synthetic rows appended to a table that aggregate across
   all data rows. Current aggregates produce scalar values interpolated into body
   text (`{{ table.agg }}`), not table rows.
2. **Running (cumulative) aggregation** — each period cell in the summary row
   depends on the previous period's summary cell, which is not expressible in
   the current row-major computed-column model.
3. **Multi-column sweep** — a helper that iterates over a declared list of
   columns in order, producing one output cell per column in a single summary
   row.

### Key files
- `packages/core/src/types.ts` — `TableFrontmatter`, `CompileOptions`, `CompileResult`
- `packages/core/src/document.ts` — `compileMdxtab()`, `injectComputedColumns()`, pipeline
- `packages/core/src/evaluator.ts` — expression evaluation, `ensureComputed()`
- `packages/core/src/frontmatter.ts` — frontmatter parsing/validation
- `packages/core/src/markdown.ts` — `parseMarkdownTables()`, position metadata
- `packages/core/src/__tests__/document.spec.ts` — integration tests

### Target layout
```
| #               | 1    | 2    | 3    | 4   | 5   | Row Total |
| -               | -    | -    | -    | -   | -   | -         |
| Salary          | 1000 |      |      |     |     | 1000      |
| Electricity     |      | -100 |      |     |     | -100      |
| Mortgage        |      |      | -200 |     |     | -200      |
| Food            | -10  |      | -10  |     | -10 | -30       |
| Running Balance | 990  | 890  | 680  | 680 | 670 |           |
```

### Design decision
See [RFC-0002](../../specs/RFC-0002.md) — **Cells-as-Expressions with `self` references**.
Each summary row cell is an arbitrary expression evaluated left-to-right.
Cells may reference earlier cells in the same summary row via `self.<col>`.

### Example frontmatter
```yaml
mdxtab: "1.0"
tables:
  expenses:
    columns: [category, p1, p2, p3, p4, p5, row_total]
    types:
      p1: number
      p2: number
      p3: number
      p4: number
      p5: number
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
```

## Tasks

### 1. Design the `summary_rows` frontmatter schema
- [x] Define the YAML shape for `summary_rows` in `TableFrontmatter`.
- [x] Each summary row has: a key (id), a `label` (required string for the
  first column), and a `cells` map (column name → expression string).
- [x] Validate in `parseFrontmatter()`: `label` is required, `cells` keys must
  reference declared columns, expression strings must parse successfully.
- [x] Emit clear diagnostics for invalid summary row definitions.

### 2. Evaluate summary rows
- [x] After `ensureComputed()` and aggregate computation, evaluate each summary
  row definition.
- [x] Evaluate cells in **declaration order** (YAML key order, left to right).
- [x] Resolve `self.<col>` to the already-evaluated value of that column in
  the same summary row. Forward references are an error.
- [x] Aggregate functions (`sum`, `avg`, etc.) operate over data rows only.
- [x] Store results in `TableEvaluation` (new field, e.g., `summaryRows`).
- [x] Handle nulls: treat null/empty data cells as 0 for numeric aggregation.

### 3. Inject summary rows into rendered markdown
- [x] Extend `injectComputedColumns()` (or add a new `injectSummaryRows()`)
  to append synthetic rows at the bottom of each table.
- [x] Format: `| <label> | <val1> | <val2> | … |` matching the table's column
  count and alignment.
- [x] Summary row cells for columns not in the summary's `columns` list render
  as empty.
- [x] Respect `includeComputedColumns` — if off, skip summary row injection.

### 4. Add a VS Code setting (optional, or reuse existing)
- [x] Decide whether summary rows follow `showComputedColumns` or need their
  own toggle (e.g., `mdxtab.preview.showSummaryRows`).
- [x] Wire the setting through `CompileOptions`.

### 5. Create an example document
- [x] Create `dev/examples/expenses.md` with the target layout.
- [x] Include frontmatter with `summary_rows` and `computed` (row_total).
- [x] Verify it renders correctly in preview.

### 6. Write unit tests
- [ ] Test: summary row with cumulative `self` references (running balance).
- [ ] Test: summary row with simple `sum()` per column (totals row).
- [ ] Test: null/empty data cells treated as 0.
- [ ] Test: summary row coexists with computed `row_total` column.
- [ ] Test: forward `self` reference → diagnostic emitted.
- [ ] Test: invalid summary row definition (missing label, bad column) → diagnostic.
- [ ] Test: no summary rows defined → behavior unchanged.
- [ ] Test: summary row toggle off → no synthetic rows in output.
- [ ] Test: multiple summary rows render in declaration order.

### 7. Manual smoke-test in VS Code
- [ ] Open `dev/examples/expenses.md` in VS Code.
- [ ] Verify the Running Balance row appears with correct cumulative values.
- [ ] Verify Row Total computed column works alongside summary rows.
- [ ] Toggle settings and verify behavior.

### 8. Update documentation
- [ ] Document `summary_rows` in the extension README or a usage guide.
- [ ] Add the new frontmatter keys to any schema/spec docs.

## Acceptance criteria
- [ ] `summary_rows` frontmatter schema is parsed, validated, and produces
  diagnostics on errors.
- [ ] `running_sum` and `sum` summary formulas evaluate correctly.
- [ ] Summary rows appear in the rendered markdown preview as the last row(s)
  of the table.
- [ ] Computed columns (e.g., `row_total`) and summary rows coexist correctly.
- [ ] All existing tests continue to pass.
- [ ] New tests cover the scenarios listed in Task 6.
- [ ] Example file `dev/examples/expenses.md` demonstrates the feature.
