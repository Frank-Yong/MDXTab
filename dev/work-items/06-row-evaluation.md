# Work Item: Row evaluation

## Description
Evaluate computed columns per row using the dependency order and lookup rules.

## Sub-items
- Resolve `row.col` and bare column references within the same row.
- Support cross-table lookups `table[key].col`; fail on missing rows/columns.
- Apply types and empty-cell policy before evaluation.
- Tests: numeric math, boolean logic, lookup success/failure.
