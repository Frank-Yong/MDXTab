---
mdxtab: "1.0"
tables:
  time_entries:
    key: id
    columns: [id, date, project, start, end, break, duration]
    types:
      start: number
      end: number
      break: number
      duration: number
    computed:
      duration: row.end - row.start - row.break
    aggregates:
      total_hours: sum(duration)
---

### Explanation
Computes duration from numeric start/end/break values and sums total hours. Calculation: duration = row.end - row.start - row.break; total_hours = sum(duration).

## time_entries

| id | date       | project | start | end  | break | duration |
|----|------------|---------|-------|------|-------|----------|
| e1 | 2026-02-17 | Alpha   | 9.0   | 17.5 | 0.5   |          |
| e2 | 2026-02-17 | Beta    | 10.0  | 18.0 | 1.0   |          |
| e3 | 2026-02-18 | Alpha   | 8.5   | 16.0 | 0.5   | |

### Summary (rendered)
- Total hours: {{ time_entries.total_hours }}
