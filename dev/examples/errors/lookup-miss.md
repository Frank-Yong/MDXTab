---
mdxtab: "1.0"
tables:
  roles:
    key: id
    columns: [id, title]
  hires:
    key: id
    columns: [id, role_id]
    computed:
      role_title: roles[role_id].title
---

### Explanation
Shows a lookup that fails because the referenced key is missing. roles[role_id].title cannot resolve role_id "missing".

## Roles

| id | title    |
|----|----------|
| se | Engineer |

## Hires

| id | role_id |
|----|---------|
| h1 | missing |

### Expected diagnostic
- Code: E_LOOKUP
- Message: lookup failed in table roles for key "missing" while evaluating role_title in table hires (row id h1)
