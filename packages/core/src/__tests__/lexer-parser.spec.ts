import { describe, it, expect } from "vitest";
import { lexExpression } from "../tokens.js";
import { parseExpression } from "../parser.js";

const toAst = (expr: string) => parseExpression(lexExpression(expr));

describe("lexer", () => {
  it("rejects interpolation braces", () => {
    expect(() => lexExpression("{{ foo }}")).toThrow();
  });

  it("tokenizes numbers, identifiers, and operators", () => {
    const tokens = lexExpression("1 + foo * 2");
    expect(tokens.map((t) => t.type)).toContain("number");
    expect(tokens.map((t) => t.type)).toContain("identifier");
  });

  it("rejects expressions with too many tokens", () => {
    const expr = Array.from({ length: 260 }, () => "a").join(" + ");
    expect(() => lexExpression(expr)).toThrow(/E_LIMIT/);
  });
});

describe("parser", () => {
  it("respects precedence (mul before add)", () => {
    const ast = toAst("1 + 2 * 3");
    expect(ast.type).toBe("Binary");
    expect(ast.value).toBe("+");
    expect(ast.children?.[1]?.value).toBe("*");
  });

  it("parses member and lookup access", () => {
    const ast = toAst("roles[role_id].title");
    expect(ast.type).toBe("Member");
    expect(ast.children?.[0]?.type).toBe("Lookup");
  });

  it("rejects expressions whose measured AST exceeds the configured depth", () => {
    const expr = "-".repeat(70) + "1";
    expect(() => toAst(expr)).toThrow(/E_LIMIT/);
  });

  it("rejects non-finite numeric literals", () => {
    expect(() => toAst("9".repeat(400))).toThrow(/E_NUMBER/);
  });

  it("does not count parenthesis-only nesting against maxAstDepth", () => {
    const expr = "(".repeat(8) + "1" + ")".repeat(8);
    const ast = parseExpression(lexExpression(expr), {
      maxLength: 4096,
      maxTokens: 512,
      maxAstDepth: 1,
      maxParseDepth: 16,
      maxDependencyDepth: 128,
    });

    expect(ast.type).toBe("Number");
  });

  it("rejects expressions whose parser nesting exceeds the configured depth", () => {
    const expr = "(".repeat(20) + "1" + ")".repeat(20);
    expect(() =>
      parseExpression(lexExpression(expr), {
        maxLength: 4096,
        maxTokens: 512,
        maxAstDepth: 64,
        maxParseDepth: 10,
        maxDependencyDepth: 128,
      }),
    ).toThrow(/E_LIMIT/);
  });
});
