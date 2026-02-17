# Backlog

## Inline cell formulas (rejected for v1)
- Decision: reject inline formulas because they conflict with the deterministic, frontmatter-only logic model.
- Reconsider later only as an explicit, opt-in experimental mode with strict constraints and clear diagnostics.
- Original scope (retained for reference):
  - Syntax: treat leading `=` cell content as a formula; plain cells remain data literals.
  - References: reuse column/aggregate names (no A1-style); forbid mixing data and formula in the same cell.
  - Parsing: extend Markdown extraction to detect formula cells, unescape, and feed through the existing lexer/parser.
  - Evaluation: integrate with dependency graph and cycle detection; formulas override raw cell values; emit cell-scoped diagnostics.
  - Interpolation: no change; aggregates/computed results flow through as today.
  - Edge cases: divide-by-zero, type errors, lookup misses, cycles across inline/computed columns.
- Effort (original estimate): ~1–2 weeks after v1 core is stable.

## Time calculations with grouped summaries
- Goal: support per-row time math (start - end - break = duration) and grouped summaries for common planning/ops use cases (timesheets, shifts, billing, utilization).
- Scope:
  - Time arithmetic via computed columns in frontmatter (no inline formulas in row cells).
  - Parse time literals like "9:30" into hours (e.g., 1:30 -> 1.5) via a built-in helper or type coercion.
  - Grouped summaries by one or more dimensions (date, week, project, WBS, cost center).
  - Dimension keys live in the same row as the time entry.
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
    - Date total equals sum of that date’s rows.
    - Period total equals sum of the period’s rows.
    - Group total equals sum of rows with matching group key.

## Preview rendering of computed columns
- Goal: render computed columns in preview/output tables so per-row values are visible without modifying source markdown.
- Scope:
  - Append computed columns to the rendered table output (preview/export only).
  - Keep source markdown unchanged; computed values are derived from the same inputs.
  - Surface diagnostics when computed values fail to evaluate (type errors, lookup misses).
  - Optional setting to enable/disable rendered computed columns.

## Built-in Markdown preview rendering (DONE)
- Implemented via Markdown-It integration in the VS Code extension.
- Original scope (retained for reference):
  - Integrate a Markdown-It plugin via VS Code's Markdown preview extension API.
  - Replace aggregate interpolations (e.g., `{{ table.agg }}`) with computed values in preview output.
  - Keep editor text unchanged; only the preview output is transformed.
  - Provide a setting to enable/disable the feature.
  - Diagnostics behavior should match the current MDXTab preview (show errors when interpolation fails).
- Effort (original estimate): ~2–4 days once extension API wiring is finalized.
