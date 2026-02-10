import type { AstNode } from "./parser.js";
import type { Scalar } from "./types.js";

export function evaluateAst(node: AstNode, context: Record<string, Scalar>): Scalar {
  // TODO: Evaluate AST with row context, lookup rules, and null/numeric semantics per spec.
  throw new Error("evaluateAst not implemented");
}
