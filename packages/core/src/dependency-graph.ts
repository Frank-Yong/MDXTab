import type { AstNode } from "./parser.js";

export interface DependencyEdge {
  from: string;
  to: string;
}

export interface DependencyGraph {
  edges: DependencyEdge[];
  order: string[];
}

export function buildDependencyGraph(nodes: Record<string, AstNode>): DependencyGraph {
  // TODO: Build dependency graph from ASTs and produce evaluation order.
  throw new Error("buildDependencyGraph not implemented");
}
