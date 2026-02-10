import { buildDependencyGraph } from "./dependency-graph.js";
import { evaluateAst } from "./evaluator.js";
import { parseExpression, type AstNode } from "./parser.js";
import { parseFrontmatter } from "./frontmatter.js";
import { parseMarkdownTables } from "./markdown.js";
import { lexExpression } from "./tokens.js";
import type {
  CompileResult,
  FrontmatterDocument,
  ParsedTable,
  Scalar,
  TableEvaluation,
  TableFrontmatter,
} from "./types.js";

const NUMERIC_RE = /^-?\d+(?:\.\d+)?$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

type ColumnType = "number" | "string" | "date" | "bool" | undefined;
type LookupRowFn = (table: string, key: Scalar) => Record<string, Scalar>;

type EvalKind = "computed" | "aggregate";

function evalWithContext(
  ast: AstNode,
  ctx: { row: Record<string, Scalar>; lookup: (table: string, key: Scalar, column: string) => Scalar; aggregate: (fn: string, col: string) => Scalar },
  info: { table: string; target: string; kind: EvalKind; keyName?: string; rowKey?: string },
): Scalar {
  try {
    return evaluateAst(ast, ctx);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const rowPart = info.rowKey ? ` ${info.keyName ?? "row"}=${info.rowKey}` : "";
    throw new Error(`[${info.kind}] table ${info.table} ${info.target}${rowPart}: ${message}`);
  }
}

function splitFrontmatter(raw: string): { frontmatter: string; body: string } {
  const normalized = raw.replace(/\r\n?/g, "\n");
  if (!normalized.startsWith("---\n")) return { frontmatter: "", body: normalized };
  const end = normalized.indexOf("\n---", 4);
  if (end === -1) throw new Error("Closing --- for frontmatter not found");
  return { frontmatter: normalized.slice(0, end + 4), body: normalized.slice(end + 4) };
}

function coerceValue(text: string, type: ColumnType): Scalar {
  if (text === "true" || text === "false") {
    if (!type || type === "bool") return text === "true";
  }
  if (NUMERIC_RE.test(text)) {
    if (!type || type === "number") return Number(text);
  }
  if (DATE_RE.test(text)) {
    if (!type || type === "date") return text;
  }
  if (type && type !== "string") {
    throw new Error(`Type mismatch: cannot coerce '${text}' to ${type}`);
  }
  return text;
}

function normalizeCell(raw: string, table: TableFrontmatter, column: string): Scalar {
  const text = raw.trim();
  if (text === "") {
    switch (table.empty_cells ?? "null") {
      case "null":
        return null;
      case "zero":
        return 0;
      case "empty-string":
        return "";
      case "error":
        throw new Error(`Empty cell not allowed for ${column}`);
      default:
        return null;
    }
  }
  const type = table.types?.[column];
  return coerceValue(text, type);
}

function validateHeaders(table: ParsedTable, schema: TableFrontmatter): void {
  const headerNames = table.headers.map((h) => h.trimmed);
  if (headerNames.length !== schema.columns.length) {
    throw new Error(`Header column count mismatch for table ${table.name}`);
  }
  for (let i = 0; i < headerNames.length; i += 1) {
    if (headerNames[i] !== schema.columns[i]) {
      throw new Error(`Header mismatch for table ${table.name}: expected ${schema.columns[i]}, got ${headerNames[i]}`);
    }
  }
}

function parseExpressions(map: Record<string, string> | undefined): Record<string, AstNode> {
  if (!map) return {};
  return Object.fromEntries(
    Object.entries(map).map(([k, expr]) => [k, parseExpression(lexExpression(expr))]),
  );
}

