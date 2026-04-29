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
    empty_cells: "null"|"zero"|"empty-string"|"error"  # optional; omit field for default null behavior
    types:                           # optional
      <columnName>: number|string|bool|date
    computed:                        # optional
      <columnName>: <expression>
    aggregates:                      # optional
      <name>: <expression>
    summary_rows:                    # optional
      <rowName>:
        label: <string>
        cells:
          <columnName>: <expression>
report_tables:                       # optional
  <reportName>:
    rows_from: <tableName>
    key: <columnName>                # optional, default: source table key
    columns: [<columnName>, ...]
    cells:
      <columnName>: <expression>
pivot_tables:                        # optional
  <pivotName>:
    source: <tableName>
    rows:
      from: <columnName>|<tableName>.<columnName>
      order: [<string>, ...]         # optional
    columns:
      from: <columnName>|<tableName>.<columnName>
      range:                         # optional
        start: YYYY-MM-DD
        end: YYYY-MM-DD
        step: day|week|month         # optional, default: day
      label: iso_date|short_month_day  # optional, default: iso_date
    value: sum(<columnName>)
    empty_cells: "null"|"zero"|"empty-string"|"error"  # optional; omit field for default null behavior
    totals:                          # optional
      row: <name>
      column:
        <rowName>:
          mode: sum|running_sum      # optional, default: sum
---

