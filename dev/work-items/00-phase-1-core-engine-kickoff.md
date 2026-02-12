# Work Item: Phase 1 Core Engine Kickoff

## Status
- Branch: phase-1-core-engine
- Focus: parsing and evaluation primitives for the core library.

## Objectives
- Stand up `packages/core` with parsing, lexing/parsing, evaluation, and dependency modules.
- Align implementations with formal/technical specs (numeric/null rules, rounding, identifiers, header trimming for column matching, data cell preservation, interpolation constraints).

## Immediate steps
1) Stub `packages/core` with parsing/evaluation modules and a test harness.
2) Implement frontmatter + Markdown extraction with header trimming for column names and data cell preservation.
3) Build lexer + Pratt parser with coverage for success and syntax errors.
4) Wire dependency ordering + row evaluator; cover lookup and null/numeric edge cases.

## Linked work items
- 02: frontmatter + Markdown parsing
- 04: expression lexer and parser
- 05: dependency graph and cycles
- 06: row evaluation
