---
mdxtab: "1.0"
tables:
  t:
    key: id
    columns: [id]
    computed:
      total: >
        1000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000 *
        1000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
---

### Explanation
Shows a finite-number failure when a computed expression overflows. The
`total` formula multiplies two very large numbers, which would produce a
non-finite result and must fail with `E_NUMBER`.

Each literal is finite on its own. The error is raised because the arithmetic
result overflows.

## t

| id |
|----|
| x  |

### Expected diagnostic
- Code: E_NUMBER
- Message: [computed] table t total id=x: E_NUMBER: arithmetic result must be finite