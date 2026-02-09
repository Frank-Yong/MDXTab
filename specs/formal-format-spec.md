# MDXTab Formal Format Specification (v1)

## Scope and Goals
- Define the canonical, deterministic text format for MDXTab v1.
- Ensure human-readable Markdown with machine-validated schema and logic.
- Guarantee reproducible evaluation and auditability across implementations.

## File Layout
```
---
mdxtab: 1.0
tables:
  <tableName>:
    key: <columnName>                # optional, default: id
    columns: [<columnName>, ...]
    empty_cells: null|zero|empty-string|error  # optional, default: null
    types:                           # optional
      <columnName>: number|string|bool|date
    computed:                        # optional
      <columnName>: <expression>
    aggregates:                      # optional
      <name>: <expression>
---

# Markdown body (data + presentation)
```

## Frontmatter Rules
- `mdxtab` version is required and must be `1.0` for this spec.
- Each table must declare a unique name under `tables` and a stable row key (defaults to `id`).
- Key column type must be `string` or `number`; `bool` and `date` keys are not allowed.
- Table, column, computed-column, and aggregate names must follow the identifier rules (letter/digit/underscore, start with letter/underscore, case-sensitive).
- `columns` defines order and presence; Markdown table columns must match exactly.
- `empty_cells` controls how blank Markdown cells are interpreted: `null` (default), `zero`, `empty-string`, or `error`.
- `types` applies optional static typing; validation fails on mismatches.
- `computed` defines per-row derived columns; computed columns must not appear in Markdown data rows.
- `aggregates` defines table-level scalars evaluated after row computation.

## Markdown Body Rules
- Contains only literal values; no inline formulas or expressions.
- Row order is preserved as written; column order must match `columns`.
- Empty cells adopt `empty_cells` policy.
- Tables are keyed by the `key` column; key values must be unique per table.

## Data Types
- Primitive types: `number` (IEEE-754), `string` (UTF-8 text), `bool` (`true`/`false`), `date` (ISO-8601 `YYYY-MM-DD`).
- Type coercion (only when deterministic and strict):
  - `string` -> `number` if the entire string matches `^-?\d+(\.\d+)?$` and the parsed value is finite.
  - `string` -> `bool` if the entire string is `true` or `false`.
  - `string` -> `date` if the entire string is `YYYY-MM-DD`.
- All other coercions must fail.

### Whitespace for coercion
- Leading or trailing whitespace is not allowed in values that are being coerced; any whitespace causes the coercion to fail.

## Dates
- Dates are date-only (no time, no timezone); format must be `YYYY-MM-DD`.
- No date arithmetic in v1; any attempt is an error.

## Numeric and Null Semantics
- Numbers are represented as IEEE-754, but results must be finite (no NaN or Infinity); any operation that would produce them is an error.
- Division by zero is an error.
- `round(x, n)` rounds to `n` decimal places using half-to-even; `n` must be an integer (negative not allowed) or it is an error.
- Rounding algorithm (deterministic/decimal):
  - Use decimal/integer arithmetic, not binary float tie checks.
  - Let `scale = 10^n`; compute `x_scaled = x * scale` exactly in decimal.
  - If the fractional part of `x_scaled` is < 0.5, round down; > 0.5, round up; == 0.5, round to the nearest even integer.
  - Result = rounded integer / `scale`. If the result is not finite, error.
- For `round`, the result must match computing on the exact rational value of the IEEE-754 input (not an approximated decimal literal). Implementations may use bigint/decimal to achieve exact scaling; binary float tie checks are not allowed.
- Arithmetic `+ - * /` with any null operand returns null (except division by zero, which errors).
- Logical `and`/`or` treat null as false.
- Comparisons against null are errors.

## Expression Language (v1)
- Pure, deterministic, side-effect free.
- Grammar (EBNF):
```
expression  ::= logical
logical     ::= comparison ( ("and" | "or") comparison )*
comparison  ::= sum ( ("==" | "!=" | ">" | "<" | ">=" | "<=") sum )?
sum         ::= term ( ("+" | "-") term )*
term        ::= factor ( ("*" | "/") factor )*
factor      ::= literal | reference | function | "(" expression ")"
reference   ::= identifier | "row." identifier | table_ref
table_ref   ::= identifier "[" expression "]." identifier
function    ::= identifier "(" arguments? ")"
arguments   ::= expression ( "," expression )*
```
- Built-ins:
  - Row-safe: `round(x,n)`, `if(cond,a,b)`.
  - Aggregate-only: `sum(col)`, `avg(col)`, `min(col)`, `max(col)`, `count(col)`.
  - Aggregate-only functions take exactly one argument, which must be a column reference from the same table; any other argument shape is an error (`invalid-aggregate-argument`).
