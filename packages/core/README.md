# @mdxtab/core

Core parsing and evaluation library for MDXTab. This package will house frontmatter parsing, Markdown table extraction, expression lexing/parsing, dependency ordering, and row/aggregate evaluation.

## Status
Scaffolding only. Implementations are TODO; semantics must follow the Phase 0 formal and technical specs (numeric/null rules, rounding, identifiers, header trimming for column matching, data cell preservation, interpolation constraints).

## Development
- Build: `npm run -w @mdxtab/core build`
- Tests: `npm run -w @mdxtab/core test`

Work items in `dev/work-items` map to modules:
- 02: frontmatter + Markdown parsing
- 04: expression lexer and parser
- 05: dependency graph and cycles
- 06: row evaluation
