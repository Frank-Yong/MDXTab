---
mdxtab: "1.0"
tables:
  t:
    columns: [a, b]
    computed:
      a: b + 1
      b: a + 1
---

### Explanation
Computed columns cannot depend on each other in a cycle. Here a depends on b and b depends on a, which yields E_CYCLE.

| a | b |
|---|---|
| 1 | 2 |

### Expected diagnostic
- Code: E_CYCLE
- Message: cycle detected among computed columns a, b in table t
