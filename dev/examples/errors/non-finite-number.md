---
mdxtab: "1.0"
tables:
  t:
    key: id
    columns: [id]
    computed:
      total: >
        999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999 *
        999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999
---

### Explanation
Shows a finite-number failure when a computed expression overflows. The
`total` formula multiplies two very large numbers, which would produce a
non-finite result and must fail with `E_NUMBER`.

## t

| id |
|----|
| x  |

### Expected diagnostic
- Code: E_NUMBER
- Message: arithmetic result must be finite while evaluating computed column `total` in table `t` for row `x`