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
- Type coercion (only when unambiguous and lossless):
  - `string` -> `number` if matches `-?\d+(\.\d+)?`
  - `string` -> `bool` if `true` or `false`
  - `string` -> `date` if `YYYY-MM-DD`
- All other coercions must fail.

## Expression Language (v1)
- Pure, deterministic, side-effect free.
- Grammar (EBNF):
```
expression  ::= logical
logical     ::= comparison ( ("and" | "or") comparison )*
comparison  ::= sum ( ("==" | "!=" | ">" | "<" | ">=" | "<=") sum )*
sum         ::= term ( ("+" | "-") term )*
term        ::= factor ( ("*" | "/") factor )*
factor      ::= literal | reference | function | "(" expression ")"
reference   ::= identifier | "row." identifier | table_ref
table_ref   ::= identifier "[" identifier "]." identifier
function    ::= identifier "(" arguments? ")"
arguments   ::= expression ( "," expression )*
```
- Built-ins: `sum(col)`, `avg(col)`, `min(col)`, `max(col)`, `count(col)`, `round(x,n)`, `if(cond,a,b)`.
- References:
  - `row.col` or `col` within the same row.
  - Cross-table lookup: `table[key].col`; missing row or column must fail.

## Evaluation Order (Deterministic)
1) Parse frontmatter and Markdown tables.
2) Validate schema, column presence, types, and dependency graph (no cycles).
3) Evaluate computed columns per row in dependency order.
4) Evaluate aggregates over final column values.
5) Render outputs (interpolation, exports).

## Interpolation Rules
- Allowed only for aggregates inside `{{ table.aggregate }}` within Markdown body.
- Arbitrary expressions inside interpolation are disallowed.

## Error Handling (Fatal)
- Missing tables/columns/keys, duplicate keys, or column order mismatch.
- Type mismatches or invalid coercions.
- Circular dependencies among computed columns or aggregates.
- Invalid expressions or unknown identifiers/functions.
- Failed lookups in cross-table references.
- Empty cell policy `error` violations.

## Versioning and Compatibility
- Files declare `mdxtab: 1.0`; future minor versions must remain backward compatible.
- Breaking changes require a new format identifier.

## Security and Determinism
- No I/O, file, or network access from expressions.
- No randomness or time-dependent functions.
- Same input must yield the same output across implementations.
