# Work Item: Phase 2 VS Code Extension

## Status
- State: IN REVIEW
- Focus: VS Code authoring experience (diagnostics, preview, editor features).

## Objectives
- Ship diagnostics, preview, and editor affordances for MDXTab in VS Code.
- Keep the extension thin and rely on core for validation/evaluation.
- Prefer deterministic diagnostics for reliable editor behavior.

## Immediate steps
1) Document symbols / outline for tables, columns, computed columns, aggregates.
2) Hovers for column types and computed/aggregate expressions.
3) Completions + navigation for tables, columns, aggregates, functions.
4) Incremental parsing/performance tuning on save.
5) Diagnostics UX polish (multiple errors, tighter ranges).

## Linked work items
- 09: diagnostics surface
- 11: VS Code diagnostics loop
- 12: completions and navigation
- 13: quick fixes and snippets
