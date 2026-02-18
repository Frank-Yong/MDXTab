# Backlog

## Inline cell formulas (rejected for v1)
### Summary
Rejected because inline formulas conflict with the deterministic, frontmatter-only logic model.

### Proposed solution
Reconsider later only as an explicit, opt-in experimental mode with strict constraints and clear diagnostics.

### Alternatives considered
- Keep formulas only in frontmatter (current model).

### Additional context
- Original scope (retained for reference):
  - Syntax: treat leading `=` cell content as a formula; plain cells remain data literals.
  - References: reuse column/aggregate names (no A1-style); forbid mixing data and formula in the same cell.
  - Parsing: extend Markdown extraction to detect formula cells, unescape, and feed through the existing lexer/parser.
  - Evaluation: integrate with dependency graph and cycle detection; formulas override raw cell values; emit cell-scoped diagnostics.
  - Interpolation: no change; aggregates/computed results flow through as today.
  - Edge cases: divide-by-zero, type errors, lookup misses, cycles across inline/computed columns.
- Effort (original estimate): ~1-2 weeks after v1 core is stable.

## Time calculations with grouped summaries
### Summary
Support per-row time math (start - end - break = duration) and grouped summaries for planning/ops use cases.

Links: dev/work-items/18-time-calculations-grouped-summaries.md, https://github.com/Frank-Yong/MDXTab/issues/11

### Proposed solution
- Time arithmetic via computed columns in frontmatter (no inline formulas in row cells).
- Parse time literals like "9:30" into hours (e.g., 1:30 -> 1.5) via a built-in helper or type coercion.
- Grouped summaries by one or more dimensions (date, week, project, WBS, cost center).
- Dimension keys live in the same row as the time entry.

### Alternatives considered
- Store durations as precomputed data (no time parsing).

### Additional context
- Example test (clear expected outcomes):
  - Input table columns: date, group, start, end, break, duration.
  - Computed column: duration = end - start - break (with hh:mm parsing).
  - Example snippet:
    ```md
    ---
    mdxtab: "1.0"
    tables:
      time_entries:
        columns: [id, date, start, end, break, duration]
        types:
          start: time
          end: time
          break: time
        computed:
          duration: hours(end) - hours(start) - hours(break)
        aggregates:
          total_hours: sum(duration)
    ---

    ## time_entries
    | id | date       | start | end  | break |
    |----|------------|-------|------|-------|
    | e1 | 2026-02-17 | 09:00 | 17:30| 00:30 |
    ```
  - Aggregates:
    - date_total = sum(duration) filtered by date.
    - period_total = sum(duration) filtered by week/month.
    - group_total = sum(duration) filtered by group key (e.g., WBS).
  - Expected:
    - Each row duration is correct (e.g., 9:00 - 17:30 - 0:30 = 8.0).
    - Date total equals sum of that date's rows.
    - Period total equals sum of the period's rows.
    - Group total equals sum of rows with matching group key.

  ## Generalized time units and formats
  ### Summary
  Support minutes, hours, and days with multiple input formats beyond HH:MM.

  ### Proposed solution
  - Add helpers like minutes("90"), hours("1.5"), and days("1.25").
  - Accept compact duration strings (e.g., "1h 30m") in a deterministic parser.
  - Define strict, locale-agnostic parsing rules and validation errors.

  ### Alternatives considered
  - Keep only HH:MM parsing and decimal hours.

  ### Additional context
  - Defer to a follow-on after time calculations with grouped summaries is stable.

## Preview rendering of computed columns
### Summary
Render computed columns in preview/output tables so per-row values are visible without modifying source markdown.

### Proposed solution
- Append computed columns to the rendered table output (preview/export only).
- Keep source markdown unchanged; computed values are derived from the same inputs.
- Surface diagnostics when computed values fail to evaluate (type errors, lookup misses).
- Optional setting to enable/disable rendered computed columns.

### Alternatives considered
- Keep computed values summary-only (current behavior).

## Reusable table schemas
### Summary
Allow multiple tables to reuse a shared schema definition to avoid duplicate YAML.

### Proposed solution
- Add a `schemas` section in frontmatter for reusable definitions.
- Allow tables to reference a schema via `schema: <name>`.
- Support optional overrides for columns, types, computed, and aggregates.

### Alternatives considered
- Keep duplicate table definitions (status quo).

### Additional context
- Example:
  ```md
  ---
  mdxtab: "1.0"
  schemas:
    time_entry:
      columns: [id, project, start, end, break, duration]
      types:
        start: time
        end: time
        break: time
        duration: number
      computed:
        duration: hours(end) - hours(start) - hours(break)
  tables:
    monday:
      schema: time_entry
    tuesday:
      schema: time_entry
  ---
  ```

## Built-in Markdown preview rendering (DONE)
### Summary
Implemented via Markdown-It integration in the VS Code extension.

### Proposed solution
- Integrate a Markdown-It plugin via VS Code's Markdown preview extension API.
- Replace aggregate interpolations (e.g., `{{ table.agg }}`) with computed values in preview output.
- Keep editor text unchanged; only the preview output is transformed.
- Provide a setting to enable/disable the feature.
- Diagnostics behavior should match the current MDXTab preview (show errors when interpolation fails).

### Additional context
- Effort (original estimate): ~2-4 days once extension API wiring is finalized.
