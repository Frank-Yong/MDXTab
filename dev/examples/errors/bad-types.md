---
mdxtab: "1.0"
tables:
  expenses:
    key: id
    columns: [id, net]
    types:
      net: number
---

| id | net   |
|----|-------|
| h1 | 100   |
| h2 | bad   |

### Expected diagnostic
- Code: E_TYPE
- Message: cannot coerce value "bad" to number in column net (row id h2)
