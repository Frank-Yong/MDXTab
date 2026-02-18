---
mdxtab: "1.0"
tables:
  time_entries:
    key: id
    columns: [id, project, start, end, break, duration]
    types:
      start: time
      end: time
      break: time
      duration: number
    computed:
      duration: hours(end) - hours(start) - hours(break)
    aggregates:
      hours_by_project: sum(duration) by project
  expenses:
    key: id
    columns: [id, category, net]
    types:
      net: number
    aggregates:
      net_by_category: sum(net) by category
---

### Explanation
Uses grouped aggregates for time entries by project and expenses by category. Calculation: duration = hours(end) - hours(start) - hours(break); hours_by_project = sum(duration) by project; net_by_category = sum(net) by category.

## time_entries

| id | project | start | end  | break | duration |
|----|---------|-------|------|-------|----------|
| e1 | Alpha   | 09:00 | 17:30| 00:30 |          |
| e2 | Beta    | 10:00 | 18:00| 01:00 |          |
| e3 | Alpha   | 08:30 | 16:00| 00:30 |          |

## expenses

| id | category | net |
|----|----------|-----|
| h1 | Hosting  | 100 |
| a1 | Ads      | 200 |
| s1 | Support  | 150 |

### Summary (rendered)
- Alpha hours: {{ time_entries.hours_by_project[Alpha] }}
- Beta hours: {{ time_entries.hours_by_project[Beta] }}
- Hosting net: {{ expenses.net_by_category[Hosting] }}
- Ads net: {{ expenses.net_by_category[Ads] }}
