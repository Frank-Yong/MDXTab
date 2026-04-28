import { describe, it, expect, vi } from "vitest";
import { compileMdxtab, validateMdxtab } from "../document.js";

const doc = `---
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
`;

describe("document integration", () => {
  it("parses, evaluates, and interpolates aggregates", () => {
    const result = compileMdxtab(doc);
    const expenses = result.tables.expenses.rows;
    expect(expenses).toHaveLength(2);
    const taxes = expenses.map((r) => r.tax);
    expect(taxes).toEqual([20, 20]);
    expect(result.tables.expenses.aggregates.total_net).toBe(300);
    expect(result.tables.expenses.aggregates.total_tax).toBe(40);
    expect(result.rendered).toContain("Summary: 300 / 40");
  });

  it("computes min/max aggregates for large tables", () => {
    const rowCount = 20000;
    const maxSafeArgs = 1000;
    const originalMin = Math.min.bind(Math);
    const originalMax = Math.max.bind(Math);
    const minSpy = vi.spyOn(Math, "min").mockImplementation((...args: number[]) => {
      if (args.length > maxSafeArgs) {
        throw new Error("spread-based min detected");
      }
      return originalMin(...args);
    });
    const maxSpy = vi.spyOn(Math, "max").mockImplementation((...args: number[]) => {
      if (args.length > maxSafeArgs) {
        throw new Error("spread-based max detected");
      }
      return originalMax(...args);
    });
    const rows = Array.from({ length: rowCount }, (_, i) => {
      const value = i % 2 === 0 ? i : -i;
      return `| r${i} | ${value} |`;
    }).join("\n");

    const largeDoc = `---
mdxtab: "1.0"
tables:
  t:
    key: id
    columns: [id, value]
    types:
      value: number
    aggregates:
      low: min(value)
      high: max(value)
---

## t
| id | value |
|----|-------|
${rows}
`;

    try {
      const result = compileMdxtab(largeDoc);

      expect(result.tables.t.rows).toHaveLength(rowCount);
      expect(result.tables.t.aggregates.low).toBe(-(rowCount - 1));
      expect(result.tables.t.aggregates.high).toBe(rowCount - 2);
    } finally {
      minSpy.mockRestore();
      maxSpy.mockRestore();
    }
  });

  it("supports tables whose names would otherwise mutate object prototypes", () => {
    const protoDoc = `---
mdxtab: "1.0"
tables:
  __proto__:
    key: id
    columns: [id, net]
    types:
      net: number
    aggregates:
      total_net: sum(net)
---

## __proto__
| id | net |
|----|-----|
| h1 | 100 |
| h2 | 200 |

Summary: {{ __proto__.total_net }}
`;

    const result = compileMdxtab(protoDoc);

    expect(result.frontmatter.tables["__proto__"].columns).toEqual(["id", "net"]);
    expect(result.tables["__proto__"].rows).toHaveLength(2);
    expect(result.tables["__proto__"].aggregates.total_net).toBe(300);
    expect(result.rendered).toContain("Summary: 300");
  });

  it("fails when markdown headers do not match schema", () => {
    const badDoc = doc.replace("category", "cat");
    expect(() => compileMdxtab(badDoc)).toThrow();
  });

  it("omits frontmatter when requested", () => {
    const result = compileMdxtab(doc, { includeFrontmatter: false });
    expect(result.rendered.startsWith("---"))
      .toBe(false);
    expect(result.rendered).toContain("Summary: 300 / 40");
  });

  it("does not interpolate inside inline code", () => {
    const docWithInline = `${doc}
Inline: \`{{ expenses.total_net }}\``;
    const result = compileMdxtab(docWithInline);
    expect(result.rendered).toContain("Summary: 300 / 40");
    expect(result.rendered).toContain("Inline: `{{ expenses.total_net }}`");
  });

  it("rejects tab characters in data cells", () => {
    const badDoc = doc.replace("| h1 | Hosting  | 100 |", "| h1 | Hosting\t | 100 |");
    expect(() => compileMdxtab(badDoc)).toThrow(/Tab characters are not allowed/);
  });

  it("rejects rows with mismatched column counts", () => {
    const badDoc = doc.replace("| a1 | Ads      | 200 |", "| a1 | Ads |");
    expect(() => compileMdxtab(badDoc)).toThrow(/different number of columns/);
  });

  it("accepts time-typed columns and hours()", () => {
    const timeDoc = `---
mdxtab: "1.0"
tables:
  time_entries:
    key: id
    columns: [id, start, end, break, duration]
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
| id | start | end  | break | duration |
|----|-------|------|-------|----------|
| e1 | 09:00 | 17:30| 00:30 |          |
| e2 | 10:00 | 18:00| 01:00 |          |
`;
    const result = compileMdxtab(timeDoc);
    const rows = result.tables.time_entries.rows;
    expect(rows.map((r) => r.duration)).toEqual([8, 7]);
    expect(result.tables.time_entries.aggregates.total_hours).toBe(15);
  });

  it("computes grouped aggregates", () => {
    const groupedDoc = `---
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
---

## time_entries
| id | project | start | end  | break | duration |
|----|---------|-------|------|-------|----------|
| e1 | Alpha   | 09:00 | 17:30| 00:30 |          |
| e2 | Beta    | 10:00 | 18:00| 01:00 |          |
| e3 | Alpha   | 08:30 | 16:00| 00:30 |          |

Summary: {{ time_entries.hours_by_project[Alpha] }} / {{ time_entries.hours_by_project[Beta] }}
`;
    const result = compileMdxtab(groupedDoc);
    const groups = result.tables.time_entries.groupedAggregates?.hours_by_project;
    expect(groups).toBeDefined();
    expect(groups?.Alpha).toBe(15);
    expect(groups?.Beta).toBe(7);
    expect(result.rendered).toContain("Summary: 15 / 7");
  });

  it("preserves aggregate names that would otherwise mutate object prototypes", () => {
    const groupedDoc = `---
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
      __proto__: sum(duration)
      constructor: sum(duration) by project
---

## time_entries
| id | project | start | end  | break | duration |
|----|---------|-------|------|-------|----------|
| e1 | Alpha   | 09:00 | 17:30| 00:30 |          |
| e2 | Beta    | 10:00 | 18:00| 01:00 |          |
| e3 | Alpha   | 08:30 | 16:00| 00:30 |          |
`;

    const result = compileMdxtab(groupedDoc);

    expect(result.tables.time_entries.aggregates["__proto__"]).toBe(22);
    expect(result.tables.time_entries.groupedAggregates?.["constructor"]?.Alpha).toBe(15);
    expect(result.tables.time_entries.groupedAggregates?.["constructor"]?.Beta).toBe(7);
  });

  it("renders synthetic report tables from source rows and grouped aggregates", () => {
    const reportDoc = `---
mdxtab: "1.0"
tables:
  categories:
    key: id
    columns: [id, label]
  category_opening:
    key: category
    columns: [category, opening_balance]
    types:
      opening_balance: number
    aggregates:
      opening_by_category: sum(opening_balance) by category
  transactions:
    key: id
    columns: [id, category, amount]
    types:
      amount: number
    aggregates:
      total_by_category: sum(amount) by category
report_tables:
  category_balances:
    rows_from: categories
    key: id
    columns: [label, opening, monthly_delta, current]
    cells:
      label: row.label
      opening: category_opening.opening_by_category[row.id]
      monthly_delta: transactions.total_by_category[row.id]
      current: category_opening.opening_by_category[row.id] + transactions.total_by_category[row.id]
---

## categories
| id | label |
|----|-------|
| Utilities | Utilities |
| Electricity | Electricity |

## category_opening
| category | opening_balance |
|----------|-----------------|
| Utilities | 1234.38 |
| Electricity | 740.63 |

## transactions
| id | category | amount |
|----|----------|--------|
| t1 | Utilities | 71.5 |
| t2 | Electricity | -139.37 |

## category_balances
`;

    const result = compileMdxtab(reportDoc);

    expect(result.reportTables.category_balances.rows).toEqual([
      { label: "Utilities", opening: 1234.38, monthly_delta: 71.5, current: 1305.88 },
      { label: "Electricity", opening: 740.63, monthly_delta: -139.37, current: 601.26 },
    ]);
    expect(result.rendered).toContain("| label | opening | monthly_delta | current |");
    expect(result.rendered).toContain("| Utilities | 1234.38 | 71.5 | 1305.88 |");
    expect(result.rendered).toContain("| Electricity | 740.63 | -139.37 | 601.26 |");
  });

  it("escapes report-table header cells that contain markdown table characters", () => {
    const reportDoc = `---
mdxtab: "1.0"
tables:
  categories:
    key: id
    columns: [id, label]
report_tables:
  category_balances:
    rows_from: categories
    columns: ["label|name"]
    cells:
      "label|name": row.label
---

## categories
| id | label |
|----|-------|
| Utilities | Utilities |

## category_balances
`;

    const result = compileMdxtab(reportDoc);

    expect(result.rendered).toContain("| label\\|name |");
    expect(result.rendered).toContain("| Utilities |");
  });

  it("returns diagnostics for invalid report-table row references", () => {
    const badReportDoc = `---
mdxtab: "1.0"
tables:
  categories:
    key: id
    columns: [id, label]
report_tables:
  category_balances:
    rows_from: categories
    columns: [label]
    cells:
      label: row.missing
---

## categories
| id | label |
|----|-------|
| Utilities | Utilities |

## category_balances
`;

    const result = validateMdxtab(badReportDoc);
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0].code).toBe("E_REF");
    expect(result.diagnostics[0].table).toBe("category_balances");
    expect(result.diagnostics[0].column).toBe("label");
    expect(result.diagnostics[0].message).toContain("[report-table]");
  });

  it("keeps report-scope identifiers available when source rows use the same column names", () => {
    const reportDoc = `---
mdxtab: "1.0"
tables:
  categories:
    key: id
    columns: [id, label, transactions]
  transactions:
    key: id
    columns: [id, category, amount]
    types:
      amount: number
    aggregates:
      total_by_category: sum(amount) by category
report_tables:
  category_balances:
    rows_from: categories
    columns: [label, transaction_label, monthly_delta]
    cells:
      label: row.label
      transaction_label: row.transactions
      monthly_delta: transactions.total_by_category[row.id]
---

## categories
| id | label | transactions |
|----|-------|--------------|
| Utilities | Utilities | row value |

## transactions
| id | category | amount |
|----|----------|--------|
| t1 | Utilities | 71.5 |

## category_balances
`;

    const result = compileMdxtab(reportDoc);

    expect(result.reportTables.category_balances.rows).toEqual([
      { label: "Utilities", transaction_label: "row value", monthly_delta: 71.5 },
    ]);
  });

  it("returns diagnostics for invalid report-table rows_from tables", () => {
    const badReportDoc = `---
mdxtab: "1.0"
tables:
  categories:
    key: id
    columns: [id, label]
report_tables:
  category_balances:
    rows_from: missing_table
    columns: [label]
    cells:
      label: row.label
---

## categories
| id | label |
|----|-------|
| Utilities | Utilities |
`;

    const result = validateMdxtab(badReportDoc);
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0].code).toBe("E_FRONTMATTER");
    expect(result.diagnostics[0].table).toBe("category_balances");
    expect(result.diagnostics[0].column).toBe("rows_from");
    expect(result.diagnostics[0].message).toContain("rows_from table missing_table");
  });

  it("returns diagnostics when report-table cells omit prototype-named columns", () => {
    const badReportDoc = `---
mdxtab: "1.0"
tables:
  categories:
    key: id
    columns: [id, label]
report_tables:
  category_balances:
    rows_from: categories
    columns: [label, toString]
    cells:
      label: row.label
---

## categories
| id | label |
|----|-------|
| Utilities | Utilities |

## category_balances
`;

    const result = validateMdxtab(badReportDoc);
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0].code).toBe("E_FRONTMATTER");
    expect(result.diagnostics[0].table).toBe("category_balances");
    expect(result.diagnostics[0].column).toBe("toString");
    expect(result.diagnostics[0].message).toContain("missing expression for column toString");
  });

  it("preserves prototype-named report-table columns in frontmatter cells", () => {
    const reportDoc = `---
mdxtab: "1.0"
tables:
  categories:
    key: id
    columns: [id, label]
report_tables:
  category_balances:
    rows_from: categories
    columns: [label, __proto__]
    cells:
      label: row.label
      __proto__: row.id
---

## categories
| id | label |
|----|-------|
| Utilities | Utilities |

## category_balances
`;

    const result = compileMdxtab(reportDoc);

    expect(result.frontmatter.report_tables?.category_balances.cells["__proto__"]).toBe("row.id");
    expect(result.reportTables.category_balances.rows).toEqual([
      { label: "Utilities", ["__proto__"]: "Utilities" },
    ]);
  });

  it("returns diagnostics for missing grouped aggregate keys in report tables", () => {
    const badReportDoc = `---
mdxtab: "1.0"
tables:
  categories:
    key: id
    columns: [id, label]
  transactions:
    key: id
    columns: [id, category, amount]
    types:
      amount: number
    aggregates:
      total_by_category: sum(amount) by category
report_tables:
  category_balances:
    rows_from: categories
    columns: [label, monthly_delta]
    cells:
      label: row.label
      monthly_delta: transactions.total_by_category[row.id]
---

## categories
| id | label |
|----|-------|
| Utilities | Utilities |
| Missing | Missing |

## transactions
| id | category | amount |
|----|----------|--------|
| t1 | Utilities | 71.5 |

## category_balances
`;

    const result = validateMdxtab(badReportDoc);
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0].code).toBe("E_LOOKUP");
    expect(result.diagnostics[0].table).toBe("category_balances");
    expect(result.diagnostics[0].column).toBe("monthly_delta");
    expect(result.diagnostics[0].message).toContain("[report-table]");
  });

  it("does not inject report tables when the matching heading is absent", () => {
    const reportDoc = `---
mdxtab: "1.0"
tables:
  categories:
    key: id
    columns: [id, label]
report_tables:
  category_balances:
    rows_from: categories
    columns: [label]
    cells:
      label: row.label
---

## categories
| id | label |
|----|-------|
| Utilities | Utilities |
`;

    const result = compileMdxtab(reportDoc);
    expect(result.reportTables.category_balances.rows).toEqual([{ label: "Utilities" }]);
    expect(result.rendered).not.toContain("## category_balances\n| label |");
  });

  it("ignores inherited object property names when matching report-table headings", () => {
    const reportDoc = `---
mdxtab: "1.0"
tables:
  categories:
    key: id
    columns: [id, label]
report_tables:
  category_balances:
    rows_from: categories
    columns: [label]
    cells:
      label: row.label
---

## categories
| id | label |
|----|-------|
| Utilities | Utilities |

## toString

## category_balances
`;

    const result = compileMdxtab(reportDoc);

    expect(result.rendered).toContain("## toString\n\n## category_balances");
    expect(result.rendered).toContain("## category_balances\n\n| label |");
  });

  it("allows report-table names that match object prototype properties", () => {
    const reportDoc = `---
mdxtab: "1.0"
tables:
  categories:
    key: id
    columns: [id, label]
report_tables:
  toString:
    rows_from: categories
    columns: [label]
    cells:
      label: row.label
---

## categories
| id | label |
|----|-------|
| Utilities | Utilities |

## toString
`;

    const result = compileMdxtab(reportDoc);

    expect(result.reportTables["toString"].rows).toEqual([{ label: "Utilities" }]);
    expect(result.rendered).toContain("## toString\n\n| label |");
  });

  it("preserves report-table names that would otherwise mutate object prototypes", () => {
    const reportDoc = `---
mdxtab: "1.0"
tables:
  categories:
    key: id
    columns: [id, label]
report_tables:
  __proto__:
    rows_from: categories
    columns: [label]
    cells:
      label: row.label
---

## categories
| id | label |
|----|-------|
| Utilities | Utilities |

## __proto__
`;

    const result = compileMdxtab(reportDoc);

    expect(result.reportTables["__proto__"].rows).toEqual([{ label: "Utilities" }]);
    expect(result.frontmatter.report_tables?.["__proto__"]?.rows_from).toBe("categories");
    expect(result.rendered).toContain("## __proto__\n\n| label |");
  });

  it("parses pivot_tables with required fields", () => {
    const pivotDoc = `---
mdxtab: "1.0"
tables:
  entries:
    key: id
    columns: [id, date, category, amount]
    types:
      date: date
      amount: number
pivot_tables:
  liquidity:
    source: entries
    rows:
      from: category
    columns:
      from: date
      range:
        start: 2026-04-24
        end: 2026-05-24
        step: day
    value: sum(amount)
---

## entries
| id | date | category | amount |
|----|------|----------|--------|
| e1 | 2026-04-24 | Salary | 100 |
`;

    const validation = validateMdxtab(pivotDoc);
    expect(validation.diagnostics).toHaveLength(0);

    const result = compileMdxtab(pivotDoc);
    expect(result.frontmatter.pivot_tables?.liquidity.source).toBe("entries");
    expect(result.frontmatter.pivot_tables?.liquidity.rows.from).toBe("category");
    expect(result.frontmatter.pivot_tables?.liquidity.columns.from).toBe("date");
    expect(result.frontmatter.pivot_tables?.liquidity.columns.range?.start).toBe("2026-04-24");
  });

  it("normalizes pivot_tables rows.from and columns.from after validation", () => {
    const pivotDoc = `---
mdxtab: "1.0"
tables:
  entries:
    key: id
    columns: [id, date, category, amount]
    types:
      date: date
      amount: number
pivot_tables:
  liquidity:
    source: entries
    rows:
      from: "  category  "
    columns:
      from: "  entries . date  "
      range:
        start: 2026-04-24
        end: 2026-05-24
        step: day
    value: sum(amount)
---

## entries
| id | date | category | amount |
|----|------|----------|--------|
| e1 | 2026-04-24 | Salary | 100 |
`;

    const validation = validateMdxtab(pivotDoc);
    expect(validation.diagnostics).toHaveLength(0);

    const result = compileMdxtab(pivotDoc);
    expect(result.frontmatter.pivot_tables?.liquidity.rows.from).toBe("category");
    expect(result.frontmatter.pivot_tables?.liquidity.columns.from).toBe("date");
  });

  it("returns frontmatter diagnostics when pivot_tables is missing required fields", () => {
    const badPivotDoc = `---
mdxtab: "1.0"
tables:
  entries:
    key: id
    columns: [id, date, category, amount]
pivot_tables:
  liquidity:
    source: entries
    columns:
      from: date
    value: sum(amount)
---

## entries
| id | date | category | amount |
|----|------|----------|--------|
| e1 | 2026-04-24 | Salary | 100 |
`;

    const result = validateMdxtab(badPivotDoc);
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0].code).toBe("E_FRONTMATTER");
    expect(result.diagnostics[0].message).toContain("rows is required");
  });

  it("returns frontmatter diagnostics when pivot_tables source or axis references are invalid", () => {
    const badPivotDoc = `---
mdxtab: "1.0"
tables:
  entries:
    key: id
    columns: [id, date, category, amount]
pivot_tables:
  liquidity:
    source: entries
    rows:
      from: missing_col
    columns:
      from: date
    value: sum(amount)
---

## entries
| id | date | category | amount |
|----|------|----------|--------|
| e1 | 2026-04-24 | Salary | 100 |
`;

    const result = validateMdxtab(badPivotDoc);
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0].code).toBe("E_FRONTMATTER");
    expect(result.diagnostics[0].message).toContain("rows.from references unknown column");
  });

  it("returns frontmatter diagnostics when pivot_tables range start is after end", () => {
    const badPivotDoc = `---
mdxtab: "1.0"
tables:
  entries:
    key: id
    columns: [id, date, category, amount]
pivot_tables:
  liquidity:
    source: entries
    rows:
      from: category
    columns:
      from: date
      range:
        start: 2026-05-24
        end: 2026-04-24
        step: day
    value: sum(amount)
---

## entries
| id | date | category | amount |
|----|------|----------|--------|
| e1 | 2026-04-24 | Salary | 100 |
`;

    const result = validateMdxtab(badPivotDoc);
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0].code).toBe("E_FRONTMATTER");
    expect(result.diagnostics[0].message).toContain("start must be before or equal");
  });

  it("returns frontmatter diagnostics for invalid pivot_tables range step", () => {
    const badPivotDoc = `---
mdxtab: "1.0"
tables:
  entries:
    key: id
    columns: [id, date, category, amount]
pivot_tables:
  liquidity:
    source: entries
    rows:
      from: category
    columns:
      from: date
      range:
        start: 2026-04-24
        end: 2026-05-24
        step: quarter
    value: sum(amount)
---

## entries
| id | date | category | amount |
|----|------|----------|--------|
| e1 | 2026-04-24 | Salary | 100 |
`;

    const result = validateMdxtab(badPivotDoc);
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0].code).toBe("E_FRONTMATTER");
    expect(result.diagnostics[0].message).toContain("columns.range.step must be one of day, week, month");
  });

  it("returns frontmatter diagnostics for invalid pivot_tables empty_cells", () => {
    const badPivotDoc = `---
mdxtab: "1.0"
tables:
  entries:
    key: id
    columns: [id, date, category, amount]
pivot_tables:
  liquidity:
    source: entries
    rows:
      from: category
    columns:
      from: date
      range:
        start: 2026-04-24
        end: 2026-05-24
        step: day
    value: sum(amount)
    empty_cells: nope
---

## entries
| id | date | category | amount |
|----|------|----------|--------|
| e1 | 2026-04-24 | Salary | 100 |
`;

    const result = validateMdxtab(badPivotDoc);
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0].code).toBe("E_FRONTMATTER");
    expect(result.diagnostics[0].message).toContain("Invalid empty_cells value");
  });

  it("returns frontmatter diagnostics for pivot_tables key not in source columns", () => {
    const badPivotDoc = `---
mdxtab: "1.0"
tables:
  entries:
    key: id
    columns: [id, date, category, amount]
pivot_tables:
  liquidity:
    source: entries
    key: missing_key
    rows:
      from: category
    columns:
      from: date
      range:
        start: 2026-04-24
        end: 2026-05-24
        step: day
    value: sum(amount)
---

## entries
| id | date | category | amount |
|----|------|----------|--------|
| e1 | 2026-04-24 | Salary | 100 |
`;

    const result = validateMdxtab(badPivotDoc);
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0].code).toBe("E_FRONTMATTER");
    expect(result.diagnostics[0].message).toContain("key missing_key is not a column");
  });

  it("returns frontmatter diagnostics for invalid pivot_tables totals.column mode", () => {
    const badPivotDoc = `---
mdxtab: "1.0"
tables:
  entries:
    key: id
    columns: [id, date, category, amount]
pivot_tables:
  liquidity:
    source: entries
    rows:
      from: category
    columns:
      from: date
      range:
        start: 2026-04-24
        end: 2026-05-24
        step: day
    value: sum(amount)
    totals:
      column:
        accumulated:
          mode: rolling
---

## entries
| id | date | category | amount |
|----|------|----------|--------|
| e1 | 2026-04-24 | Salary | 100 |
`;

    const result = validateMdxtab(badPivotDoc);
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0].code).toBe("E_FRONTMATTER");
    expect(result.diagnostics[0].column).toBe("totals.column.accumulated.mode");
    expect(result.diagnostics[0].message).toContain("totals.column.accumulated.mode must be one of sum, running_sum");
  });

  it("returns frontmatter diagnostics for non-ISO pivot_tables range start", () => {
    const badPivotDoc = `---
mdxtab: "1.0"
tables:
  entries:
    key: id
    columns: [id, date, category, amount]
pivot_tables:
  liquidity:
    source: entries
    rows:
      from: category
    columns:
      from: date
      range:
        start: 2026-4-24
        end: 2026-05-24
        step: day
    value: sum(amount)
---

## entries
| id | date | category | amount |
|----|------|----------|--------|
| e1 | 2026-04-24 | Salary | 100 |
`;

    const result = validateMdxtab(badPivotDoc);
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0].code).toBe("E_FRONTMATTER");
    expect(result.diagnostics[0].message).toContain("columns.range.start must be an ISO date");
  });

  it("returns frontmatter diagnostics for non-ISO pivot_tables range end", () => {
    const badPivotDoc = `---
mdxtab: "1.0"
tables:
  entries:
    key: id
    columns: [id, date, category, amount]
pivot_tables:
  liquidity:
    source: entries
    rows:
      from: category
    columns:
      from: date
      range:
        start: 2026-04-24
        end: 2026-5-24
        step: day
    value: sum(amount)
---

## entries
| id | date | category | amount |
|----|------|----------|--------|
| e1 | 2026-04-24 | Salary | 100 |
`;

    const result = validateMdxtab(badPivotDoc);
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0].code).toBe("E_FRONTMATTER");
    expect(result.diagnostics[0].message).toContain("columns.range.end must be an ISO date");
  });

  it("accepts pivot_tables date ranges with years below 0100", () => {
    const pivotDoc = `---
mdxtab: "1.0"
tables:
  entries:
    key: id
    columns: [id, date, category, amount]
pivot_tables:
  liquidity:
    source: entries
    rows:
      from: category
    columns:
      from: date
      range:
        start: 0099-01-01
        end: 0099-01-02
        step: day
    value: sum(amount)
---

## entries
| id | date | category | amount |
|----|------|----------|--------|
| e1 | 2026-04-24 | Salary | 100 |
`;

    const result = validateMdxtab(pivotDoc);
    expect(result.diagnostics).toHaveLength(0);
  });

  it("does not fail when a manual markdown table exists under a pivot heading", () => {
    const pivotDoc = `---
mdxtab: "1.0"
tables:
  entries:
    key: id
    columns: [id, date, category, amount]
pivot_tables:
  liquidity:
    source: entries
    rows:
      from: category
    columns:
      from: date
      range:
        start: 2026-04-24
        end: 2026-05-24
        step: day
    value: sum(amount)
---

## entries
| id | date | category | amount |
|----|------|----------|--------|
| e1 | 2026-04-24 | Salary | 100 |

## liquidity
| stale | old |
|-------|-----|
| 1     | 2   |
`;

    const validation = validateMdxtab(pivotDoc);
    expect(validation.diagnostics).toHaveLength(0);

    const result = compileMdxtab(pivotDoc);
    expect(result.rendered).toContain("## liquidity");
  });

  it("evaluates pivot tables with range columns, row totals, and running footer", () => {
    const pivotDoc = `---
mdxtab: "1.0"
tables:
  entries:
    key: id
    columns: [id, date, category, amount]
    types:
      date: date
      amount: number
pivot_tables:
  liquidity:
    source: entries
    rows:
      from: category
      order: [Salary, Food]
    columns:
      from: date
      range:
        start: 2026-04-24
        end: 2026-04-25
        step: day
    value: sum(amount)
    empty_cells: zero
    totals:
      row: summary
      column:
        accumulated:
          mode: running_sum
---

## entries
| id | date | category | amount |
|----|------|----------|--------|
| e1 | 2026-04-24 | Salary | 100 |
| e2 | 2026-04-24 | Salary | 50 |
| e3 | 2026-04-25 | Food | -30 |
| e4 | 2026-04-25 | Salary | 20 |
`;

    const result = compileMdxtab(pivotDoc);
    const pivot = result.pivotTables.liquidity;

    expect(pivot.rowAxis.map((r) => r.key)).toEqual(["Salary", "Food"]);
    expect(pivot.columnAxis.map((c) => c.key)).toEqual(["2026-04-24", "2026-04-25"]);

    expect(pivot.rows[0].values["2026-04-24"]).toBe(150);
    expect(pivot.rows[0].values["2026-04-25"]).toBe(20);
    expect(pivot.rows[0].total).toBe(170);

    expect(pivot.rows[1].values["2026-04-24"]).toBe(0);
    expect(pivot.rows[1].values["2026-04-25"]).toBe(-30);
    expect(pivot.rows[1].total).toBe(-30);

    expect(pivot.footerRows?.[0].key).toBe("accumulated");
    expect(pivot.footerRows?.[0].values["2026-04-24"]).toBe(150);
    expect(pivot.footerRows?.[0].values["2026-04-25"]).toBe(140);
    expect(pivot.footerRows?.[0].total).toBe(290);
  });

  it("derives pivot row axis from another table in authored order", () => {
    const pivotDoc = `---
mdxtab: "1.0"
tables:
  categories:
    key: id
    columns: [id, category]
  entries:
    key: id
    columns: [id, date, category, amount]
    types:
      date: date
      amount: number
pivot_tables:
  liquidity:
    source: entries
    rows:
      from: categories.category
    columns:
      from: date
      range:
        start: 2026-04-24
        end: 2026-04-24
        step: day
    value: sum(amount)
    empty_cells: zero
---

## categories
| id | category |
|----|----------|
| c1 | Travel |
| c2 | Salary |
| c3 | Food |

## entries
| id | date | category | amount |
|----|------|----------|--------|
| e1 | 2026-04-24 | Salary | 100 |
| e2 | 2026-04-24 | Food | -30 |
`;

    const result = compileMdxtab(pivotDoc);
    const pivot = result.pivotTables.liquidity;

    expect(pivot.rowAxis.map((r) => r.key)).toEqual(["Travel", "Salary", "Food"]);
    expect(pivot.rows[0].values["2026-04-24"]).toBe(0);
    expect(pivot.rows[1].values["2026-04-24"]).toBe(100);
    expect(pivot.rows[2].values["2026-04-24"]).toBe(-30);
  });

  it("does not remove prose after an existing report table when the prose contains pipes", () => {
    const reportDoc = `---
mdxtab: "1.0"
tables:
  categories:
    key: id
    columns: [id, label]
report_tables:
  category_balances:
    rows_from: categories
    columns: [label]
    cells:
      label: row.label
---

## categories
| id | label |
|----|-------|
| Utilities | Utilities |

## category_balances
| stale |
|-------|
| old |

Use A | B notation in prose after the table.
`;

    const result = compileMdxtab(reportDoc);
    expect(result.rendered).toContain("## category_balances\n| label |\n|-------|\n| Utilities |");
    expect(result.rendered).toContain("Use A | B notation in prose after the table.");
  });

  it("does not treat prose plus a separator line as an existing markdown table", () => {
    const reportDoc = `---
mdxtab: "1.0"
tables:
  categories:
    key: id
    columns: [id, label]
report_tables:
  category_balances:
    rows_from: categories
    columns: [label]
    cells:
      label: row.label
---

## categories
| id | label |
|----|-------|
| Utilities | Utilities |

## category_balances
Alpha | Beta
|------|------|
This prose should remain.
`;

    const result = compileMdxtab(reportDoc);

    expect(result.rendered).toContain("## category_balances\n| label |\n|-------|\n| Utilities |\nAlpha | Beta");
    expect(result.rendered).toContain("|------|------|");
    expect(result.rendered).toContain("This prose should remain.");
  });

  it("does not treat a separator-like line without outer pipes as an existing markdown table", () => {
    const reportDoc = `---
mdxtab: "1.0"
tables:
  categories:
    key: id
    columns: [id, label]
report_tables:
  category_balances:
    rows_from: categories
    columns: [label]
    cells:
      label: row.label
---

## categories
| id | label |
|----|-------|
| Utilities | Utilities |

## category_balances
| stale |
 ------ |
This prose should remain.
`;

    const result = compileMdxtab(reportDoc);

    expect(result.rendered).toContain("## category_balances\n| label |\n|-------|\n| Utilities |\n| stale |\n ------ |");
    expect(result.rendered).toContain("This prose should remain.");
  });

  it("renders report tables whose names include non-identifier heading text", () => {
    const reportDoc = `---
mdxtab: "1.0"
tables:
  categories:
    key: id
    columns: [id, label]
report_tables:
  category-balances:
    rows_from: categories
    columns: [label]
    cells:
      label: row.label
---

## categories
| id | label |
|----|-------|
| Utilities | Utilities |

## category-balances
`;

    const result = compileMdxtab(reportDoc);
    expect(result.reportTables["category-balances"].rows).toEqual([{ label: "Utilities" }]);
    expect(result.rendered).toContain("## category-balances\n\n| label |\n|-------|\n| Utilities |");
  });

  it("reports diagnostics for invalid grouped aggregates", () => {
    const badGroupedDoc = `---
mdxtab: "1.0"
tables:
  time_entries:
    key: id
    columns: [id, project, duration]
    types:
      duration: number
    aggregates:
      hours_by_project: sum(duration) by missing_col
---

## time_entries
| id | project | duration |
|----|---------|----------|
| e1 | Alpha   | 1 |
`;
    const result = validateMdxtab(badGroupedDoc);
    expect(result.diagnostics).toHaveLength(1);
    const diag = result.diagnostics[0];
    expect(diag.code).toBe("E_REF");
    expect(diag.table).toBe("time_entries");
    expect(diag.aggregate).toBe("hours_by_project");
  });

  it("returns diagnostics with aggregate context", () => {
    const badDoc = doc.replace("{{ expenses.total_net }}", "{{ expenses.missing }}");
    const result = validateMdxtab(badDoc);
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0].code).toBe("E_AGG_REF");
    expect(result.diagnostics[0].table).toBe("expenses");
    expect(result.diagnostics[0].aggregate).toBe("missing");
  });

  it("returns structured diagnostics for common failures", () => {
    const missingFrontmatter = "# No frontmatter\n\n| a | b |\n|---|---|\n| 1 | 2 |\n";
    const frontmatterResult = validateMdxtab(missingFrontmatter);
    expect(frontmatterResult.diagnostics).toEqual([
      expect.objectContaining({
        code: "E_FRONTMATTER",
        severity: "error",
      }),
    ]);

    const tabDoc = doc.replace("| h1 | Hosting  | 100 |", "| h1 | Hosting\t | 100 |");
    const tabResult = validateMdxtab(tabDoc);
    expect(tabResult.diagnostics).toEqual([
      expect.objectContaining({
        code: "E_TABLE_TAB",
        severity: "error",
        range: expect.any(Object),
      }),
    ]);

    const headerMismatch = doc.replace("| id | category | net |", "| id | cat | net |");
    const headerResult = validateMdxtab(headerMismatch);
    expect(headerResult.diagnostics).toEqual([
      expect.objectContaining({
        code: "E_COLUMN_MISMATCH",
        severity: "error",
        table: "expenses",
        column: "category",
        range: expect.any(Object),
      }),
    ]);

    const keyMissing = doc.replace("key: id", "key: row_id");
    const keyResult = validateMdxtab(keyMissing);
    expect(keyResult.diagnostics).toEqual([
      expect.objectContaining({
        code: "E_KEY_COLUMN",
        severity: "error",
        table: "rates",
        column: "row_id",
        range: expect.any(Object),
      }),
    ]);
  });

  it("returns contextual diagnostics for computed expression limit failures", () => {
    const deepExpression = "-".repeat(300) + "1";
    const limitedDoc = `---
mdxtab: "1.0"
tables:
  t:
    key: id
    columns: [id, value]
    types:
      value: number
    computed:
      limited: ${deepExpression}
---

## t
| id | value |
|----|-------|
| a  | 1     |
`;
    const result = validateMdxtab(limitedDoc);
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0].code).toBe("E_LIMIT");
    expect(result.diagnostics[0].table).toBe("t");
    expect(result.diagnostics[0].column).toBe("limited");
    expect(result.diagnostics[0].message).toContain("[computed]");
  });

  it("returns contextual diagnostics for aggregate expression limit failures", () => {
    const longAggregate = Array.from({ length: 260 }, () => "value").join(" + ");
    const limitedDoc = `---
mdxtab: "1.0"
tables:
  t:
    key: id
    columns: [id, value]
    types:
      value: number
    aggregates:
      too_big: ${longAggregate}
---

## t
| id | value |
|----|-------|
| a  | 1     |
`;
    const result = validateMdxtab(limitedDoc);
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0].code).toBe("E_LIMIT");
    expect(result.diagnostics[0].table).toBe("t");
    expect(result.diagnostics[0].aggregate).toBe("too_big");
    expect(result.diagnostics[0].message).toContain("[aggregate]");
  });

  it("returns contextual diagnostics for non-finite aggregate failures", () => {
    const huge = `1${"0".repeat(308)}`;
    const overflowDoc = `---
mdxtab: "1.0"
tables:
  t:
    key: id
    columns: [id, value]
    types:
      value: number
    aggregates:
      total: sum(value)
---

## t
| id | value |
|----|-------|
| a  | ${huge} |
| b  | ${huge} |
`;
    const result = validateMdxtab(overflowDoc);
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0].code).toBe("E_NUMBER");
    expect(result.diagnostics[0].table).toBe("t");
    expect(result.diagnostics[0].aggregate).toBe("total");
    expect(result.diagnostics[0].message).toContain("[aggregate]");
  });

  it("returns contextual diagnostics for dependency-depth failures", () => {
    const computedLines: string[] = [];
    for (let i = 130; i >= 1; i -= 1) {
      computedLines.push(`      c${i}: c${i - 1} + 1`);
    }
    computedLines.push("      c0: value");

    const limitedDoc = `---
mdxtab: "1.0"
tables:
  t:
    key: id
    columns: [id, value]
    types:
      value: number
    computed:
${computedLines.join("\n")}
---

## t
| id | value |
|----|-------|
| a  | 1     |
`;
    const result = validateMdxtab(limitedDoc);
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0].code).toBe("E_LIMIT");
    expect(result.diagnostics[0].table).toBe("t");
    expect(result.diagnostics[0].column).toBe("c2");
    expect(result.diagnostics[0].message).toContain("[dependency]");
  });

  it("returns contextual diagnostics for non-finite arithmetic failures", () => {
    const huge = `1${"0".repeat(160)}`;
    const overflowDoc = `---
mdxtab: "1.0"
tables:
  t:
    key: id
    columns: [id]
    computed:
      total: >
        ${huge} *
        ${huge}
---

## t
| id |
|----|
| x  |
`;
    const result = validateMdxtab(overflowDoc);
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0].code).toBe("E_NUMBER");
    expect(result.diagnostics[0].table).toBe("t");
    expect(result.diagnostics[0].column).toBe("total");
    expect(result.diagnostics[0].message).toContain("[computed]");
  });

  it("returns E_NUMBER diagnostics for non-finite numeric cell values", () => {
    const huge = "9".repeat(400);
    const overflowDoc = `---
mdxtab: "1.0"
tables:
  t:
    key: id
    columns: [id, amount]
    types:
      amount: number
---

## t
| id | amount |
|----|--------|
| x  | ${huge} |
`;
    const result = validateMdxtab(overflowDoc);
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0].code).toBe("E_NUMBER");
    expect(result.diagnostics[0].table).toBe("t");
    expect(result.diagnostics[0].column).toBe("amount");
  });

  it("allows parse-depth limits to be overridden via compile options", () => {
    const deepExpression = "(".repeat(300) + "1" + ")".repeat(300);
    const limitedDoc = `---
mdxtab: "1.0"
tables:
  t:
    key: id
    columns: [id, value]
    types:
      value: number
    computed:
      limited: ${deepExpression}
---

## t
| id | value |
|----|-------|
| a  | 1     |
`;
    const result = validateMdxtab(limitedDoc, {
      expressionLimits: {
        maxTokens: 1024,
        maxParseDepth: 512,
      },
    });
    expect(result.diagnostics).toEqual([]);
  });

  it("reports cell ranges with indentation offsets", () => {
    const dataLine = "  | a1 | abc |";
    const indentedDoc = `---
mdxtab: "1.0"
tables:
  rates:
    key: id
    columns: [id, rate]
    types:
      rate: number
---

## rates
  | id | rate |
  |----|------|
${dataLine}
`;
    const result = validateMdxtab(indentedDoc);
    expect(result.diagnostics).toHaveLength(1);
    const diag = result.diagnostics[0];
    expect(diag.code).toBe("E_TYPE");
    expect(diag.range).toBeDefined();

    const lines = indentedDoc.replace(/\r\n?/g, "\n").split("\n");
    const lineIndex = lines.findIndex((line) => line === dataLine);
    const firstPipe = dataLine.indexOf("|");
    const secondPipe = dataLine.indexOf("|", firstPipe + 1);
    const thirdPipe = dataLine.indexOf("|", secondPipe + 1);
    const expectedStart = secondPipe + 1;
    const expectedEnd = thirdPipe;

    expect(diag.range?.start.line).toBe(lineIndex);
    expect(diag.range?.start.character).toBe(expectedStart);
    expect(diag.range?.end.character).toBe(expectedEnd);
  });
});

