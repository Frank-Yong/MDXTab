# @mdxtab/core

Core parsing and evaluation library for MDXTab. This package includes frontmatter parsing, Markdown table extraction, expression lexing/parsing, dependency ordering, and row/aggregate evaluation.

## Status
Implemented (WIP). Core compilation, evaluation, and tests are in place; semantics follow the Phase 0 formal and technical specs. Remaining gaps are tracked in `dev/work-items`, including:
- Markdown-aware interpolation edge cases (code spans/blocks and other Markdown constructs)
- Spec coverage that is still in flight across later Phase 0 items

## Development
- Build: `npm run -w @mdxtab/core build`
- Tests: `npm run -w @mdxtab/core test`

Work items in `dev/work-items` map to modules:
- 02: frontmatter + Markdown parsing
- 04: expression lexer and parser
- 05: dependency graph and cycles
- 06: row evaluation
