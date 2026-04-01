import type { AstNode } from "./parser.js";
import type { ExpressionLimits } from "./types.js";

export const DEFAULT_EXPRESSION_LIMITS: ExpressionLimits = {
  maxLength: 4096,
  maxTokens: 512,
  maxAstDepth: 64,
  maxParseDepth: 256,
  maxDependencyDepth: 128,
};

function assertPositiveInteger(name: string, value: number): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`E_LIMIT: ${name} must be a positive integer`);
  }
}

export function normalizeExpressionLimits(overrides: Partial<ExpressionLimits> = {}): ExpressionLimits {
  const limits: ExpressionLimits = {
    maxLength: overrides.maxLength ?? DEFAULT_EXPRESSION_LIMITS.maxLength,
    maxTokens: overrides.maxTokens ?? DEFAULT_EXPRESSION_LIMITS.maxTokens,
    maxAstDepth: overrides.maxAstDepth ?? DEFAULT_EXPRESSION_LIMITS.maxAstDepth,
    maxParseDepth: overrides.maxParseDepth ?? DEFAULT_EXPRESSION_LIMITS.maxParseDepth,
    maxDependencyDepth: overrides.maxDependencyDepth ?? DEFAULT_EXPRESSION_LIMITS.maxDependencyDepth,
  };

  assertPositiveInteger("maxLength", limits.maxLength);
  assertPositiveInteger("maxTokens", limits.maxTokens);
  assertPositiveInteger("maxAstDepth", limits.maxAstDepth);
  assertPositiveInteger("maxParseDepth", limits.maxParseDepth);
  assertPositiveInteger("maxDependencyDepth", limits.maxDependencyDepth);

  return limits;
}

export function assertExpressionLength(input: string, limits: ExpressionLimits = DEFAULT_EXPRESSION_LIMITS): void {
  if (input.length > limits.maxLength) {
    throw new Error(
      `E_LIMIT: expression exceeds maximum length of ${limits.maxLength} characters`,
    );
  }
}

export function assertTokenCount(tokenCount: number, limits: ExpressionLimits = DEFAULT_EXPRESSION_LIMITS): void {
  if (tokenCount > limits.maxTokens) {
    throw new Error(
      `E_LIMIT: expression exceeds maximum token count of ${limits.maxTokens}`,
    );
  }
}

export function assertAstDepth(depth: number, limits: ExpressionLimits = DEFAULT_EXPRESSION_LIMITS): void {
  if (depth > limits.maxAstDepth) {
    throw new Error(
      `E_LIMIT: expression exceeds maximum AST depth of ${limits.maxAstDepth}`,
    );
  }
}

export function assertParseDepth(depth: number, limits: ExpressionLimits = DEFAULT_EXPRESSION_LIMITS): void {
  if (depth > limits.maxParseDepth) {
    throw new Error(
      `E_LIMIT: expression exceeds maximum parse depth of ${limits.maxParseDepth}`,
    );
  }
}

export function assertDependencyDepth(depth: number, limits: ExpressionLimits = DEFAULT_EXPRESSION_LIMITS): void {
  if (depth > limits.maxDependencyDepth) {
    throw new Error(
      `E_LIMIT: dependency traversal exceeds maximum depth of ${limits.maxDependencyDepth}`,
    );
  }
}

export function measureAstDepth(root: AstNode): number {
  let maxDepth = 0;
  const stack: Array<{ node: AstNode; depth: number }> = [{ node: root, depth: 1 }];

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) continue;
    maxDepth = Math.max(maxDepth, current.depth);
    for (const child of current.node.children ?? []) {
      stack.push({ node: child, depth: current.depth + 1 });
    }
  }

  return maxDepth;
}