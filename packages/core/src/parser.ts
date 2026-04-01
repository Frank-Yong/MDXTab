import type { Token } from "./tokens.js";
import { assertAstDepth, assertParseDepth, measureAstDepth, DEFAULT_EXPRESSION_LIMITS } from "./expression-limits.js";
import type { ExpressionLimits } from "./types.js";

export interface AstNode {
  type: string;
  value?: unknown;
  children?: AstNode[];
}

type Nud = () => AstNode;
type Led = (left: AstNode) => AstNode;

interface Binding {
  lbp: number;
  nud?: Nud;
  led?: Led;
}

class Parser {
  private tokens: Token[];
  private pos = 0;
  private parseDepth = 0;
  private limits: ExpressionLimits;

  constructor(tokens: Token[], limits: ExpressionLimits) {
    this.tokens = tokens;
    this.limits = limits;
  }

  private current(): Token {
    return this.tokens[this.pos];
  }

  peek(): Token {
    return this.current();
  }

  private advance(): Token {
    const t = this.tokens[this.pos];
    this.pos += 1;
    return t;
  }

  private match(type: Token["type"], value?: string): boolean {
    const t = this.current();
    if (t.type !== type) return false;
    if (value !== undefined && t.value !== value) return false;
    this.advance();
    return true;
  }

  expression(rbp: number): AstNode {
    this.parseDepth += 1;
    assertParseDepth(this.parseDepth, this.limits);

    try {
      const t = this.advance();
      const prefix = this.bindingPower(t).nud;
      if (!prefix) throw new Error(`Unexpected token ${t.type} at ${t.start}`);
      let left = prefix();
      while (rbp < this.bindingPower(this.current()).lbp) {
        const tt = this.advance();
        const infix = this.bindingPower(tt).led;
        if (!infix) throw new Error(`Unexpected operator ${tt.value}`);
        left = infix(left);
      }
      return left;
    } finally {
      this.parseDepth -= 1;
    }
  }

  private bindingPower(token: Token): Binding {
    switch (token.type) {
      case "rparen":
      case "rbracket":
      case "comma":
        return { lbp: 0 };
      case "number":
        return { lbp: 0, nud: () => ({ type: "Number", value: Number(token.value) }) };
      case "string":
        return { lbp: 0, nud: () => ({ type: "String", value: token.value }) };
      case "boolean":
        return { lbp: 0, nud: () => ({ type: "Boolean", value: token.value === "true" }) };
      case "identifier":
        return {
          lbp: 0,
          nud: () => this.parseIdentifier(token),
        };
      case "lparen":
        return {
          lbp: 0,
          nud: () => {
            const expr = this.expression(0);
            if (!this.match("rparen")) throw new Error("Missing closing )");
            return expr;
          },
        };
      default:
        break;
    }

    // operators (prefix and infix)
    if (token.type === "operator") {
      switch (token.value) {
        case "+":
        case "-":
          return {
            lbp: 50,
            nud: () => {
              const right = this.expression(70);
              return { type: "Unary", value: token.value, children: [right] };
            },
            led: (left) => {
              const right = this.expression(50);
              return { type: "Binary", value: token.value, children: [left, right] };
            },
          };
        case "*":
        case "/":
          return {
            lbp: 60,
            led: (left) => {
              const right = this.expression(60);
              return { type: "Binary", value: token.value, children: [left, right] };
            },
          };
        case "==":
        case "!=":
        case "<":
        case "<=":
        case ">":
        case ">=":
          return {
            lbp: 40,
            led: (left) => {
              const right = this.expression(40);
              return { type: "Binary", value: token.value, children: [left, right] };
            },
          };
        case "and":
        case "or":
          return {
            lbp: 30,
            led: (left) => {
              const right = this.expression(30);
              return { type: "Binary", value: token.value, children: [left, right] };
            },
          };
        default:
          throw new Error(`Unknown operator ${token.value}`);
      }
    }

    if (token.type === "eof") return { lbp: -1 };

    throw new Error(`Unexpected token ${token.type}`);
  }

  private parseIdentifier(token: Token): AstNode {
    // identifier, possibly function call, property access, table lookup
    let node: AstNode = { type: "Identifier", value: token.value };

    // handle function call
    if (this.match("lparen")) {
      const args: AstNode[] = [];
      if (!this.match("rparen")) {
        args.push(this.expression(0));
        while (this.match("comma")) {
          args.push(this.expression(0));
        }
        if (!this.match("rparen")) throw new Error("Missing closing ) in function call");
      }
      node = { type: "Call", value: token.value, children: args };
    }

    // property / lookup chain: .identifier or [expr] or .identifier after lookup
    // allow repeated chaining: row.col, table[key].col
    while (true) {
      if (this.match("dot")) {
        const next = this.advance();
        if (next.type !== "identifier") throw new Error("Expected identifier after .");
        node = { type: "Member", children: [node, { type: "Identifier", value: next.value }] };
        continue;
      }
      if (this.match("lbracket")) {
        const expr = this.expression(0);
        if (!this.match("rbracket")) throw new Error("Missing closing ] in lookup");
        node = { type: "Lookup", children: [node, expr] };
        continue;
      }
      break;
    }

    return node;
  }
}

export function parseExpression(tokens: Token[], limits: ExpressionLimits = DEFAULT_EXPRESSION_LIMITS): AstNode {
  const parser = new Parser(tokens, limits);
  const ast = parser.expression(0);
  const end = parser.peek();
  if (end.type !== "eof") throw new Error(`Unexpected tokens after expression: ${end.type} ${end.value}`);
  assertAstDepth(measureAstDepth(ast), limits);
  return ast;
}
