# Troubleshooting

Use this page when validation or render behavior is not what you expected.

## Common checks first

- File starts with YAML frontmatter and contains `mdxtab: "1.0"`.
- Table headers match configured columns.
- Computed and aggregate expressions use valid identifiers.

Quick command for diagnostics:

```sh
node packages/cli/dist/bin.js validate path/to/file.md --json
```

This gives machine-readable diagnostics with codes, ranges, and messages.

## Common errors

### E_LIMIT

Meaning:
- Expression is too long/complex or dependency traversal exceeded configured limits.

Typical causes:
- Very long formula chains.
- Excessive nesting.
- Deep computed-column dependency graphs.

Fixes:
- Break one expression into multiple computed columns.
- Reduce nesting and repeated subexpressions.
- Increase limits only when needed via CLI flags or VS Code settings (`mdxtab.limits.maxExpressionLength`, `mdxtab.limits.maxTokens`, `mdxtab.limits.maxAstDepth`, `mdxtab.limits.maxParseDepth`, `mdxtab.limits.maxDependencyDepth`).

### E_NUMBER

Meaning:
- A numeric value was non-finite (`Infinity`/`NaN`) or an operation produced a non-finite result.

Typical causes:
- Arithmetic overflow.
- Numeric literals outside safe finite range.

Fixes:
- Scale large values down before combining.
- Split calculations into safer intermediate values.
- Check source numeric literals and imported data for extreme magnitudes.

### E_REF

Meaning:
- A table/column/identifier/member reference does not exist in scope.

Typical causes:
- Typo in column name.
- Referencing a computed/aggregate before it exists in context.

Fixes:
- Match names exactly with declared `columns` and table names.
- Confirm the reference type is valid for that expression context.

### E_LOOKUP

Meaning:
- Lookup target is invalid or key is missing.

Typical causes:
- Missing key value in lookup table.
- Incorrect lookup base shape.

Fixes:
- Ensure key column is present and unique.
- Verify referenced lookup keys actually exist.

### E_TYPE

Meaning:
- Operand/function received a value of unexpected type.

Typical causes:
- Using number operations on strings/null.
- Boolean operators with non-boolean operands.

Fixes:
- Confirm declared `types` and source table values.
- Convert/sanitize input values before arithmetic.

### E_AGG_ARGUMENT / E_AGG_REF

Meaning:
- Aggregate argument shape is invalid or aggregate reference is missing.

Typical causes:
- Aggregate called with non-column argument.
- Referencing unknown grouped aggregate key/map.

Fixes:
- Use `sum(col)`/`avg(col)` style arguments.
- Verify aggregate names and grouped key lookups.

### E_CYCLE

Meaning:
- Computed dependency cycle detected.

Typical causes:
- Computed columns referencing each other in a loop.

Fixes:
- Break the cycle by introducing base columns or reordering logic.

### E_TABLE_TAB / E_TABLE_COLUMN_COUNT / E_KEY / E_KEY_DUP

Meaning:
- Markdown table structure or key constraints are invalid.

Typical causes:
- Tab characters in table rows.
- Mismatched column counts.
- Missing or duplicate key values.

Fixes:
- Replace tabs with spaces.
- Ensure every row has same number of cells as header.
- Ensure `key` column is present and unique.

## Symptom-based guide

### "Preview is empty or shows errors"

1. Run `MDXTab: Validate Document` in VS Code.
2. Check Problems panel codes/messages.
3. Validate the same file via CLI JSON output.

### "CLI validate fails in CI"

1. Re-run with `--json` for exact diagnostic payload.
2. Store JSON output as a CI artifact for debugging.
3. Fix by code category above (`E_LIMIT`, `E_REF`, `E_TYPE`, etc.).

### "Computed values look wrong"

1. Confirm `types` declarations for involved columns.
2. Check lookup key existence and uniqueness.
3. Test intermediate expressions in smaller computed steps.

## What to do next

1. Validate with CLI JSON output for precise diagnostics.
2. Reduce expression size or increase limits only when safe.
3. Check sample files under `dev/examples` for known-good patterns.

## Related

- [Quick Start](quick-start.md)
- [CLI Usage](cli-usage.md)
- [VS Code Extension](vscode-extension.md)

## Next

- [Docs Home](index.md)
- [Quick Start](quick-start.md)
