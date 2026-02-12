import { describe, it, expect } from "vitest";
import { lexExpression } from "../tokens.js";
import { parseExpression } from "../parser.js";
import { buildDependencyGraph } from "../dependency-graph.js";

const ast = (expr: string) => parseExpression(lexExpression(expr));

describe("dependency graph", () => {
  it("orders simple dependencies", () => {
    const graph = buildDependencyGraph({
      a: ast("1"),
      b: ast("a + 1"),
      c: ast("b + 1"),
    });
    expect(graph.order).toEqual(["a", "b", "c"]);
  });

  it("detects cycles", () => {
    expect(() =>
      buildDependencyGraph({
        a: ast("b + 1"),
        b: ast("a + 1"),
      }),
    ).toThrow(/E_CYCLE/);
  });

  it("errors on bad aggregate arg", () => {
    expect(() => buildDependencyGraph({ agg: ast("sum(a + 1)") })).toThrow(/E_AGG_ARGUMENT/);
  });
});
