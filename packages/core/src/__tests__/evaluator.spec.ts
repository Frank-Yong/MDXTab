import { describe, it, expect } from "vitest";
import { lexExpression } from "../tokens.js";
import { parseExpression } from "../parser.js";
import { evaluateAst } from "../evaluator.js";
import type { Scalar } from "../types.js";

type EvalOptions = {
  row?: RowValue;
  aggregateReturn?: Record<string, Scalar>;
  lookupReturn?: LookupReturn;
};

interface RowValue {
  [key: string]: Scalar | RowValue;
}
type LookupReturn = Record<string, Record<string, RowValue>>;

const run = (expr: string, opts: EvalOptions = {}): Scalar => {
  const ast = parseExpression(lexExpression(expr));
  const row = opts.row ?? {};
  const aggregateMap = opts.aggregateReturn ?? {};
  const lookupMap = opts.lookupReturn ?? {};
  const value = evaluateAst(ast, {
    row,
    lookup: (table, key, _column) => {
      const t = lookupMap[table];
      if (!t || !(key as string in t)) throw new Error("E_LOOKUP");
      return t[key as string];
    },
    aggregate: (fn, col) => {
      const k = `${fn}:${col}`;
      if (!(k in aggregateMap)) throw new Error("E_AGG_MISSING");
      return aggregateMap[k];
    },
  });
  if (value !== null && typeof value === "object") throw new Error("E_TYPE: expected scalar");
  return value;
};

describe("evaluator", () => {
  it("propagates null in arithmetic", () => {
    expect(run("a + 1", { row: { a: null } })).toBeNull();
  });

  it("errors on divide by zero", () => {
    expect(() => run("1 / 0")).toThrow(/E_DIV_ZERO/);
  });

  it("rejects non-finite arithmetic results", () => {
    expect(() => run("a + b", { row: { a: Number.MAX_VALUE, b: Number.MAX_VALUE } })).toThrow(/E_NUMBER/);
    expect(() => run("a * b", { row: { a: Number.MAX_VALUE, b: 2 } })).toThrow(/E_NUMBER/);
  });

  it("uses half-to-even rounding", () => {
    expect(run("round(1.25, 1)")).toBe(1.2);
    expect(run("round(1.35, 1)")).toBe(1.4);
  });

  it("treats comparisons with null as false", () => {
    expect(run("a == 1", { row: { a: null } })).toBe(false);
    expect(run("a > 1", { row: { a: null } })).toBe(false);
  });

  it("handles numeric comparisons", () => {
    expect(run("1 == 1")).toBe(true);
    expect(run("1 != 2")).toBe(true);
    expect(run("1 < 2")).toBe(true);
    expect(run("2 <= 2")).toBe(true);
    expect(run("2 > 1")).toBe(true);
    expect(run("2 >= 3")).toBe(false);
  });

  it("rejects non-boolean logical operands", () => {
    expect(() => run("1 and true")).toThrow(/E_TYPE/);
  });

  it("supports lookups and members", () => {
    const val = run("roles[role_id].title", {
      row: { role_id: "se" },
      lookupReturn: { roles: { se: { title: "Engineer" } } },
    });
    expect(val).toBe("Engineer");
  });

  it("delegates aggregates", () => {
    const val = run("sum(net)", { aggregateReturn: { "sum:net": 10 } });
    expect(val).toBe(10);
  });

  it("errors on bad aggregate argument", () => {
    expect(() => run("sum(net + 1)")).toThrow(/E_AGG_ARGUMENT/);
  });

  it("propagates null through other arithmetic ops", () => {
    expect(run("a * 3", { row: { a: null } })).toBeNull();
    expect(run("a - b", { row: { a: null, b: null } })).toBeNull();
  });

  it("rejects numeric ops on strings", () => {
    expect(() => run("a + 1", { row: { a: "1" } })).toThrow(/E_TYPE/);
  });

  it("rejects logical ops on non-booleans (including null)", () => {
    expect(() => run("a and true", { row: { a: null } })).toThrow(/E_TYPE/);
  });

  it("returns false when comparing nulls", () => {
    expect(run("a == b", { row: { a: null, b: null } })).toBe(false);
  });

  it("supports nested lookup members", () => {
    const val = run("roles[role_id].manager.name", {
      row: { role_id: "se" },
      lookupReturn: { roles: { se: { manager: { name: "Ellen" } } } },
    });
    expect(val).toBe("Ellen");
  });

  it("treats inherited prototype members as unknown members", () => {
    expect(() =>
      run("row.totals.toString", {
        row: { totals: {} },
      })
    ).toThrow(/E_REF: unknown member toString/);
  });

  it("rejects inherited prototype keys in dynamic lookups", () => {
    expect(() =>
      run("row.totals[key_name]", {
        row: { key_name: "toString", totals: {} },
      })
    ).toThrow(/E_LOOKUP: missing key toString/);
  });

  it("keeps row reserved even when the row object has a scalar row column", () => {
    const val = run("row.name", {
      row: { id: "u1", name: "Ada", row: "scalar value" },
    });
    expect(val).toBe("Ada");
  });

  it("treats prototype property names as unknown identifiers", () => {
    expect(() => run("toString", { row: {} })).toThrow(/E_REF/);
  });

  it("errors on unknown functions", () => {
    expect(() => run("foo(1)")).toThrow(/E_FUNC/);
  });

  it("parses HH:MM strings with hours()", () => {
    expect(run("hours(\"1:30\")")).toBe(1.5);
    expect(run("hours(\"09:05\")")).toBeCloseTo(9.083333, 6);
  });

  it("accepts numeric values with hours()", () => {
    expect(run("hours(1.25)")).toBe(1.25);
  });

  it("propagates null in hours()", () => {
    expect(run("hours(a)", { row: { a: null } })).toBeNull();
  });

  it("rejects invalid hours() formats", () => {
    expect(() => run("hours(\"1:5\")")).toThrow(/E_ARG/);
    expect(() => run("hours(\"1:60\")")).toThrow(/E_ARG/);
  });

  it("rejects ASTs that exceed the evaluation depth limit", () => {
    let astNode = { type: "Number", value: 1 } as import("../parser.js").AstNode;
    for (let i = 0; i < 70; i += 1) {
      astNode = {
        type: "Binary",
        value: "+",
        children: [astNode, { type: "Number", value: 1 }],
      };
    }

    expect(() =>
      evaluateAst(astNode, {
        row: {},
        lookup: () => ({}) as RowValue,
        aggregate: () => 0,
      }),
    ).toThrow(/E_LIMIT/);
  });
});
