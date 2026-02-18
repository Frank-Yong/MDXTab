---
mdxtab: "1.0"
tables:
  expenses:
    key: id
    columns: [id, net]
    types:
      net: number
---

### Explanation
Shows a type coercion failure when a non-numeric value appears in a number column. Here net expects number but row h2 has "bad".

| id | net   |
|----|-------|
| h1 | 100   |
| h2 | bad   |

### Expected diagnostic
- Code: E_TYPE
- Message: cannot coerce value "bad" to number in column net (row id h2)
