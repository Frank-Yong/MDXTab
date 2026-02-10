import type { Token } from "./tokens.js";

export interface AstNode {
  type: string;
  value?: unknown;
  children?: AstNode[];
}

export function parseExpression(tokens: Token[]): AstNode {
  // TODO: Implement Pratt parser per v1 precedence and grammar.
  throw new Error("parseExpression not implemented");
}
