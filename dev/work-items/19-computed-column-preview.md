# Work Item: Preview rendering of computed columns

## Status
- State: IN PROGRESS
- Branch: `issue-12-computed-column-preview`
- Issue: https://github.com/Frank-Yong/MDXTab/issues/12

## Description
Render computed columns in the Markdown preview so per-row calculated values are
visible without modifying the source markdown. Currently, `compileMdxtab()` fully
evaluates computed columns and stores results in `CompileResult.tables[name].rows`,
but the `rendered` markdown string contains only the original source table columns.
The goal is to append computed column headers and cell values to each table in the
rendered output.

## Background

### Current pipeline (simplified)
1. Parse frontmatter → `TableFrontmatter` (includes `computed` definitions)
2. Parse markdown tables → `ParsedTable[]` (headers + rows from source)
3. Normalize and type-coerce cell values
4. `ensureComputed()` evaluates computed columns per row (mutates row objects)
5. `computeAggregate()` / `computeGroupedAggregate()` compute scalar summaries
6. `interpolateAggregates()` replaces `{{ table.agg }}` in body text
7. Return `{ tables, rendered }` — **`rendered` still has original table markdown**

### Key files
- `packages/core/src/document.ts` — `compileMdxtab()`, `interpolateAggregates()`, `ensureComputed()`
- `packages/core/src/markdown.ts` — `parseMarkdownTables()`, position metadata
- `packages/core/src/types.ts` — `CompileResult`, `TableEvaluation`, `ParsedTable`
- `packages/vscode/src/extension.ts` — Markdown-It plugin uses `result.rendered`

### Data available for rendering
Each `TableEvaluation.rows[i]` already contains the fully computed values:
```
{ id: "e1", date: "2026-02-17", start: "09:00", end: "17:30", break: "00:30", duration: 8 }
```
The `ParsedTable.headers` and `ParsedTable.rows` have position metadata (line, start, end)
that can be used to locate table boundaries in the source markdown.

## Tasks

### 1. Identify computed columns per table
- [ ] For each table in the frontmatter, determine which columns are in `computed`
  but NOT already present as authored header columns in the parsed markdown table.
- [ ] These are the columns to append.

### 2. Inject computed columns into rendered markdown
- [ ] After `interpolateAggregates()` produces the `renderedBody`, post-process the
  markdown to append computed column(s) to each table:
  - [ ] Add the computed column header(s) to the header row.
  - [ ] Add the corresponding separator dashes (`---`) to the separator row.
  - [ ] Add the evaluated cell value for each data row.
- [ ] Use the `ParsedTable` position info to precisely locate each table's header,
  separator, and data rows in the rendered string.
- [ ] Format numeric values sensibly (avoid excessive decimal places).

### 3. Handle edge cases
- [ ] Computed columns that fail to evaluate (type errors, divide-by-zero, lookup
  misses) should render as an empty cell or a short error marker (e.g., `#ERR`).
- [ ] Null computed values should render as an empty cell.
- [ ] Tables with no computed columns should pass through unchanged.
- [ ] Tables where the computed column name already appears in the authored headers
  should skip that column (it was authored manually).
- [ ] Preserve original table alignment and pipe formatting.

### 4. Add a VS Code setting to toggle the feature
- [ ] Add a new setting `mdxtab.preview.showComputedColumns` (default: `true`).
- [ ] When disabled, the preview renders tables exactly as authored (current behavior).
- [ ] Wire the setting in the Markdown-It plugin (`extendMarkdownIt`) and pass it
  through `CompileOptions`.

### 5. Update `CompileOptions` and `compileMdxtab` signature
- [ ] Add an `includeComputedColumns?: boolean` option to `CompileOptions`.
- [ ] When true, the `rendered` output includes computed columns in table markdown.
- [ ] When false (or omitted for backward compatibility), behavior is unchanged.

### 6. Write unit tests
- [ ] Test: table with one computed column → rendered output has extra column.
- [ ] Test: table with multiple computed columns → all appended in declaration order.
- [ ] Test: computed column that errors → renders `#ERR` or empty cell.
- [ ] Test: computed column with null value → renders empty cell.
- [ ] Test: no computed columns → rendered output unchanged.
- [ ] Test: computed column name matches an authored header → not duplicated.
- [ ] Test: `includeComputedColumns: false` → rendered output unchanged.
- [ ] Test: formatting of numeric values (e.g., `8.0` not `8.000000000000001`).

### 7. Manual smoke-test in VS Code
- [ ] Open a markdown file with computed columns (e.g., `dev/examples/time-entries.md`
  or `dev/examples/finance.md`).
- [ ] Verify preview shows the computed column with correct values.
- [ ] Toggle `mdxtab.preview.showComputedColumns` and verify column hides/shows.
- [ ] Verify diagnostics still work correctly.

### 8. Update documentation
- [ ] Add a note to the VS Code extension README about the computed column preview.
- [ ] Document the new `mdxtab.preview.showComputedColumns` setting.

## Acceptance criteria
- Computed columns appear in the Markdown preview with correct per-row values.
- Source markdown is never modified.
- Feature can be toggled off via VS Code settings.
- All existing tests continue to pass.
- New tests cover the core rendering logic.
