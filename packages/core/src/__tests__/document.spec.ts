import { describe, it, expect } from "vitest";
import { compileMdxtab } from "../document.js";

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
});
