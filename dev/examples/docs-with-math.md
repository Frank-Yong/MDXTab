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
### Explanation
Shows aggregate interpolation in normal text while leaving inline code untouched. Calculation: total = sum(value) = 1.5 + 2.25 = 3.75.

## sample

| id | value |
|----|-------|
| a  | 1.5  |
| b  | 2.25  |

Narrative uses {{ sample.total }} outside code.

`Inline code with {{ sample.total }} stays literal.`

### Expected
- total = 3.75
- Only the narrative line interpolates; the code span remains unchanged.
