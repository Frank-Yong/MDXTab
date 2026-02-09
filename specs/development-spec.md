# MDXTab Development Specification

## Objectives
- Deliver a deterministic, audited MDXTab implementation with reusable core logic.
- Provide validation, evaluation, and rendering utilities for CI and editor tooling.
- Maintain parity with the v1 format spec and keep future versions backward compatible.

## Scope
- Parse: YAML frontmatter + Markdown tables.
- Validate: schema, types, dependency graph, empty cell policy, cross-table lookups.
- Evaluate: computed columns (per row) and aggregates (per table).
- Render: interpolation of aggregates in Markdown; exports (CSV/XLSX) are optional v1 deliverables but should be planned.
- Tooling: core library, VS Code extension, optional CLI for validate/render.

## Non-Goals
- Interactive spreadsheet UI, macros, or volatile functions.
- Arbitrary expression evaluation in interpolation.
- Network/I/O inside expressions.

## Functional Requirements
- Parse frontmatter and require the basics: `mdxtab`, `tables`, and `columns`; `key` is optional and defaults to `id` if omitted.
- Read Markdown tables in the written order and ensure their columns match what was declared.
- Only allow safe type conversions; fail when a value does not fit the declared type.
- Parse and run expressions the same way every time; detect and block any dependency loops.
- Compute row formulas first, then the aggregates.
- Report errors with table/column and line info when possible.
- Allow interpolation only for aggregates (`{{ table.aggregate }}`).

## Non-Functional Requirements
- Same input always gives the same output.
- Fast enough for typical docs (hundreds of rows); note any limits for bigger files.
- Make errors easy to see in CI and in the editor.
- Allow adding safe built-in functions without breaking determinism.

## Cross-language Compatibility
- Follow the format spec rules for numbers: only finite values, division by zero errors, `round` uses half-to-even, and no NaN/Infinity.
- Apply null rules consistently: arithmetic with null yields null; aggregates skip nulls and use the defined empty-set results; comparisons with null error.
- Use the shared diagnostics shape (code, message, severity, file, table, column/aggregate, range).
- Pass the golden test vectors; use them as a contract for other language ports.
- Apply strict date rules: `YYYY-MM-DD` only, no time zone, no date math.
- Enforce identifier rules: letters/digits/underscore, start with letter/underscore, case-sensitive.
- Interpolation: accept `{{ table.aggregate }}` with optional spaces; skip fenced/inline code; other `{{ }}` forms error; allow escaping via `\{\{` and `\}\}`. Follow the formal spec as the source of truth.
- Use the standard error codes list to keep diagnostics aligned across runtimes.

## Milestones (aligned with plan)
1) Spec lock and golden examples.
2) Core engine: parsing, validation, expression eval, aggregates, dependency graph.
3) VS Code extension: diagnostics, hovers, symbols, incremental parsing.
4) Optional CLI/CI: `mdxtab validate`, `mdxtab render`, JSON report.

## VS Code Extension (expected behaviors)
- Show errors and warnings as you type (debounced) and on save, with clear highlights on the bad text.
- Completions that list valid columns, aggregates, table names, and functions based on where you are typing.
- Hovers that explain a column or aggregate: type, how it is computed, and what it depends on.
- Navigation: outline of tables/columns/aggregates; go to definition/peek for references and cross-table lookups.
- Quick fixes for common mistakes: add missing column in frontmatter, suggest nearest valid name, or add `row.` when missing.
- Commands: validate current file, render a preview with `{{ }}` filled, show the schema of the current file.

## Diagnostics data (simple shape)
- Each problem should include: a short code, human message, severity (error/warning/info), file, table, column or aggregate (when known), and the text range.
- Example JSON object:
	```json
	{
		"code": "missing-column",
		"message": "Column 'tax' is not declared in the table schema.",
		"severity": "error",
		"file": "docs/budget.md",
		"table": "expenses",
		"column": "tax",
		"range": { "start": { "line": 12, "character": 8 }, "end": { "line": 12, "character": 11 } }
	}
	```

## Testing Strategy
- Golden test vectors (input → expected outputs or errors) to lock behavior.
- Unit tests for parsing, evaluation, type rules, and error cases.
- Randomized checks where useful (for example, parse then serialize should keep data the same).
- Integration tests for cross-table lookups and detecting dependency cycles.
- Publish golden vectors with strict expected diagnostics (codes, messages) to guide other language ports.

## Compatibility and Versioning
- `mdxtab: 1.0` enforced; feature flags for future additions must default off.
- Semantic versioning for libraries and CLI; avoid breaking changes without major bumps.

## Deliverables
- Core library (TypeScript) exposing parse/validate/evaluate/render APIs.
- VS Code extension consuming the core for diagnostics and UX.
- Optional CLI with validation/render commands and CI-friendly output.
