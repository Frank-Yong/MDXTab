import type { AstNode } from "./parser.js";
import type { ExpressionLimits } from "./types.js";
import { assertAstDepth, assertDependencyDepth, DEFAULT_EXPRESSION_LIMITS } from "./expression-limits.js";

export interface DependencyEdge {
  from: string;
  to: string;
}

export interface DependencyGraph {
  edges: DependencyEdge[];
  order: string[];
}

export function buildDependencyGraph(
  nodes: Record<string, AstNode>,
  limits: ExpressionLimits = DEFAULT_EXPRESSION_LIMITS,
): DependencyGraph {
  const names = Object.keys(nodes);
  const nameSet = new Set(names);

  // Optional aggregate argument validation: aggregates must take a single column identifier.
  const isAggregate = (name: string) => ["sum", "avg", "min", "max", "count"].includes(name);

  const collectDeps = (ast: AstNode, deps: Set<string>, depth = 1): void => {
    assertAstDepth(depth, limits);

    switch (ast.type) {
      case "Identifier": {
        if (typeof ast.value === "string") deps.add(ast.value);
        break;
      }
      case "Member": {
        const [base, prop] = ast.children ?? [];
        if (!base) break;
        if (
          base.type === "Identifier" &&
          base.value === "row" &&
          prop?.type === "Identifier" &&
          typeof prop.value === "string"
        ) {
          deps.add(prop.value);
          break;
        }
        collectDeps(base, deps, depth + 1);
        break;
      }
      case "Lookup": {
        const [tableNode, keyNode] = ast.children ?? [];
        if (tableNode && tableNode.type !== "Identifier") {
          collectDeps(tableNode, deps, depth + 1);
        }
        if (keyNode) {
          collectDeps(keyNode, deps, depth + 1);
        }
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
        ast.children?.forEach((c) => collectDeps(c, deps, depth + 1));
        break;
      }
      default:
        ast.children?.forEach((c) => collectDeps(c, deps, depth + 1));
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

  const visit = (n: string, depth = 1) => {
    try {
      assertDependencyDepth(depth, limits);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`${message} while visiting ${n}`);
    }

    if (state[n] === "visited") return;
    if (state[n] === "visiting") {
      throw new Error(`E_CYCLE: dependency cycle involving ${n}`);
    }
    state[n] = "visiting";
    for (const dep of depMap[n] ?? []) {
      if (!nameSet.has(dep)) continue; // external dependency; ignore for ordering
      visit(dep, depth + 1);
    }
    state[n] = "visited";
    order.push(n);
  };

  for (const n of names) visit(n);

  return { edges, order };
}
