# Work Item: Row evaluation

## Status
- State: DONE

## Description
Evaluate computed columns per row using the dependency order and lookup rules.

## Sub-items
- Resolve `row.col` and bare column references within the same row.
- Support cross-table lookups `table[key].col`; fail on missing rows/columns.
- Apply types and empty-cell policy before evaluation; enforce null arithmetic semantics and divide-by-zero erroring.
- Respect aggregate skip-null rules when later consumed; row eval should still produce nulls for null arithmetic.
- Tests: numeric math, boolean logic, lookup success/failure, null arithmetic propagation, divide-by-zero.
