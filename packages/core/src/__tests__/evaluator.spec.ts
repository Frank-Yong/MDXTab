import { describe, it, expect } from "vitest";
import { lexExpression } from "../tokens.js";
import { parseExpression } from "../parser.js";
import { evaluateAst } from "../evaluator.js";
import type { Scalar } from "../types.js";

type EvalOptions = {
  row?: Record<string, Scalar>;
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

  it("uses half-to-even rounding", () => {
    expect(run("round(1.25, 1)")).toBe(1.2);
    expect(run("round(1.35, 1)")).toBe(1.4);
  });

  it("treats comparisons with null as false", () => {
    expect(run("a == 1", { row: { a: null } })).toBe(false);
    expect(run("a > 1", { row: { a: null } })).toBe(false);
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

  it("errors on unknown functions", () => {
    expect(() => run("foo(1)")).toThrow(/E_FUNC/);
  });
});
