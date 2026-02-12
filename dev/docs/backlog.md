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
