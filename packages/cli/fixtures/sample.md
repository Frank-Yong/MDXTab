---
mdxtab: "1.0"
tables:
  rates:
    key: id
    columns: [id, rate]
    types:
      rate: number
  expenses:
    key: id
    columns: [id, category, net]
    computed:
      tax: net * rates[category].rate
    aggregates:
      total_net: sum(net)
      total_tax: sum(tax)
---

## rates
| id | rate |
|----|------|
| Hosting | 0.2 |
| Ads | 0.1 |

## expenses
| id | category | net |
|----|----------|-----|
| h1 | Hosting  | 100 |
| a1 | Ads      | 200 |

Summary: {{ expenses.total_net }} / {{ expenses.total_tax }}
