# MDXTab Technical Design

## Architecture Overview
- Pieces: core library (parse, validate, evaluate), optional CLI, VS Code extension built on the core.
- Flow: turn text into an expression tree, check it, compute rows, then compute totals, then render.
- Always deterministic and without side effects.

## Data Model
- Table: name, key column, declared columns, empty cell policy, types, lists of computed columns and aggregates, rows.
- Row: key plus literal cell values; computed values filled in after evaluation.
- Expressions: parsed as a simple tree of literals, references, function calls, and binary operations.

## Parsing
- Frontmatter: YAML parsed to structured schema; enforce required fields and defaults (`key: id`, `empty_cells: null`).
- Markdown tables: extract header to align with `columns`; parse rows to raw literals or blanks (handled by policy).
- No computed columns allowed in Markdown rows.

## Validation
- Schema: required keys, unique table names, unique row keys, columns match declared order.
- Types: allow only the safe conversions; fail on ambiguity or mismatch.
- Dependencies: find a safe order to compute things and fail if there is a loop.
- References: columns must exist; cross-table lookups must find the row and column.
- Empty cell policy: apply `null`/`zero`/`empty-string`/`error` the same way everywhere.

## Evaluation
- Row phase: compute row formulas in a safe order; references can point to the current row or to a lookup.
- Aggregate phase: run after rows are complete; can read any column, including computed ones.
- Functions: only deterministic built-ins (`sum`, `avg`, `min`, `max`, `count`, `round`, `if`).
- Errors: stop on failed lookups, bad types, or invalid expressions.

## Interpolation and Rendering
- Allow only `{{ table.aggregate }}` substitutions in Markdown body.
- Provide hooks to export tables to CSV/XLSX/JSON without altering semantics.

## Extensibility
- Keep a list of allowed functions; block anything random or time-based.
- Use future flags to add types or policies without breaking v1 defaults.

## Observability
- Structured error objects including table, column/aggregate, kind, and source location when available.
- Diagnostics surface to CLI exit codes and VS Code problems.

## Diagnostics format (simple)
- Every problem should carry: code, message, severity (error/warning/info), file, table, column or aggregate if known, and the text range to highlight.
- Example object:
	```json
	{
		"code": "type-mismatch",
		"message": "Value 'abc' is not a number.",
		"severity": "error",
		"file": "docs/plan.md",
		"table": "expenses",
		"column": "net",
		"range": { "start": { "line": 18, "character": 10 }, "end": { "line": 18, "character": 13 } }
	}
	```

## VS Code Extension UX
- Live validation: run parse/validate/evaluate on save and on-type with debounce; surface precise spans for schema, type, and dependency errors.
- Completions: offer columns, aggregates, functions, and table names contextually in expressions and `{{ }}`; schema-aware suggestions per table.
- Hovers: show type, expression source, dependency list, and evaluation phase (row vs aggregate) for columns and aggregates.
- Navigation: go-to-definition/peek for column references and cross-table lookups; document symbols for tables/columns/aggregates in the outline.
- Quick fixes: add missing column declarations, insert `row.` qualifier when needed, or change unknown identifiers to nearest valid names (with preview).
- Snippets: frontmatter + table scaffold for new docs; table-row snippet that matches declared columns.
- Commands: `MDXTab: Validate Document`, `MDXTab: Render Preview` (interpolation-only), `MDXTab: Show Table Schema` via command palette/status bar.
