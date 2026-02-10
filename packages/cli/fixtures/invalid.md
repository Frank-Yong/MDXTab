---
mdxtab: "1.0"
tables:
  expenses:
    key: id
    columns: [id, net]
---

## expenses
| id | net |
|----|-----|
| h1 | 100 |

Missing column will cause error: {{ expenses.total_net }}