describe("computed column preview rendering", () => {
  const singleComputedDoc = `---
mdxtab: "1.0"
tables:
  expenses:
    key: id
    columns: [id, net]
    types:
      net: number
    computed:
      tax: net * 0.2
---

## expenses
| id | net |
|----|-----|
| h1 | 100 |
| a1 | 200 |
`;

  it("appends one computed column when includeComputedColumns is true", () => {
    const result = compileMdxtab(singleComputedDoc, { includeComputedColumns: true });
    expect(result.rendered).toContain("| id | net | tax |");
    expect(result.rendered).toContain("| h1 | 100 | 20 |");
    expect(result.rendered).toContain("| a1 | 200 | 40 |");
  });

  it("appends multiple computed columns in declaration order", () => {
    const multiDoc = `---
mdxtab: "1.0"
tables:
  items:
    key: id
    columns: [id, price, qty]
    types:
      price: number
      qty: number
    computed:
      subtotal: price * qty
      tax: price * qty * 0.1
---

## items
| id | price | qty |
|----|-------|-----|
| a  | 10    | 2   |
| b  | 5     | 4   |
`;
    const result = compileMdxtab(multiDoc, { includeComputedColumns: true });
    expect(result.rendered).toContain("| id | price | qty | subtotal | tax |");
    expect(result.rendered).toContain("| a  | 10    | 2   | 20 | 2 |");
    expect(result.rendered).toContain("| b  | 5     | 4   | 20 | 2 |");
  });

  it("renders empty cell for null computed values", () => {
    const nullDoc = `---
mdxtab: "1.0"
tables:
  data:
    key: id
    columns: [id, val]
    empty_cells: "null"
    computed:
      doubled: val * 2
---

## data
| id | val |
|----|-----|
| a  | 5   |
| b  |     |
`;
    const result = compileMdxtab(nullDoc, { includeComputedColumns: true });
    // Row "a" gets 10, row "b" gets null → empty
    expect(result.rendered).toContain("| a  | 5   | 10 |");
    expect(result.rendered).toContain("| b  |     |  |");
  });

  it("does not change rendered output when no computed columns exist", () => {
    const noComputedDoc = `---
mdxtab: "1.0"
tables:
  items:
    key: id
    columns: [id, name]
---

## items
| id | name |
|----|------|
| a  | Foo  |
`;
    const withFlag = compileMdxtab(noComputedDoc, { includeComputedColumns: true });
    const without = compileMdxtab(noComputedDoc, { includeComputedColumns: false });
    expect(withFlag.rendered).toBe(without.rendered);
  });

  it("does not duplicate column when computed name matches authored header", () => {
    // "duration" appears both as an authored header and a computed column
    const dupeDoc = `---
mdxtab: "1.0"
tables:
  time_entries:
    key: id
    columns: [id, start, end, break, duration]
    types:
      start: time
      end: time
      break: time
      duration: number
    computed:
      duration: hours(end) - hours(start) - hours(break)
---

## time_entries
| id | start | end  | break | duration |
|----|-------|------|-------|----------|
| e1 | 09:00 | 17:30| 00:30 |          |
`;
    const result = compileMdxtab(dupeDoc, { includeComputedColumns: true });
    // Should NOT have "duration" appended a second time
    const headerLine = result.rendered.split("\n").find((l) => l.includes("| id |"));
    const count = (headerLine?.match(/duration/g) ?? []).length;
    expect(count).toBe(1);
    // But the empty cell should be filled with the computed value
    expect(result.rendered).toContain("8");
  });

  it("fills in authored empty cells with computed values", () => {
    const inlineDoc = `---
mdxtab: "1.0"
tables:
  items:
    key: id
    columns: [id, price, qty, total]
    types:
      price: number
      qty: number
      total: number
    computed:
      total: price * qty
---

## items
| id | price | qty | total |
|----|-------|-----|-------|
| a  | 10    | 3   |       |
| b  | 5     | 4   |       |
`;
    const result = compileMdxtab(inlineDoc, { includeComputedColumns: true });
    expect(result.rendered).toContain(" 30 ");
    expect(result.rendered).toContain(" 20 ");
    // Header count should still be 1
    const header = result.rendered.split("\n").find((l) => l.includes("| id |"));
    expect((header?.match(/total/g) ?? []).length).toBe(1);
  });

  it("fills multiple inline computed columns in the same row without corruption", () => {
    const multiInlineDoc = `---
mdxtab: "1.0"
tables:
  items:
    key: id
    columns: [id, price, qty, subtotal, tax]
    types:
      price: number
      qty: number
      subtotal: number
      tax: number
    computed:
      subtotal: price * qty
      tax: price * qty * 0.1
---

## items
| id | price | qty | subtotal | tax |
|----|-------|-----|----------|-----|
| a  | 10    | 2   |          |     |
| b  | 5     | 4   |          |     |
`;
    const result = compileMdxtab(multiInlineDoc, { includeComputedColumns: true });
    const lines = result.rendered.split("\n");
    const rowA = lines.find((l) => l.includes("| a "));
    const rowB = lines.find((l) => l.includes("| b "));
    expect(rowA).toContain(" 20 ");
    expect(rowA).toContain(" 2 ");
    expect(rowB).toContain(" 20 ");
    expect(rowB).toContain(" 2 ");
    // Ensure the row isn't corrupted — should still have the right number of pipes
    const pipeCountA = (rowA?.match(/\|/g) ?? []).length;
    expect(pipeCountA).toBe(6); // | id | price | qty | subtotal | tax |
  });

  it("preserves non-empty authored cells and only fills empty ones", () => {
    const mixedDoc = `---
mdxtab: "1.0"
tables:
  items:
    key: id
    columns: [id, price, qty, total]
    types:
      price: number
      qty: number
      total: number
    computed:
      total: price * qty
---

## items
| id | price | qty | total |
|----|-------|-----|-------|
| a  | 10    | 3   |       |
| b  | 5     | 4   | 999   |
`;
    const result = compileMdxtab(mixedDoc, { includeComputedColumns: true });
    const lines = result.rendered.split("\n");
    const rowA = lines.find((l) => l.includes("| a "));
    const rowB = lines.find((l) => l.includes("| b "));
    // Row a has empty cell → filled with computed value 30
    expect(rowA).toContain(" 30 ");
    // Row b has authored value 999 → preserved, NOT overwritten with 20
    expect(rowB).toContain("999");
    expect(rowB).not.toContain(" 20 ");
  });

  it("does not inject computed columns when includeComputedColumns is false", () => {
    const withFlag = compileMdxtab(singleComputedDoc, { includeComputedColumns: true });
    const without = compileMdxtab(singleComputedDoc, { includeComputedColumns: false });
    expect(withFlag.rendered).toContain("| tax |");
    expect(without.rendered).not.toContain("| tax |");
  });

  it("defaults to not injecting computed columns (backward compat)", () => {
    const result = compileMdxtab(singleComputedDoc);
    expect(result.rendered).not.toContain("| tax |");
  });

  it("formats numeric values cleanly without floating-point noise", () => {
    const fpDoc = `---
mdxtab: "1.0"
tables:
  items:
    key: id
    columns: [id, a, b]
    types:
      a: number
      b: number
    computed:
      total: a + b
---

## items
| id | a   | b   |
|----|-----|-----|
| x  | 0.1 | 0.2 |
`;
    const result = compileMdxtab(fpDoc, { includeComputedColumns: true });
    // 0.1 + 0.2 should render as "0.3", not "0.30000000000000004"
    expect(result.rendered).toContain("| x  | 0.1 | 0.2 | 0.3 |");
  });
});

