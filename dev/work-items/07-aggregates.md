# Work Item: Aggregates

## Status
- State: DONE

## Description
Evaluate aggregates after rows are finalized, using built-in functions only.

## Sub-items
- Implement `sum`, `avg`, `min`, `max`, `count`, `round`, `if` for aggregates.
- Ensure aggregates see computed columns and respect types/nulls.
- Tests: aggregates with nulls/empty cells, division-by-zero handling for `avg`/`round` edge cases.
