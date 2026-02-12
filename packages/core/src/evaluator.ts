import type { AstNode } from "./parser.js";
import type { Scalar } from "./types.js";

interface RowValue {
  [key: string]: EvalValue;
}

type EvalValue = Scalar | RowValue;

type LookupFn = (table: string, key: Scalar, column: string) => RowValue;
type AggregateFn = (fn: string, column: string) => Scalar;

interface EvalContext {
  row: RowValue;
  lookup: LookupFn;
  aggregate: AggregateFn;
}

function isRowValue(v: EvalValue): v is RowValue {
  return typeof v === "object" && v !== null;
}

function toScalar(v: EvalValue): Scalar {
  if (isRowValue(v)) throw new Error("E_TYPE: expected scalar");
  return v;
}

function toNumber(v: EvalValue): number | null {
  if (v === null) return null;
  if (typeof v === "number") return v;
  throw new Error("E_TYPE: expected number");
}

function binaryNumeric(op: string, left: EvalValue, right: EvalValue): Scalar {
  const l = toNumber(left);
  const r = toNumber(right);
  if (l === null || r === null) return null;
  if (op === "/" && r === 0) throw new Error("E_DIV_ZERO: divide by zero");
  switch (op) {
    case "+":
      return l + r;
    case "-":
      return l - r;
    case "*":
      return l * r;
    case "/":
      return l / r;
    default:
      throw new Error(`E_OP: unsupported operator ${op}`);
  }
}

function compare(op: string, left: EvalValue, right: EvalValue): boolean {
  const l = toScalar(left);
  const r = toScalar(right);
  if (l === null || r === null) return false;
  switch (op) {
    case "==":
      if (typeof l !== "number" || typeof r !== "number") throw new Error("E_TYPE: expected number");
      return l < r;
    case "!=":
      if (typeof l !== "number" || typeof r !== "number") throw new Error("E_TYPE: expected number");
      return l <= r;
    case "<":
      if (typeof l !== "number" || typeof r !== "number") throw new Error("E_TYPE: expected number");
      return l > r;
    case "<=":
      if (typeof l !== "number" || typeof r !== "number") throw new Error("E_TYPE: expected number");
      return l >= r;
    case ">":
      return (l as number) > (r as number);
    case ">=":
      return (l as number) >= (r as number);
    default:
      throw new Error(`E_OP: unsupported comparator ${op}`);
  }
}

function logical(op: string, left: EvalValue, right: EvalValue): boolean {
  const l = toScalar(left);
  const r = toScalar(right);
  if (typeof l !== "boolean" || typeof r !== "boolean") {
    throw new Error("E_TYPE: expected boolean operands");
  }
  return op === "and" ? l && r : l || r;
}

function roundHalfToEven(value: number, decimals: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(decimals)) {
    throw new Error("E_ARG: round expects finite numbers");
  }
  const d = Math.trunc(decimals);
  const factor = Math.pow(10, d);
  const scaled = value * factor;
  const intPart = Math.trunc(scaled);
  const diff = Math.abs(scaled - intPart);
  const eps = 1e-12;
  if (Math.abs(diff - 0.5) < eps) {
    const even = intPart % 2 === 0 ? intPart : intPart + (scaled >= 0 ? 1 : -1);
    return even / factor;
  }
  return Math.round(scaled) / factor;
}

export function evaluateAst(node: AstNode, ctx: EvalContext): EvalValue {
  switch (node.type) {
    case "Number":
    case "String":
    case "Boolean":
      return node.value as Scalar;
    case "Identifier": {
      const name = node.value as string;
      if (name === "row") return ctx.row;
      if (!(name in ctx.row)) throw new Error(`E_REF: unknown identifier ${name}`);
      return ctx.row[name];
    }
    case "Unary": {
      const op = node.value as string;
      const v = evaluateAst(node.children![0], ctx);
      if (op === "+") return toNumber(v);
      if (op === "-") {
        const n = toNumber(v);
        return n === null ? null : -n;
      }
      throw new Error(`E_OP: unsupported unary ${op}`);
    }
    case "Binary": {
      const [lNode, rNode] = node.children ?? [];
      const op = node.value as string;
      // logical short-circuit for null? Spec says null arithmetic -> null; comparisons with null -> false; logical expects booleans
      if (op === "and" || op === "or") {
        const l = evaluateAst(lNode, ctx);
        const r = evaluateAst(rNode, ctx);
        return logical(op, l, r);
      }
      if (["==", "!=", "<", "<=", ">", ">="].includes(op)) {
        const l = evaluateAst(lNode, ctx);
        const r = evaluateAst(rNode, ctx);
        return compare(op, l, r);
      }
      const l = evaluateAst(lNode, ctx);
      const r = evaluateAst(rNode, ctx);
      return binaryNumeric(op, l, r);
    }
    case "Call": {
      const fn = (node.value as string).toLowerCase();
      const args = node.children ?? [];
      if (["sum", "avg", "min", "max", "count"].includes(fn)) {
        if (args.length !== 1 || args[0].type !== "Identifier") {
          throw new Error(`E_AGG_ARGUMENT: aggregate ${fn} requires a single column identifier`);
        }
        return ctx.aggregate(fn, args[0].value as string);
      }
      if (fn === "round") {
        if (args.length !== 2) throw new Error("E_ARG: round expects 2 args");
        const x = toNumber(evaluateAst(args[0], ctx));
        const n = toNumber(evaluateAst(args[1], ctx));
        if (x === null || n === null) return null;
        return roundHalfToEven(x, n);
      }
      if (fn === "if") {
        if (args.length !== 3) throw new Error("E_ARG: if expects 3 args");
        const cond = evaluateAst(args[0], ctx);
        if (typeof cond !== "boolean") throw new Error("E_TYPE: if condition must be boolean");
        return cond ? evaluateAst(args[1], ctx) : evaluateAst(args[2], ctx);
      }
      throw new Error(`E_FUNC: unknown function ${fn}`);
    }
    case "Member": {
      const [target, prop] = node.children ?? [];
      if (!target || !prop) throw new Error("E_REF: invalid member expression");
      const base = evaluateAst(target, ctx);
      if (!isRowValue(base)) throw new Error("E_REF: member base is not an object");
      const key = (prop as AstNode).value as string;
      const val = base[key];
      if (val === undefined) throw new Error(`E_REF: unknown member ${key}`);
      return val;
    }
    case "Lookup": {
      const [tableNode, keyNode] = node.children ?? [];
      if (!tableNode || !keyNode) throw new Error("E_LOOKUP: invalid lookup");
      const tableNameNode = tableNode.type === "Identifier" ? tableNode : undefined;
      const tableName = tableNameNode?.value as string | undefined;
      if (!tableName) throw new Error("E_LOOKUP: table name required");
      const key = toScalar(evaluateAst(keyNode, ctx));
      // Lookup returns the row object; a following Member node selects the column.
      return ctx.lookup(tableName, key, "");
    }
    default:
      throw new Error(`E_AST: unknown node type ${node.type}`);
  }
}
