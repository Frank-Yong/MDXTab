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
  const names = Object.keys(nodes);

  // Optional aggregate argument validation: aggregates must take a single column identifier.
  const isAggregate = (name: string) => ["sum", "avg", "min", "max", "count"].includes(name);

  const collectDeps = (ast: AstNode, deps: Set<string>): void => {
    switch (ast.type) {
      case "Identifier": {
        if (typeof ast.value === "string") deps.add(ast.value);
        break;
      }
      case "Call": {
        const fn = typeof ast.value === "string" ? ast.value : "";
        const normalized = fn.toLowerCase();
        if (isAggregate(normalized)) {
          if (!ast.children || ast.children.length !== 1 || ast.children[0].type !== "Identifier") {
            throw new Error(`E_AGG_ARGUMENT: aggregate ${normalized} requires a single column identifier`);
          }
        }
        ast.children?.forEach((c) => collectDeps(c, deps));
        break;
      }
      default:
        ast.children?.forEach((c) => collectDeps(c, deps));
        break;
    }
  };

  const edges: DependencyEdge[] = [];
  const depMap: Record<string, Set<string>> = {};

  for (const [name, ast] of Object.entries(nodes)) {
    const deps = new Set<string>();
    collectDeps(ast, deps);
    depMap[name] = deps;
    for (const dep of deps) {
      edges.push({ from: name, to: dep });
    }
  }

  const order: string[] = [];
  const state: Record<string, "visiting" | "visited"> = {};

  const visit = (n: string) => {
    if (state[n] === "visited") return;
    if (state[n] === "visiting") {
      throw new Error(`E_CYCLE: dependency cycle involving ${n}`);
    }
    state[n] = "visiting";
    for (const dep of depMap[n] ?? []) {
      if (!names.includes(dep)) continue; // external dependency; ignore for ordering
      visit(dep);
    }
    state[n] = "visited";
    order.push(n);
  };

  for (const n of names) visit(n);

  return { edges, order };
}