- References:
  - `row.col` or `col` within the same row.
  - Cross-table lookup: `table[key].col`; `key` is any expression that must evaluate to the table's key type (`string` or `number`). Missing row or column must fail.

### Context rules for functions
- In per-row computed columns, only row-safe functions are allowed. Using aggregate-only functions in a row expression is an error (`invalid-aggregate-context`).
- In aggregates, both row-safe and aggregate-only functions are allowed, but aggregate-only functions operate over the current table after row evaluation.

### Comparison chaining
- Comparisons allow only a single operator (e.g., `a < b`). Chained comparisons such as `1 < 2 < 3` are invalid and must raise `invalid-expression`.

## Identifiers
- ASCII-only: start with `[A-Za-z_]`, continue with `[A-Za-z0-9_]*`.
- Applies to table, column, computed-column, aggregate, and function names.
- Identifiers are case-sensitive.

### Reserved words
- Reserved and cannot be used as identifiers: `and`, `or`, `true`, `false`, and the `row` prefix when followed by a dot.
- All other identifiers may be used for tables, columns, computed columns, aggregates, and functions.

## Evaluation Order (Deterministic)
1) Parse frontmatter and Markdown tables.
2) Validate schema, column presence, types, and dependency graph (no cycles).
3) Evaluate computed columns per row in dependency order.
4) Evaluate aggregates over final column values.
5) Render outputs (interpolation, exports).

### Aggregate Null Handling
- Aggregates skip null inputs.
- If all values are null: `sum` and `count` return 0; `avg`, `min`, and `max` return null.

## Interpolation Rules
- Allowed only for aggregates inside `{{ table.aggregate }}` within Markdown body.
- Arbitrary expressions inside interpolation are disallowed.
- Spaces allowed inside the braces: `{{table.aggregate}}` and `{{ table.aggregate }}` are both valid.
- Any other pattern with `{{` and `}}` that is not `table.aggregate` is an error **unless** it appears inside fenced code blocks or inline code spans, which are left untouched.
- Escaping in text: write `\{\{` and `\}\}` to render literal `{{` and `}}` in normal text.
- Interpolation runs over the Markdown AST, skipping fenced code blocks and inline code nodes.

## Error Handling (Fatal)
- Missing tables/columns/keys, duplicate keys, or column order mismatch.
- Type mismatches or invalid coercions.
- Circular dependencies among computed columns or aggregates.
- Invalid expressions or unknown identifiers/functions.
- Failed lookups in cross-table references.
- Empty cell policy `error` violations.

## Pitfalls to avoid
- Ambiguous templates: only `{{ table.aggregate }}` (with optional spaces) is allowed; all other `{{ }}` patterns error.
- Table drift: do not reorder or auto-trim cells; column order must match, row order is preserved.
- Identifier looseness: names are case-sensitive and limited to letters/digits/underscore, starting with a letter/underscore; no dashes/spaces.
- Type slippage: only the exact coercions allowed; everything else errors (no silent string→number/date).
- NaN/Infinity: never allowed; divide-by-zero is an error.
- Dates: strict `YYYY-MM-DD`, no time zones, no date math.

### Canonical cell text extraction
- Preserve the raw cell text between pipes; do not trim leading/trailing spaces.
- Tabs are not allowed inside table cells; treat them as invalid.
- Because whitespace is preserved, a value like ` 123 ` will fail numeric coercion (whitespace is not allowed for coercion).

### Standard error codes (suggested)
- `missing-table`, `missing-column`, `duplicate-key`, `column-order-mismatch`, `type-mismatch`, `invalid-coercion`, `cycle-detected`, `invalid-expression`, `unknown-identifier`, `unknown-function`, `lookup-failed`, `empty-cell-error`, `divide-by-zero`, `invalid-round`, `invalid-date`, `invalid-identifier`, `invalid-interpolation`, `invalid-aggregate-context`, `invalid-aggregate-argument`.

## Versioning and Compatibility
- Files declare `mdxtab: 1.0`; future minor versions must remain backward compatible.
- Breaking changes require a new format identifier.

## Security and Determinism
- No I/O, file, or network access from expressions.
- No randomness or time-dependent functions.
- Same input must yield the same output across implementations.