function ensureComputed(
  tableName: string,
  row: Record<string, Scalar>,
  keyName: string,
  rowKey: string,
  order: Record<string, string[]>,
  computedAsts: Record<string, Record<string, AstNode>>,
  lookupRow: LookupRowFn,
  computedDone: WeakSet<Record<string, Scalar>>,
): Record<string, Scalar> {
  if (computedDone.has(row)) return row;
  const cols = order[tableName] ?? [];
  for (const col of cols) {
    const ast = computedAsts[tableName][col];
    row[col] = evalWithContext(
      ast,
      {
        row,
        lookup: (table, key) => lookupRow(table, key) as unknown as Scalar,
        aggregate: () => {
          throw new Error("E_AGG_IN_ROW: aggregates not allowed in row evaluation");
        },
      },
      { table: tableName, target: col, kind: "computed", keyName, rowKey },
    );
  }
  computedDone.add(row);
  return row;
}

function computeAggregate(
  fn: string,
  column: string,
  rows: Record<string, Scalar>[],
  tableName: string,
  ensure: (row: Record<string, Scalar>) => Record<string, Scalar>,
): Scalar {
  const values = rows.map((r) => {
    const row = ensure(r);
    if (!(column in row)) throw new Error(`E_REF: unknown column ${column} in ${tableName}`);
    return row[column];
  });
  const nonNull = values.filter((v) => v !== null) as Scalar[];
  switch (fn) {
    case "sum": {
      if (nonNull.some((v) => typeof v !== "number")) throw new Error("E_TYPE: sum expects numbers");
      if (nonNull.length === 0) return 0;
      return (nonNull as number[]).reduce((a, b) => a + b, 0);
    }
    case "avg": {
      if (nonNull.some((v) => typeof v !== "number")) throw new Error("E_TYPE: avg expects numbers");
      if (nonNull.length === 0) return null;
      return (nonNull as number[]).reduce((a, b) => a + b, 0) / nonNull.length;
    }
    case "min": {
      const nums = nonNull.filter((v) => typeof v === "number") as number[];
      if (nums.length === 0) return null;
      if (nums.length !== nonNull.length) throw new Error("E_TYPE: min expects numbers");
      return Math.min(...nums);
    }
    case "max": {
      const nums = nonNull.filter((v) => typeof v === "number") as number[];
      if (nums.length === 0) return null;
      if (nums.length !== nonNull.length) throw new Error("E_TYPE: max expects numbers");
      return Math.max(...nums);
    }
    case "count":
      return nonNull.length;
    default:
      throw new Error(`E_FUNC: unknown aggregate ${fn}`);
  }
}

function interpolateAggregates(body: string, aggregates: Record<string, Record<string, Scalar>>): string {
  return body.replace(/\{\{\s*([A-Za-z0-9_]+)\.([A-Za-z0-9_]+)\s*\}\}/g, (match, table, name) => {
    const tableAgg = aggregates[table];
    if (!tableAgg || !(name in tableAgg)) {
      throw new Error(`Unknown aggregate reference ${table}.${name}`);
    }
    const value = tableAgg[name];
    if (value === null) return "null";
    return String(value);
  });
}

