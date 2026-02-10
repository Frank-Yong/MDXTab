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

- Create packages/core:
  - Frontmatter parser
  - Markdown table extractor
  - Expression lexer + Pratt parser
  - AST evaluator
  - Dependency graph and cycle detection
  - Type validation + coercion rules
- Add unit tests for grammar, evaluation, and error cases

## Phase 2: VS Code Extension (2-3 weeks)

- Implement diagnostics:
  - Schema errors
  - Circular dependencies
  - Invalid references and lookups
- Add document symbols for tables, columns, aggregates
- Add hover info for computed columns and aggregates
- Optimize incremental parsing on save
- Markdown preview integration:
  - Command to render the current MDXTab document via core compiler and open in a side preview
  - Option to auto-render on save (opt-in)
  - Surface compiler errors inline in the preview output

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
