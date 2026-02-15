# Backlog

## Inline cell formulas (v2 candidate)
- Goal: allow formulas in Markdown table cells (e.g., cells starting with `=`) while keeping deterministic, column-named references.
- Scope:
  - Syntax: treat leading `=` cell content as a formula; plain cells remain data literals.
  - References: reuse column/aggregate names (no A1-style); forbid mixing data and formula in the same cell.
  - Parsing: extend Markdown extraction to detect formula cells, unescape, and feed through the existing lexer/parser.
  - Evaluation: integrate with dependency graph and cycle detection; formulas override raw cell values; emit cell-scoped diagnostics.
  - Interpolation: no change; aggregates/computed results flow through as today.
  - Edge cases: divide-by-zero, type errors, lookup misses, cycles across inline/computed columns.
- Effort: ~1–2 weeks after v1 core is stable.

## Time-based entries with grouped summaries
- Goal: support per-row time math (start - end - break = duration) and grouped summaries for common planning/ops use cases (timesheets, shifts, billing, utilization).
- Scope:
  - Inline time arithmetic in rows using existing expression syntax.
  - Grouped summaries by one or more dimensions (date, week, project, WBS, cost center).
  - Dimension keys live in the same row as the time entry.
- Example test (clear expected outcomes):
  - Input table columns: date, group, start, end, break, duration.
  - Computed column: duration = end - start - break.
  - Aggregates:
    - date_total = sum(duration) filtered by date.
    - period_total = sum(duration) filtered by week/month.
    - group_total = sum(duration) filtered by group key (e.g., WBS).
  - Expected:
    - Each row duration is correct (e.g., 9:00 - 17:30 - 0:30 = 8.0).
    - Date total equals sum of that date’s rows.
    - Period total equals sum of the period’s rows.
    - Group total equals sum of rows with matching group key.

## Built-in Markdown preview rendering
- Goal: render MDXTab interpolations in the built-in Markdown preview (similar to Mermaid), so users do not need a separate preview command.
- Scope:
  - Integrate a Markdown-It plugin via VS Code's Markdown preview extension API.
  - Replace aggregate interpolations (e.g., `{{ table.agg }}`) with computed values in preview output.
  - Keep editor text unchanged; only the preview output is transformed.
  - Provide a setting to enable/disable the feature.
  - Diagnostics behavior should match the current MDXTab preview (show errors when interpolation fails).
- Effort: ~2–4 days once extension API wiring is finalized.
