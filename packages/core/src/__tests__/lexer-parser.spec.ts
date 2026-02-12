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
});
