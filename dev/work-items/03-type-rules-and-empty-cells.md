# Work Item: Type rules and empty-cell policy

## Status
- State: DONE

## Description
Enforce type validation and safe coercions; apply empty-cell handling consistently.

## Sub-items
- Implement allowed coercions (string→number/bool/date) and reject others.
- Apply `empty_cells` options: null (default), zero, empty-string, error.
- Add tests for each policy and type edge case.
