export type TokenType =
  | "number"
  | "string"
  | "boolean"
  | "identifier"
  | "lparen"
  | "rparen"
  | "comma"
  | "dot"
  | "lbracket"
  | "rbracket"
  | "operator"
  | "eof";

export interface Token {
  type: TokenType;
  value: string;
  start: number;
  end: number;
}

export function lexExpression(input: string): Token[] {
  // TODO: Implement lexer covering literals, identifiers, operators, and delimiters.
  throw new Error("lexExpression not implemented");
}