export function compileMdxtab(raw: string): CompileResult {
  const frontmatter = parseFrontmatter(raw);
  const tables = parseMarkdownTables(raw);

  const schemaNames = new Set(Object.keys(frontmatter.tables));
  const tableByName: Record<string, ParsedTable> = {};
  for (const t of tables) {
    if (!schemaNames.has(t.name)) {
      throw new Error(`Markdown table ${t.name} not declared in frontmatter`);
    }
    if (tableByName[t.name]) throw new Error(`Duplicate table ${t.name} in markdown`);
    tableByName[t.name] = t;
  }
  for (const name of schemaNames) {
    if (!tableByName[name]) throw new Error(`Missing markdown table for ${name}`);
  }

  const computedAsts: Record<string, Record<string, AstNode>> = {};
  const aggregateAsts: Record<string, Record<string, AstNode>> = {};
  const computedOrder: Record<string, string[]> = {};
  const keyByTable: Record<string, string> = {};

  const rowList: Record<string, Record<string, Scalar>[]> = {};
  const rowMap: Record<string, Map<string, Record<string, Scalar>>> = {};

  for (const [name, schema] of Object.entries(frontmatter.tables)) {
    const table = tableByName[name];
    validateHeaders(table, schema);

    const keyName = schema.key ?? "id";
    keyByTable[name] = keyName;

    const rows: Record<string, Scalar>[] = [];
    const map = new Map<string, Record<string, Scalar>>();

    for (const row of table.rows) {
      const obj: Record<string, Scalar> = {};
      schema.columns.forEach((col, idx) => {
        obj[col] = normalizeCell(row.cells[idx].raw, schema, col);
      });
      const keyVal = obj[keyName];
      if (keyVal === null || keyVal === undefined) throw new Error(`Missing key value in table ${name}`);
      const key = String(keyVal);
      if (map.has(key)) throw new Error(`Duplicate key ${key} in table ${name}`);
      map.set(key, obj);
      rows.push(obj);
    }

    rowList[name] = rows;
    rowMap[name] = map;

    const computed = parseExpressions(schema.computed);
    computedAsts[name] = computed;
    computedOrder[name] = buildDependencyGraph(computed).order;
    aggregateAsts[name] = parseExpressions(schema.aggregates);
  }

  const computedDone = new WeakSet<Record<string, Scalar>>();
  const lookupRow: LookupRowFn = (table: string, keyValue: Scalar) => {
    const map = rowMap[table];
    if (!map) throw new Error(`E_LOOKUP: unknown table ${table}`);
    const row = map.get(String(keyValue));
    if (!row) throw new Error(`E_LOOKUP: missing row ${table}[${String(keyValue)}]`);
    const keyName = keyByTable[table];
    const rowKey = String(keyValue);
    return ensureComputed(table, row, keyName, rowKey, computedOrder, computedAsts, lookupRow, computedDone);
  };

  const ensureByTable: Record<string, (row: Record<string, Scalar>) => Record<string, Scalar>> = {};
  for (const name of Object.keys(rowList)) {
    ensureByTable[name] = (row) => {
      const keyName = keyByTable[name];
      const rowKey = String(row[keyName] ?? "");
      return ensureComputed(name, row, keyName, rowKey, computedOrder, computedAsts, lookupRow, computedDone);
    };
  }

  // materialize computed columns for all rows
  for (const [name, rows] of Object.entries(rowList)) {
    const ensure = ensureByTable[name];
    rows.forEach((r) => ensure(r));
  }

  const aggregateResults: Record<string, Record<string, Scalar>> = {};
  for (const [name, asts] of Object.entries(aggregateAsts)) {
    const rows = rowList[name];
    const ensure = ensureByTable[name];
    const aggMap: Record<string, Scalar> = {};
    const aggregateFn = (fn: string, column: string) => computeAggregate(fn, column, rows, name, ensure);
    for (const [aggName, ast] of Object.entries(asts)) {
      aggMap[aggName] = evalWithContext(
        ast,
        {
          row: {},
          lookup: (table, key) => lookupRow(table, key) as unknown as Scalar,
          aggregate: aggregateFn,
        },
        { table: name, target: aggName, kind: "aggregate" },
      );
    }
    aggregateResults[name] = aggMap;
  }

  const results: Record<string, TableEvaluation> = {};
  for (const [name, rows] of Object.entries(rowList)) {
    const ensure = ensureByTable[name];
    results[name] = {
      name,
      rows: rows.map((r) => ensure(r)),
      aggregates: aggregateResults[name] ?? {},
    };
  }

  const { frontmatter: fmText, body } = splitFrontmatter(raw);
  const rendered = `${fmText}${interpolateAggregates(body, aggregateResults)}`;

  return { frontmatter: frontmatter as FrontmatterDocument, tables: results, rendered };
}
