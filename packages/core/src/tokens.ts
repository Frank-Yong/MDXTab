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
  const tokens: Token[] = [];
  const src = input;
  const len = src.length;
  let i = 0;

  const isIdentifierStart = (ch: string) => /[A-Za-z_]/.test(ch);
  const isIdentifierPart = (ch: string) => /[A-Za-z0-9_]/.test(ch);

  const push = (type: TokenType, value: string, start: number, end: number) => {
    tokens.push({ type, value, start, end });
  };

  while (i < len) {
    const ch = src[i];

    // whitespace skip
    if (ch === " " || ch === "\t" || ch === "\r" || ch === "\n") {
      i += 1;
      continue;
    }

    // numbers (integer or decimal)
    if (/[0-9]/.test(ch) || (ch === "." && /[0-9]/.test(src[i + 1] ?? ""))) {
      let start = i;
      let hasDot = false;
      if (ch === ".") {
        hasDot = true;
        i += 1;
      }
      while (i < len && /[0-9]/.test(src[i])) i += 1;
      if (!hasDot && src[i] === ".") {
        hasDot = true;
        i += 1;
        while (i < len && /[0-9]/.test(src[i])) i += 1;
      }
      push("number", src.slice(start, i), start, i);
      continue;
    }

    // strings (double-quoted)
    if (ch === "\"") {
      const start = i;
      i += 1;
      let value = "";
      while (i < len) {
        const c = src[i];
        if (c === "\\") {
          const next = src[i + 1];
          if (next === undefined) throw new Error("Unterminated string");
          value += next;
          i += 2;
          continue;
        }
        if (c === "\"") {
          i += 1;
          push("string", value, start, i);
          break;
        }
        value += c;
        i += 1;
      }
      if (i > len) throw new Error("Unterminated string");
      continue;
    }

    // booleans and identifiers
    if (isIdentifierStart(ch)) {
      const start = i;
      i += 1;
      while (i < len && isIdentifierPart(src[i])) i += 1;
      const text = src.slice(start, i);
      if (text === "true" || text === "false") {
        push("boolean", text, start, i);
      } else {
        push("identifier", text, start, i);
      }
      continue;
    }

    // delimiters
    if (ch === "(") {
      push("lparen", ch, i, i + 1);
      i += 1;
      continue;
    }
    if (ch === ")") {
      push("rparen", ch, i, i + 1);
      i += 1;
      continue;
    }
    if (ch === ",") {
      push("comma", ch, i, i + 1);
      i += 1;
      continue;
    }
    if (ch === ".") {
      push("dot", ch, i, i + 1);
      i += 1;
      continue;
    }
    if (ch === "[") {
      push("lbracket", ch, i, i + 1);
      i += 1;
      continue;
    }
    if (ch === "]") {
      push("rbracket", ch, i, i + 1);
      i += 1;
      continue;
    }

    // operators
    const two = src.slice(i, i + 2);
    if (["==", "!=", "<=", ">="].includes(two)) {
      push("operator", two, i, i + 2);
      i += 2;
      continue;
    }
    if (["+", "-", "*", "/", "<", ">"].includes(ch)) {
      push("operator", ch, i, i + 1);
      i += 1;
      continue;
    }

    // reject interpolation braces here
    if (ch === "{" && src[i + 1] === "{") {
      throw new Error("Interpolation braces are not allowed in expressions");
    }

    throw new Error(`Unexpected character '${ch}' at position ${i}`);
  }

  push("eof", "", len, len);
  return tokens;
}
