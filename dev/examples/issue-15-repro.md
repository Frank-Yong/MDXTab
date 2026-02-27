---
mdxtab: "1.0"
tables:
  demo:
    columns: [id, value]
    aggregates:
      total: sum(value)
---

# Issue 15 Repro

## demo
| id | value |
| --- | --- |
| a | 1 |
| b | 2 |

---

## Markdown After Horizontal Rule

This content should still be highlighted as normal markdown.

- List item A
- List item B

**Bold**, *italic*, and a [link](https://example.com) should all render normally.

{{ demo.total }}
