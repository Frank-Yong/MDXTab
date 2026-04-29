import { describe, it, expect } from "vitest";
import { lexExpression } from "../tokens.js";
import { parseExpression } from "../parser.js";
import { buildDependencyGraph, buildNameDependencyGraph } from "../dependency-graph.js";

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

  it("rejects dependency chains beyond the configured depth", () => {
    const nodes: Record<string, ReturnType<typeof ast>> = {};
    for (let i = 130; i >= 1; i -= 1) {
      nodes[`c${i}`] = ast(`c${i - 1} + 1`);
    }
    nodes.c0 = ast("1");
    expect(() => buildDependencyGraph(nodes)).toThrow(/E_LIMIT/);
  });

  it("does not use dependency-depth limit for a single deep expression AST", () => {
    const deepAst = ast("(".repeat(20) + "a" + ")".repeat(20));
    const graph = buildDependencyGraph(
      { only: deepAst },
      {
        maxLength: 4096,
        maxTokens: 512,
        maxAstDepth: 64,
        maxParseDepth: 256,
        maxDependencyDepth: 2,
      },
    );

    expect(graph.edges).toEqual([{ from: "only", to: "a" }]);
    expect(graph.order).toEqual(["only"]);
  });

  it("does not treat lookup table or member property names as computed dependencies", () => {
    const graph = buildDependencyGraph({
      title: ast("roles[role_id].title"),
      role_id: ast("1"),
    });

    expect(graph.edges).toEqual([{ from: "title", to: "role_id" }]);
    expect(graph.order).toEqual(["role_id", "title"]);
  });

  it("orders name dependencies with external nodes ignored", () => {
    const graph = buildNameDependencyGraph({
      "pivot:liquidity": ["table:entries"],
      "report:overview": ["pivot:liquidity"],
    });

    expect(graph.order).toEqual(["pivot:liquidity", "report:overview"]);
  });

  it("detects cycles in name dependencies", () => {
    expect(() =>
      buildNameDependencyGraph({
        "pivot:a": ["report:b"],
        "report:b": ["pivot:a"],
      }),
    ).toThrow(/E_CYCLE/);
  });
});
