# MDXTab Development Plan (VS Code Extension)

## Language and Stack

- Primary language: TypeScript
- Architecture: monorepo with a reusable core library and a thin VS Code extension
- Parsing: YAML frontmatter + Markdown table extractor + custom expression parser

## Phase 0: Spec Lock and Examples (1-2 weeks)

- Freeze v1 semantics:
  - Empty cell handling
  - Type coercion matrix
  - Null behavior in aggregates
  - Lookup failure behavior
- Add canonical examples with expected outputs
- Define golden test vectors (inputs + outputs + errors)

## Phase 1: Core Engine (2-4 weeks)

- Status: in progress on branch `phase-1-core-engine`; initial focus is on parsing and evaluation primitives.
- Create packages/core:
  - Frontmatter parser (see work item 02)
  - Markdown table extractor (see work item 02)
  - Expression lexer + Pratt parser (see work item 04)
  - AST evaluator for row-level formulas (see work item 06)
  - Dependency graph and cycle detection (see work item 05)
  - Type validation + coercion rules (tie into evaluator and parser)
- Add unit tests for grammar, evaluation, and error cases; prioritize golden vectors from Phase 0.
- Immediate kickoff steps:
  1) Stub `packages/core` with parsing/eval modules and test harness.
  2) Implement frontmatter + Markdown extraction with header trimming and data preservation rules.
  3) Build lexer + Pratt parser with coverage for success and syntax errors.
  4) Wire dependency ordering + row evaluator; cover lookup and null/numeric edge cases.

## Phase 2: VS Code Extension (2-3 weeks)

- Implement diagnostics:
  - Schema errors
  - Circular dependencies
  - Invalid references and lookups
- Add document symbols for tables, columns, aggregates
- Add hover info for computed columns and aggregates
- Optimize incremental parsing on save

## Phase 3: Developer Experience (2-3 weeks)

- Syntax highlighting (TextMate grammar)
- Autocomplete for functions, columns, aggregates
- Quick fixes for common errors

## Phase 4: CLI and CI (optional, 2-3 weeks)

- CLI commands:
  - mdxtab validate
  - mdxtab render
- GitHub Action for validation
- JSON report format for CI

## Development Strategy

- Keep parsing and evaluation in packages/core for reuse
- Keep the extension thin and UI-focused
- Use golden tests to lock determinism and prevent regressions
- Prefer pure, deterministic functions to match audit requirements
