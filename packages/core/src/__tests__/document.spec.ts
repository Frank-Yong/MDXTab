import { describe, it, expect } from "vitest";
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
