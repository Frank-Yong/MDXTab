---
mdxtab: "1.0"
tables:
  t:
    columns: [id, net]
    aggregates:
      bad: sum(net + 1)
---

### Explanation
Aggregate arguments must be a single column identifier, not an expression. Here sum(net + 1) should fail with E_AGG_ARGUMENT.

| id | net |
|----|-----|
| a  | 1   |

### Expected diagnostic
- Code: E_AGG_ARGUMENT
- Message: aggregate argument must be a bare column identifier (got expression "net + 1") in aggregate bad
