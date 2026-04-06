# Troubleshooting

Use this page when validation or render behavior is not what you expected.

## Common checks first

- File starts with YAML frontmatter and contains `mdxtab: "1.0"`.
- Table headers match configured columns.
- Computed and aggregate expressions use valid identifiers.

## Common errors

- `E_LIMIT`: expression or dependency exceeded configured limits.
- `E_NUMBER`: non-finite numeric value was produced or parsed.
- `E_REF`: unknown table or column reference.
- `E_TYPE`: wrong type for function or operation.

## What to do next

1. Validate with CLI JSON output for precise diagnostics.
2. Reduce expression size or increase limits only when safe.
3. Check sample files under `dev/examples` for known-good patterns.

## Next

- [Docs Home](index.md)
- [Quick Start](quick-start.md)