describe("summary row preview rendering", () => {
  const baseSummaryDoc = `---
mdxtab: "1.0"
tables:
  expenses:
    key: category
    columns: [category, p1, p2, p3, row_total]
    empty_cells: zero
    types:
      p1: number
      p2: number
      p3: number
      row_total: number
    computed:
      row_total: p1 + p2 + p3
    summary_rows:
      running_balance:
        label: Running Balance
        cells:
          p1: sum(p1)
          p2: self.p1 + sum(p2)
          p3: self.p2 + sum(p3)
---

## expenses
| category    | p1   | p2   | p3   | row_total |
|-------------|------|------|------|-----------|
| Salary      | 1000 |      |      |           |
| Electricity |      | -100 |      |           |
| Food        | -10  |      | -10  |           |
`;

  it("renders running balance with cumulative self references", () => {
    const result = compileMdxtab(baseSummaryDoc, {
      includeComputedColumns: true,
      includeSummaryRows: true,
    });
    expect(result.rendered).toContain("| Running Balance | 990 | 890 | 880 |");
  });

  it("renders simple sum summary rows", () => {
    const sumDoc = `---
mdxtab: "1.0"
tables:
  t:
    key: category
    columns: [category, p1, p2]
    empty_cells: zero
    types:
      p1: number
      p2: number
    summary_rows:
      totals:
        label: Totals
        cells:
          p1: sum(p1)
          p2: sum(p2)
---

## t
| category | p1 | p2 |
|----------|----|----|
| A        | 1  |    |
| B        |    | 2  |
`;
    const result = compileMdxtab(sumDoc, { includeSummaryRows: true });
    expect(result.rendered).toContain("| Totals | 1 | 2 |");
  });

  it("treats null and empty numeric inputs as zero for sum-based summary rows", () => {
    const nullDoc = `---
mdxtab: "1.0"
tables:
  t:
    key: id
    columns: [id, p1]
    empty_cells: "null"
    types:
      p1: number
    summary_rows:
      totals:
        label: Totals
        cells:
          p1: sum(p1)
---

## t
| id | p1 |
|----|----|
| a  |    |
| b  | 3  |
| c  |    |
`;
    const result = compileMdxtab(nullDoc, { includeSummaryRows: true });
    expect(result.rendered).toContain("| Totals | 3 |");
  });

  it("coexists with computed row_total column", () => {
    const result = compileMdxtab(baseSummaryDoc, {
      includeComputedColumns: true,
      includeSummaryRows: true,
    });
    expect(result.rendered).toContain("| Salary      | 1000 |      |      | 1000 |");
    expect(result.rendered).toContain("| Electricity |      | -100 |      | -100 |");
    expect(result.rendered).toContain("| Food        | -10  |      | -10  | -20 |");
    // row_total column exists and summary row leaves it empty unless explicitly set
    expect(result.rendered).toContain("| Running Balance | 990 | 890 | 880 | |");
  });

  it("emits diagnostic for forward self reference", () => {
    const badDoc = `---
mdxtab: "1.0"
tables:
  t:
    key: id
    columns: [id, p1, p2]
    empty_cells: zero
    types:
      p1: number
      p2: number
    summary_rows:
      rb:
        label: RB
        cells:
          p2: self.p1 + sum(p2)
          p1: sum(p1)
---

## t
| id | p1 | p2 |
|----|----|----|
| a  | 1  | 2  |
`;
    const result = validateMdxtab(badDoc, { includeSummaryRows: true });
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0].code).toBe("E_REF");
    expect(result.diagnostics[0].table).toBe("t");
    expect(result.diagnostics[0].column).toBe("p2");
    expect(result.diagnostics[0].rowKey).toBe("rb");
    expect(result.diagnostics[0].aggregate).toBeUndefined();
  });

  it("emits diagnostic for invalid summary row definition", () => {
    const badSchemaDoc = `---
mdxtab: "1.0"
tables:
  t:
    key: id
    columns: [id, p1]
    summary_rows:
      totals:
        cells:
          p1: sum(p1)
---

## t
| id | p1 |
|----|----|
| a  | 1  |
`;
    const result = validateMdxtab(badSchemaDoc);
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0].code).toBe("E_FRONTMATTER");
    expect(result.diagnostics[0].message).toContain("label is required");
  });

  it("does not change output when no summary rows are defined", () => {
    const noSummaryDoc = `---
mdxtab: "1.0"
tables:
  t:
    key: id
    columns: [id, p1]
    types:
      p1: number
---

## t
| id | p1 |
|----|----|
| a  | 1  |
`;
    const withFlag = compileMdxtab(noSummaryDoc, { includeSummaryRows: true });
    const without = compileMdxtab(noSummaryDoc, { includeSummaryRows: false });
    expect(withFlag.rendered).toBe(without.rendered);
  });

  it("does not inject summary rows when includeSummaryRows is false", () => {
    const withFlag = compileMdxtab(baseSummaryDoc, {
      includeComputedColumns: true,
      includeSummaryRows: true,
    });
    const without = compileMdxtab(baseSummaryDoc, {
      includeComputedColumns: true,
      includeSummaryRows: false,
    });
    expect(withFlag.rendered).toContain("| Running Balance |");
    expect(without.rendered).not.toContain("| Running Balance |");
  });

  it("keeps summary row column count aligned when includeComputedColumns is false", () => {
    const result = compileMdxtab(baseSummaryDoc, {
      includeComputedColumns: false,
      includeSummaryRows: true,
    });
    const line = result.rendered.split("\n").find((l) => l.includes("| Running Balance |"));
    expect(line).toBeDefined();
    const pipeCount = (line?.match(/\|/g) ?? []).length;
    // Header: | category | p1 | p2 | p3 | row_total | => 6 pipes
    expect(pipeCount).toBe(6);
  });

  it("renders multiple summary rows in declaration order", () => {
    const multiSummaryDoc = `---
mdxtab: "1.0"
tables:
  t:
    key: id
    columns: [id, p1, p2]
    empty_cells: zero
    types:
      p1: number
      p2: number
    summary_rows:
      totals:
        label: Totals
        cells:
          p1: sum(p1)
          p2: sum(p2)
      running:
        label: Running
        cells:
          p1: sum(p1)
          p2: self.p1 + sum(p2)
---

## t
| id | p1 | p2 |
|----|----|----|
| a  | 1  | 2  |
| b  | 3  | 4  |
`;
    const result = compileMdxtab(multiSummaryDoc, { includeSummaryRows: true });
    const idxTotals = result.rendered.indexOf("| Totals | 4 | 6 |");
    const idxRunning = result.rendered.indexOf("| Running | 4 | 10 |");
    expect(idxTotals).toBeGreaterThan(-1);
    expect(idxRunning).toBeGreaterThan(-1);
    expect(idxTotals).toBeLessThan(idxRunning);
  });

  it("renders summary rows for tables with headers but no data rows", () => {
    const emptyTableDoc = `---
mdxtab: "1.0"
tables:
  t:
    key: id
    columns: [id, p1, p2]
    empty_cells: zero
    types:
      p1: number
      p2: number
    summary_rows:
      totals:
        label: Totals
        cells:
          p1: sum(p1)
          p2: sum(p2)
---

## t
| id | p1 | p2 |
|----|----|----|
`;
    const result = compileMdxtab(emptyTableDoc, { includeSummaryRows: true });
    expect(result.rendered).toContain("| Totals | 0 | 0 |");
  });

  it("allows summary row cells targeting computed-only columns", () => {
    const computedOnlyDoc = `---
mdxtab: "1.0"
tables:
  t:
    key: id
    columns: [id, p1]
    types:
      p1: number
    computed:
      p2: p1 * 2
    summary_rows:
      totals:
        label: Totals
        cells:
          p2: sum(p2)
---

## t
| id | p1 |
|----|----|
| a  | 3  |
| b  | 4  |
`;
    const result = compileMdxtab(computedOnlyDoc, {
      includeComputedColumns: true,
      includeSummaryRows: true,
    });
    expect(result.rendered).toContain("| id | p1 | p2 |");
    expect(result.rendered).toContain("| Totals | | 14 |");
  });
});
