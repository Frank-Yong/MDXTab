---
mdxtab: "1.0"
tables:
  time_entries:
    key: id
    columns: [id, date, start, end, break, duration]
    types:
      start: time
      end: time
      break: time
      duration: number
    computed:
      duration: hours(end) - hours(start) - hours(break)
    aggregates:
      total_hours: sum(duration)
---

## time_entries

| id | date       | start | end  | break | duration |
|----|------------|-------|------|-------|----------|
| e1 | 2026-02-17 | 09:00 | 17:30| 00:30 |          |
| e2 | 2026-02-17 | 10:00 | 18:00| 01:00 |          |
| e3 | 2026-02-18 | 08:30 | 16:00| 00:30 |          |

### Summary (rendered)
- Total hours: {{ time_entries.total_hours }}
