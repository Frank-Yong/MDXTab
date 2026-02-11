---
mdxtab: "1.0"
tables:
  sample:
    columns: [id, value]
    types:
      value: number
    aggregates:
      total: sum(value)
---
## sample

| id | value |
|----|-------|
| a  | 1.345  |
| b  | 2.25  |

Narrative uses {{ sample.total }} outside code.

`Inline code with {{ sample.total }} stays literal.`

### Expected
- total = 3.75
- Only the narrative line interpolates; the code span remains unchanged.
