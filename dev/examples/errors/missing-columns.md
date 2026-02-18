---
mdxtab: "1.0"
tables:
  expenses:
    key: id
    columns: [id, category, net]
---

  ### Explanation
  Shows a header that does not match the schema column list. The extra column causes E_COLUMN_MISMATCH.

| id | category | net | extra |
|----|----------|-----|-------|
| h1 | Hosting  | 100 | oops  |

### Expected diagnostic
- Code: E_COLUMN_MISMATCH
- Message: header/data column mismatch for table expenses; unexpected column "extra"
