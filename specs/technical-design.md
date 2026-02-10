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
- Dates: strict `YYYY-MM-DD`, date-only; no time zone or date math.
- Identifiers: ASCII-only; start with `[A-Za-z_]`, continue with `[A-Za-z0-9_]*`, case-sensitive.

## Validation
- Schema: required keys, unique table names, unique row keys, columns match declared order.
- Types: allow only the safe conversions; fail on ambiguity or mismatch.
- Dependencies: find a safe order to compute things and fail if there is a loop.
- References: columns must exist; cross-table lookups must find the row and column.
- Empty cell policy: apply `null`/`zero`/`empty-string`/`error` the same way everywhere.
- Expressions: reject chained comparisons (only one comparison operator per expression segment).

## Evaluation
- Row phase: compute row formulas in a safe order; references can point to the current row or to a lookup.
- Aggregate phase: run after rows are complete; can read any column, including computed ones.
- Functions: row-safe in row expressions (`round`, `if`); aggregate-only in aggregates (`sum`, `avg`, `min`, `max`, `count`). Using aggregate-only functions in a row expression is an error.
- Aggregate-only functions take exactly one argument, which must be a column reference from the same table; other argument shapes are errors.
- Errors: validation must collect all issues it can find; evaluation is fail-fast on the first runtime error (e.g., lookup failure, divide-by-zero) and must not produce partial outputs.

## Number and null rules
- Numbers are IEEE-754 and must be finite; division by zero errors.
- `round` uses decimal half-to-even and requires an integer `n` that is non-negative.
- Rounding must use decimal/integer arithmetic (not binary float tie checks): scale by `10^n`, round the scaled value half-to-even, then divide by `10^n`; error if the result is not finite. The result must match computing on the exact rational value of the IEEE-754 input.
- Arithmetic with null returns null; division by zero always errors, even if a null is present (e.g., `null / 0` errors).
- Aggregates skip nulls; empty inputs return: `sum`=0, `count`=0, `avg`=null, `min`=null, `max`=null.
- Comparisons against null are errors; logical `and`/`or` treat null as false.

## Interpolation and Rendering
- Allow only `{{ table.aggregate }}` substitutions in Markdown body.
- Provide hooks to export tables to CSV/XLSX/JSON without altering semantics.
- Allow optional spaces inside braces; any other `{{ }}` pattern is an error, except inside fenced code blocks or inline code spans, which are left untouched.
- Escaping: `\{\{` and `\}\}` render literal `{{` and `}}` in text. Interpolation runs on the Markdown AST; for non-code text nodes use the source slices before Markdown unescaping, apply escapes first, then detect unescaped `{{ table.aggregate }}`. Code blocks/spans are skipped.

## Extensibility
- Keep a list of allowed functions; block anything random or time-based.
- Use future flags to add types or policies without breaking v1 defaults.

## Cross-language compliance
- Keep behavior identical across runtimes: follow the number/null rules and aggregate empty-set results above.
- Reject NaN/Infinity; do not allow environment-specific math quirks.
- Use the shared diagnostics shape so CLI and editors stay aligned.
- Treat golden test vectors as the contract for ports in other languages.
- Use the shared error codes list for consistency across implementations.

## Pitfalls to avoid
- Ambiguous templates: only `{{ table.aggregate }}` (with optional spaces) is valid; other `{{ }}` forms error.
- Table parsing drift: never reorder rows or data cells; enforce declared column order and preserve row order. Header cells may be trimmed for column-name matching; data cells must not be auto-trimmed.
- Identifier laxness: stay case-sensitive; allow only letters/digits/underscore, starting with letter/underscore.
- Silent coercions: forbid any coercion outside the allowed patterns; fail instead of guessing.
- NaN/Infinity leaks: disallow; error on divide-by-zero or overflow cases that would produce them.
- Date looseness: accept only `YYYY-MM-DD`; no time zones, no date math in v1.

## Observability
- Structured error objects including code, table, column/aggregate, message, severity, and source location when available.
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