# Markdown body (data + presentation)
```

## Frontmatter Rules
- `mdxtab` version is required and must be `1.0` for this spec.
- Each table must declare a unique name under `tables` and a stable row key (defaults to `id`).
- Key column type must be `string` or `number`; `bool` and `date` keys are not allowed.
- Table, column, computed-column, and aggregate names must follow the identifier rules (letter/digit/underscore, start with letter/underscore, case-sensitive).
- `columns` defines order and presence; Markdown table headers must match exactly after trimming header cell leading/trailing spaces.
- `empty_cells` controls how blank Markdown cells are interpreted: `null` (default), `zero`, `empty-string`, or `error`.
- `types` applies optional static typing; validation fails on mismatches.
- `computed` defines per-row derived columns; computed columns must not appear in Markdown data rows.
- `aggregates` defines table-level scalars evaluated after row computation.
- `summary_rows` defines synthetic rows appended in rendered preview/output; each row requires `label` and `cells`.
- `summary_rows.<row>.cells` maps table columns to expressions; expressions evaluate left-to-right and may reference prior summary cells via `self.<column>`.
- `report_tables` defines synthetic rendered tables whose rows are driven by another table via `rows_from`.
- `report_tables.<name>.columns` defines rendered column order.
- `report_tables.<name>.cells` must define one expression per rendered column.
- `report_tables.<name>.key` is optional and defaults to the key of the `rows_from` source table.
- `pivot_tables` defines synthetic 2-D matrices rendered at matching headings.
- `pivot_tables.<name>.source` must reference an authored table.
- `pivot_tables.<name>.rows.from` and `.columns.from` accept either a source column name or `table.column` reference to an authored table; when using `table.column`, the referenced column name must also exist in the pivot `source` table schema.
- `pivot_tables.<name>.columns.range` is optional and requires ISO dates (`YYYY-MM-DD`) with `start <= end`; `step` is `day`, `week`, or `month`.
- `pivot_tables.<name>.columns.label` supports `iso_date` and `short_month_day`.
- `pivot_tables.<name>.value` in v1 must be `sum(<column>)` where `<column>` exists in the source table.
- `pivot_tables.<name>.totals.row` defines the synthesized trailing row-total column name (it is not required to be a source-table column).
- `pivot_tables.<name>.totals.column.<name>.mode` supports `sum` and `running_sum` footer rows.

## Markdown Body Rules
- Contains only literal values; no inline formulas or expressions.
- Row order is preserved as written; column order must match `columns`.
- Empty cells adopt `empty_cells` policy.
- Tables are keyed by the `key` column; key values must be unique per table.
- A heading whose text matches a `report_tables` name is a render target for that synthetic report table.
- A heading whose text matches a `pivot_tables` name is a render target for that synthetic pivot table.

## Data Types
- Primitive types: `number` (IEEE-754), `string` (UTF-8 text), `bool` (`true`/`false`), `date` (ISO-8601 `YYYY-MM-DD`).
- Type coercion (only when deterministic and strict):
  - `string` -> `number` if the entire string matches `^-?\d+(\.\d+)?$` and the parsed value is finite.
  - `string` -> `bool` if the entire string is `true` or `false`.
  - `string` -> `date` if the entire string is `YYYY-MM-DD`.
- All other coercions must fail.

### Numeric literal format for coercion
- Only plain decimals are accepted: optional leading `-`, digits, optional `.` followed by digits.
- Not allowed: leading `+`, leading `.`, trailing `.`, exponents (`e`/`E`), underscores, or other formatting.

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
- Pure, deterministic, side-effect-free.
- Implementations must reject pathological expressions using explicit resource
  limits rather than recursing until runtime failure.
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

### Expression guardrails
- Expressions exceeding implementation limits must fail with `E_LIMIT`.
- The current TypeScript implementation uses these limits:
  - Maximum expression length: 4096 characters
  - Maximum token count: 512 tokens
  - Maximum measured AST depth: 64
  - Maximum parse depth: 256
  - Maximum dependency traversal depth: 128
- Implementations may allow these limits to be configured, but exceeding the
  active limits must still fail with `E_LIMIT`.
- Limits apply to computed columns, aggregate expressions, and dependency
  traversal during ordering.
- Limit failures are fatal validation errors.

### Context rules for functions
- In per-row computed columns, only row-safe functions are allowed. Using aggregate-only functions in a row expression is an error (`invalid-aggregate-context`).
- In aggregates, both row-safe and aggregate-only functions are allowed, but aggregate-only functions operate over the current table after row evaluation.
- In `report_tables` cells, expressions may reference `row.<column>` from the `rows_from` source row, grouped aggregate maps such as `transactions.total_by_category[row.id]`, and existing table lookups.

### Comparison chaining
- Comparisons allow only a single operator (e.g., `a < b`). Chained comparisons such as `1 < 2 < 3` are invalid and must raise `invalid-expression`.

## Identifiers
- ASCII-only: start with `[A-Za-z_]`, continue with `[A-Za-z0-9_]*`.
- Applies to table, column, computed-column, aggregate, and function names.
- Identifiers are case-sensitive.

### Reserved words
- Reserved and cannot be used as identifiers: `and`, `or`, `true`, `false`, `row`.
- All other identifiers may be used for tables, columns, computed columns, aggregates, and functions.

## Evaluation Order (Deterministic)
1) Parse frontmatter and Markdown tables.
2) Validate schema, column presence, types, and dependency graph (no cycles).
3) Evaluate computed columns per row in dependency order.
4) Evaluate aggregates over final column values.
5) Evaluate `summary_rows` cell expressions in declaration order.
6) Evaluate `report_tables` rows from their `rows_from` source tables.
7) Evaluate `pivot_tables` row/column axes, cells, and totals.
8) Render outputs (computed columns/summary rows/report tables/pivot tables/interpolation, exports).

### Aggregate Null Handling
- Aggregates skip null inputs.
- If all values are null: `sum` and `count` return 0; `avg`, `min`, and `max` return null.

## Interpolation Rules
- Allowed only for aggregates inside `{{ table.aggregate }}` within Markdown body.
- Arbitrary expressions inside interpolation are disallowed.
- Spaces allowed inside the braces: `{{table.aggregate}}` and `{{ table.aggregate }}` are both valid.
- Any other pattern with `{{` and `}}` that is not `table.aggregate` is an error **unless** it appears inside fenced code blocks or inline code spans, which are left untouched.
- Escaping in text: write `\{\{` and `\}\}` in the source to render literal `{{` and `}}`; escaped braces must not be considered for interpolation.
- Processing model: parse Markdown; for non-code text nodes, operate on the original source slices (before Markdown unescaping). First handle escapes (`\{\{` → literal `{{`, `\}\}` → literal `}}`), then detect unescaped `{{ table.aggregate }}` placeholders; code blocks and inline code are skipped entirely.

## Error Handling (Fatal)
- Missing tables/columns/keys, duplicate keys, or column order mismatch.
- Type mismatches or invalid coercions.
- Circular dependencies among computed columns or aggregates.
- Invalid expressions or unknown identifiers/functions.
- Expressions exceeding implementation guardrail limits.
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
- Tabs are not allowed inside table cells. Check tabs in the raw source lines before any Markdown normalization; if a tab appears inside a cell, it is an error. Do not rely on downstream Markdown parsers expanding tabs.
- Header cells: trim leading/trailing spaces for column-name matching; after trimming, header names must satisfy identifier rules. Empty headers after trimming are errors.
- Because whitespace is preserved, a value like ` 123 ` will fail numeric coercion (whitespace is not allowed for coercion).

### Standard error codes (suggested)
- `missing-table`, `missing-column`, `duplicate-key`, `column-order-mismatch`, `type-mismatch`, `invalid-coercion`, `cycle-detected`, `invalid-expression`, `unknown-identifier`, `unknown-function`, `lookup-failed`, `empty-cell-error`, `divide-by-zero`, `non-finite-number`, `invalid-round`, `invalid-date`, `invalid-identifier`, `invalid-interpolation`, `invalid-aggregate-context`, `invalid-aggregate-argument`.
- TypeScript implementation note: `E_LIMIT` is used when expression size or
  dependency depth exceeds the supported guardrail limits.
- TypeScript implementation note: `E_NUMBER` is used when parsing, coercion,
  or evaluation encounters a non-finite numeric literal or value, including
  arithmetic results such as `NaN` or `Infinity`.

## Versioning and Compatibility
- Files declare `mdxtab: 1.0`; future minor versions must remain backward compatible.
- Breaking changes require a new format identifier.

## Security and Determinism
- No I/O, file, or network access from expressions.
- No randomness or time-dependent functions.
- Same input must yield the same output across implementations.
