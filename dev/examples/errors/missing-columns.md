---
mdxtab: "1.0"
tables:
  expenses:
    key: id
    columns: [id, category, net]
---

| id | category | net | extra |
|----|----------|-----|-------|
| h1 | Hosting  | 100 | oops  |

### Expected diagnostic
- Code: E_COLUMN_MISMATCH
- Message: header/data column mismatch for table expenses; unexpected column "extra"
