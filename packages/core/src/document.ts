import { buildDependencyGraph } from "./dependency-graph.js";
import { evaluateAst } from "./evaluator.js";
import { parseExpression, type AstNode } from "./parser.js";
import { parseFrontmatter } from "./frontmatter.js";
import { parseMarkdownTables } from "./markdown.js";
import { lexExpression } from "./tokens.js";
import { DiagnosticError, errorCodeFromMessage, lineRange, toDiagnostic } from "./diagnostics.js";
import type {
  CompileOptions,
  CompileResult,
  Diagnostic,
  FrontmatterDocument,
  ParsedTable,
  Scalar,
  TableEvaluation,
  TableFrontmatter,
} from "./types.js";

const NUMERIC_RE = /^-?\d+(?:\.\d+)?$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d+:\d{2}$/;

type ColumnType = "number" | "string" | "date" | "bool" | "time" | undefined;
type LookupRowFn = (table: string, key: Scalar) => Record<string, Scalar>;

type EvalKind = "computed" | "aggregate";

type GroupedAggregate = {
  fn: string;
  column: string;
  by: string;
};

function evalWithContext(
  ast: AstNode,
  ctx: {
    row: Record<string, Scalar>;
    lookup: (table: string, key: Scalar, column: string) => Record<string, Scalar>;
    aggregate: (fn: string, col: string) => Scalar;
  },
  info: { table: string; target: string; kind: EvalKind; keyName?: string; rowKey?: string },
): Scalar {
  try {
    const value = evaluateAst(ast, ctx);
    if (value !== null && typeof value === "object") throw new Error("E_TYPE: expected scalar");
    return value;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const rowPart = info.rowKey ? ` ${info.keyName ?? "row"}=${info.rowKey}` : "";
    const contextMessage = `[${info.kind}] table ${info.table} ${info.target}${rowPart}: ${message}`;
    if (err instanceof DiagnosticError) {
      throw new DiagnosticError({
        code: err.code,
        message: contextMessage,
        severity: err.severity,
        table: err.table ?? info.table,
        column: err.column ?? (info.kind === "computed" ? info.target : undefined),
        aggregate: err.aggregate ?? (info.kind === "aggregate" ? info.target : undefined),
        rowKey: err.rowKey ?? info.rowKey,
        range: err.range,
      });
    }
    throw new DiagnosticError({
      code: errorCodeFromMessage(message),
      message: contextMessage,
      table: info.table,
      column: info.kind === "computed" ? info.target : undefined,
      aggregate: info.kind === "aggregate" ? info.target : undefined,
      rowKey: info.rowKey,
    });
  }
}

function splitFrontmatter(raw: string): { frontmatter: string; body: string; bodyOffset: number } {
  const normalized = raw.replace(/\r\n?/g, "\n");
  const lines = normalized.split("\n");
  if (!normalized.startsWith("---\n")) return { frontmatter: "", body: normalized, bodyOffset: 0 };
  const endIndex = lines.findIndex((line, idx) => idx > 0 && line.trim() === "---");
  if (endIndex === -1) throw new Error("Closing --- for frontmatter not found");
  const frontmatter = lines.slice(0, endIndex + 1).join("\n");
  const body = lines.slice(endIndex + 1).join("\n");
  return { frontmatter, body, bodyOffset: endIndex + 1 };
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
  if (type === "time") {
    if (!TIME_RE.test(text)) {
      throw new Error(`Type mismatch: cannot coerce '${text}' to ${type}`);
    }
    const [hoursText, minutesText] = text.split(":");
    const hours = Number(hoursText);
    const minutes = Number(minutesText);
    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
      throw new Error(`Type mismatch: cannot coerce '${text}' to ${type}`);
    }
    if (minutes < 0 || minutes > 59) {
      throw new Error(`Type mismatch: cannot coerce '${text}' to ${type}`);
    }
    return text;
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
    throw new DiagnosticError({
      code: "E_COLUMN_MISMATCH",
      message: `Header column count mismatch for table ${table.name}`,
      table: table.name,
      range: lineRange(table.headers[0]?.line ?? 0),
    });
  }
  for (let i = 0; i < headerNames.length; i += 1) {
    if (headerNames[i] !== schema.columns[i]) {
      const header = table.headers[i];
      throw new DiagnosticError({
        code: "E_COLUMN_MISMATCH",
        message: `Header mismatch for table ${table.name}: expected ${schema.columns[i]}, got ${headerNames[i]}`,
        table: table.name,
        column: schema.columns[i],
        range: {
          start: { line: header?.line ?? 0, character: header?.start ?? 0 },
          end: { line: header?.line ?? 0, character: header?.end ?? 0 },
        },
      });
    }
  }
}

function errorCodeForCell(message: string): string {
  if (message.startsWith("Empty cell not allowed")) return "E_EMPTY_CELL";
  if (message.startsWith("Type mismatch")) return "E_TYPE";
  return errorCodeFromMessage(message);
}

function parseExpressions(map: Record<string, string> | undefined): Record<string, AstNode> {
  if (!map) return {};
  return Object.fromEntries(
    Object.entries(map).map(([k, expr]) => [k, parseExpression(lexExpression(expr))]),
  );
}

function parseAggregates(map: Record<string, string> | undefined): {
  scalar: Record<string, AstNode>;
  grouped: Record<string, GroupedAggregate>;
} {
  if (!map) return { scalar: {}, grouped: {} };
  const scalar: Record<string, AstNode> = {};
  const grouped: Record<string, GroupedAggregate> = {};
  const groupRe = /^(sum|avg|min|max|count)\s*\(\s*([A-Za-z_][A-Za-z0-9_]*)\s*\)\s+by\s+([A-Za-z_][A-Za-z0-9_]*)\s*$/i;
  for (const [name, expr] of Object.entries(map)) {
    const match = expr.trim().match(groupRe);
    if (match) {
      grouped[name] = { fn: match[1].toLowerCase(), column: match[2], by: match[3] };
      continue;
    }
    scalar[name] = parseExpression(lexExpression(expr));
  }
  return { scalar, grouped };
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
        lookup: (table, key, _column) => lookupRow(table, key),
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

function computeAggregateValues(fn: string, values: Scalar[]): Scalar {
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
  return computeAggregateValues(fn, values);
}

function computeGroupedAggregate(
  fn: string,
  column: string,
  by: string,
  rows: Record<string, Scalar>[],
  tableName: string,
  ensure: (row: Record<string, Scalar>) => Record<string, Scalar>,
): Record<string, Scalar> {
  const groups: Record<string, Scalar[]> = Object.create(null);
  for (const r of rows) {
    const row = ensure(r);
    if (!(column in row)) throw new Error(`E_REF: unknown column ${column} in ${tableName}`);
    if (!(by in row)) throw new Error(`E_REF: unknown column ${by} in ${tableName}`);
    const keyVal = row[by];
    if (keyVal === null || keyVal === undefined) continue;
    const key = String(keyVal);
    if (!Object.prototype.hasOwnProperty.call(groups, key)) {
      groups[key] = [];
    }
    groups[key].push(row[column]);
  }
  const result: Record<string, Scalar> = Object.create(null);
  for (const [key, values] of Object.entries(groups)) {
    result[key] = computeAggregateValues(fn, values);
  }
  return result;
}

function formatScalar(value: Scalar): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return String(value);
    // Only round non-integers to remove floating-point noise
    if (Number.isInteger(value)) return String(value);
    const rounded = Number(value.toPrecision(10));
    return String(rounded);
  }
  // Escape characters that would break markdown table structure
  return String(value).replace(/\|/g, "\\|").replace(/\n/g, " ");
}

function injectComputedColumns(
  body: string,
  parsedTables: ParsedTable[],
  schemas: Record<string, TableFrontmatter>,
  evaluatedTables: Record<string, TableEvaluation>,
  bodyOffset: number,
): string {
  const lines = body.split("\n");

  // Build a set of line indices inside fenced code blocks so we skip them.
  // Note: parseMarkdownTables() also does not skip fences (pre-existing issue),
  // so fenced tables currently cause parse/validation errors before this code
  // runs. This guard is defensive for when the parser is updated to skip fences.
  const fencedLines = new Set<number>();
  let inFence = false;
  let fenceTicks = 0;
  for (let i = 0; i < lines.length; i++) {
    if (inFence) {
      fencedLines.add(i);
      const closeRe = new RegExp(`^\\s*` + "`".repeat(fenceTicks) + `\\s*$`);
      if (closeRe.test(lines[i])) {
        inFence = false;
        fenceTicks = 0;
      }
      continue;
    }
    const openMatch = lines[i].match(/^\s*(`{3,})/);
    if (openMatch) {
      inFence = true;
      fenceTicks = openMatch[1].length;
      fencedLines.add(i);
    }
  }

  for (const pt of parsedTables) {
    const schema = schemas[pt.name];
    if (!schema?.computed) continue;

    const evaluated = evaluatedTables[pt.name];
    if (!evaluated) continue;

    // Skip tables whose header line falls inside a fenced code block.
    const headerLine = (pt.headers[0]?.line ?? 0) - bodyOffset;
    if (fencedLines.has(headerLine)) continue;

    const authoredHeaders = pt.headers.map((h) => h.trimmed);
    const authoredSet = new Set(authoredHeaders);

    // Split computed columns into two groups:
    // 1. inlineCols: already authored as headers → fill in cell values in-place
    // 2. extraCols: not yet in headers → append as new columns
    const computedNames = Object.keys(schema.computed);
    const inlineCols: { name: string; colIdx: number }[] = [];
    const extraCols: string[] = [];

    for (const c of computedNames) {
      if (authoredSet.has(c)) {
        const idx = authoredHeaders.indexOf(c);
        if (idx !== -1) inlineCols.push({ name: c, colIdx: idx });
      } else {
        extraCols.push(c);
      }
    }

    // Fill in existing authored cells with computed values.
    // Process columns in descending column-index (right-to-left) order per row
    // so that earlier cell positions remain valid after each replacement.
    const sortedInline = [...inlineCols].sort((a, b) => b.colIdx - a.colIdx);
    for (let rowIdx = 0; rowIdx < pt.rows.length; rowIdx++) {
      const row = pt.rows[rowIdx];
      const dataLine = (row.line ?? 0) - bodyOffset;
      if (dataLine < 0 || dataLine >= lines.length) continue;

      const evalRow = evaluated.rows[rowIdx];
      for (const { name, colIdx } of sortedInline) {
        const cell = row.cells[colIdx];
        if (!cell) continue;
        // Only fill empty cells; preserve non-empty authored values
        if (cell.raw.trim() !== "") continue;

        // Defensive: #ERR if row data is unexpectedly missing.
        // In practice, ensureComputed() throws on evaluation errors before
        // rendering, so this path is not reachable under normal operation.
        const value = evalRow && name in evalRow ? formatScalar(evalRow[name]) : "#ERR";
        const line = lines[dataLine];
        lines[dataLine] = line.slice(0, cell.start) + " " + value + " " + line.slice(cell.end);
      }
    }

    // Append new columns for computed columns not already in headers
    if (extraCols.length > 0) {
      const separatorLine = headerLine + 1;

      if (headerLine >= 0 && headerLine < lines.length) {
        const suffix = extraCols.map((c) => ` ${c} |`).join("");
        lines[headerLine] = lines[headerLine].replace(/\|\s*$/, "|" + suffix);
      }

      if (separatorLine >= 0 && separatorLine < lines.length) {
        const suffix = extraCols.map((c) => " " + "-".repeat(Math.max(c.length, 3)) + " |").join("");
        lines[separatorLine] = lines[separatorLine].replace(/\|\s*$/, "|" + suffix);
      }

      for (let rowIdx = 0; rowIdx < pt.rows.length; rowIdx++) {
        const dataLine = (pt.rows[rowIdx].line ?? 0) - bodyOffset;
        if (dataLine < 0 || dataLine >= lines.length) continue;

        const evalRow = evaluated.rows[rowIdx];
        const suffix = extraCols.map((c) => {
          // Defensive guard; see inline-cell comment above.
          if (!evalRow || !(c in evalRow)) return " #ERR |";
          return " " + formatScalar(evalRow[c]) + " |";
        }).join("");
        lines[dataLine] = lines[dataLine].replace(/\|\s*$/, "|" + suffix);
      }
    }
  }

  return lines.join("\n");
}

function interpolateAggregates(
  body: string,
  aggregates: Record<string, Record<string, Scalar>>,
  groupedAggregates: Record<string, Record<string, Record<string, Scalar>>>,
  bodyOffset: number,
): string {
  const aggregateRe = /\{\{\s*([A-Za-z0-9_]+)\.([A-Za-z0-9_]+)(?:\[("[^"]*"|'[^']*'|[A-Za-z0-9_]+)\])?\s*\}\}/g;
  const replaceAggregates = (text: string, lineIndex: number) => {
    aggregateRe.lastIndex = 0;
    let result = "";
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = aggregateRe.exec(text))) {
      const matchStart = match.index;
      const matchEnd = match.index + match[0].length;
      result += text.slice(lastIndex, matchStart);
      const table = match[1];
      const name = match[2];
      const groupKeyRaw = match[3];
      if (groupKeyRaw) {
        const groupKey = groupKeyRaw.replace(/^['"]|['"]$/g, "");
        const tableGroups = groupedAggregates[table];
        const aggGroups = tableGroups?.[name];
        if (!aggGroups || !Object.prototype.hasOwnProperty.call(aggGroups, groupKey)) {
          throw new DiagnosticError({
            code: "E_AGG_REF",
            message: `Unknown aggregate reference ${table}.${name}[${groupKey}]`,
            table,
            aggregate: name,
            range: {
              start: { line: bodyOffset + lineIndex, character: matchStart },
              end: { line: bodyOffset + lineIndex, character: matchEnd },
            },
          });
        }
        const value = aggGroups[groupKey];
        result += value === null ? "null" : String(value);
      } else {
        const tableAgg = aggregates[table];
        if (!tableAgg || !(name in tableAgg)) {
          throw new DiagnosticError({
            code: "E_AGG_REF",
            message: `Unknown aggregate reference ${table}.${name}`,
            table,
            aggregate: name,
            range: {
              start: { line: bodyOffset + lineIndex, character: matchStart },
              end: { line: bodyOffset + lineIndex, character: matchEnd },
            },
          });
        }
        const value = tableAgg[name];
        result += value === null ? "null" : String(value);
      }
      lastIndex = matchEnd;
    }
    result += text.slice(lastIndex);
    return result;
  };

  const lines = body.split("\n");
  const output: string[] = [];
  let inFence = false;
  let fenceTicks = 0;

  for (const line of lines) {
    if (inFence) {
      output.push(line);
      if (fenceTicks > 0) {
        const fenceClose = new RegExp(`^\\s*` + "`".repeat(fenceTicks) + `\\s*$`);
        if (fenceClose.test(line)) {
          inFence = false;
          fenceTicks = 0;
        }
      }
      continue;
    }

    const fenceOpen = line.match(/^\s*(`{3,})/);
    if (fenceOpen) {
      inFence = true;
      fenceTicks = fenceOpen[1].length;
      output.push(line);
      continue;
    }

    let i = 0;
    let segmentStart = 0;
    let inInline = false;
    let inlineTicks = 0;
    let lineOut = "";

    while (i < line.length) {
      if (line[i] !== "`") {
        i += 1;
        continue;
      }
      let j = i;
      while (j < line.length && line[j] === "`") j += 1;
      const tickCount = j - i;

      if (!inInline) {
        const text = line.slice(segmentStart, i);
        lineOut += replaceAggregates(text, output.length);
        inInline = true;
        inlineTicks = tickCount;
        lineOut += line.slice(i, j);
        segmentStart = j;
      } else if (tickCount === inlineTicks) {
        lineOut += line.slice(segmentStart, j);
        inInline = false;
        inlineTicks = 0;
        segmentStart = j;
      }

      i = j;
    }

    if (inInline) {
      lineOut += line.slice(segmentStart);
    } else {
      lineOut += replaceAggregates(line.slice(segmentStart), output.length);
    }

    output.push(lineOut);
  }

  return output.join("\n");
}

export function compileMdxtab(raw: string, options: CompileOptions = {}): CompileResult {
  const { includeFrontmatter = true, includeComputedColumns = false } = options;
  const frontmatter = parseFrontmatter(raw);
  const tables = parseMarkdownTables(raw);

  const schemaNames = new Set(Object.keys(frontmatter.tables));
  const tableByName: Record<string, ParsedTable> = {};
  for (const t of tables) {
    if (!schemaNames.has(t.name)) {
      throw new DiagnosticError({
        code: "E_TABLE",
        message: `Markdown table ${t.name} not declared in frontmatter`,
        table: t.name,
        range: lineRange(t.headers[0]?.line ?? 0),
      });
    }
    if (tableByName[t.name]) {
      throw new DiagnosticError({
        code: "E_TABLE",
        message: `Duplicate table ${t.name} in markdown`,
        table: t.name,
        range: lineRange(t.headers[0]?.line ?? 0),
      });
    }
    tableByName[t.name] = t;
  }
  for (const name of schemaNames) {
    if (!tableByName[name]) {
      throw new DiagnosticError({
        code: "E_TABLE",
        message: `Missing markdown table for ${name}`,
        table: name,
      });
    }
  }

  const computedAsts: Record<string, Record<string, AstNode>> = {};
  const aggregateAsts: Record<string, Record<string, AstNode>> = {};
  const groupedAggregateDefs: Record<string, Record<string, GroupedAggregate>> = {};
  const computedOrder: Record<string, string[]> = {};
  const keyByTable: Record<string, string> = {};

  const rowList: Record<string, Record<string, Scalar>[]> = {};
  const rowMap: Record<string, Map<string, Record<string, Scalar>>> = {};

  for (const [name, schema] of Object.entries(frontmatter.tables)) {
    const table = tableByName[name];
    validateHeaders(table, schema);

    const keyName = schema.key ?? "id";
    keyByTable[name] = keyName;
    const keyIndex = schema.columns.indexOf(keyName);
    if (keyIndex === -1) {
      throw new DiagnosticError({
        code: "E_KEY_COLUMN",
        message: `Key column ${keyName} not found in schema for table ${name}`,
        table: name,
        column: keyName,
        range: lineRange(table.headers[0]?.line ?? 0),
      });
    }

    const rows: Record<string, Scalar>[] = [];
    const map = new Map<string, Record<string, Scalar>>();

    for (const row of table.rows) {
      const obj: Record<string, Scalar> = {};
      schema.columns.forEach((col, idx) => {
        try {
          obj[col] = normalizeCell(row.cells[idx].raw, schema, col);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          const cell = row.cells[idx];
          throw new DiagnosticError({
            code: errorCodeForCell(message),
            message,
            table: name,
            column: col,
            range: {
              start: { line: row.line ?? 0, character: cell?.start ?? 0 },
              end: { line: row.line ?? 0, character: cell?.end ?? 0 },
            },
          });
        }
      });
      const keyVal = obj[keyName];
      if (keyVal === null || keyVal === undefined) {
        const cell = row.cells[keyIndex] ?? row.cells[0];
        throw new DiagnosticError({
          code: "E_KEY",
          message: `Missing key value in table ${name}`,
          table: name,
          column: keyName,
          range: {
            start: { line: row.line ?? 0, character: cell?.start ?? 0 },
            end: { line: row.line ?? 0, character: cell?.end ?? 0 },
          },
        });
      }
      const key = String(keyVal);
      if (map.has(key)) {
        const cell = row.cells[keyIndex] ?? row.cells[0];
        throw new DiagnosticError({
          code: "E_KEY_DUP",
          message: `Duplicate key ${key} in table ${name}`,
          table: name,
          column: keyName,
          rowKey: key,
          range: {
            start: { line: row.line ?? 0, character: cell?.start ?? 0 },
            end: { line: row.line ?? 0, character: cell?.end ?? 0 },
          },
        });
      }
      map.set(key, obj);
      rows.push(obj);
    }

    rowList[name] = rows;
    rowMap[name] = map;

    const computed = parseExpressions(schema.computed);
    computedAsts[name] = computed;
    computedOrder[name] = buildDependencyGraph(computed).order;
    const parsedAggregates = parseAggregates(schema.aggregates);
    aggregateAsts[name] = parsedAggregates.scalar;
    groupedAggregateDefs[name] = parsedAggregates.grouped;
  }

  const computedDone = new WeakSet<Record<string, Scalar>>();
  const lookupRow: LookupRowFn = (table: string, keyValue: Scalar) => {
    const map = rowMap[table];
    if (!map) {
      throw new DiagnosticError({
        code: "E_LOOKUP",
        message: `Unknown table ${table}`,
        table,
      });
    }
    const row = map.get(String(keyValue));
    if (!row) {
      throw new DiagnosticError({
        code: "E_LOOKUP",
        message: `Missing row ${table}[${String(keyValue)}]`,
        table,
        rowKey: String(keyValue),
      });
    }
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
  const groupedAggregateResults: Record<string, Record<string, Record<string, Scalar>>> = {};
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
          lookup: (table, key, _column) => lookupRow(table, key),
          aggregate: aggregateFn,
        },
        { table: name, target: aggName, kind: "aggregate" },
      );
    }
    aggregateResults[name] = aggMap;
  }

  for (const [name, defs] of Object.entries(groupedAggregateDefs)) {
    const rows = rowList[name];
    const ensure = ensureByTable[name];
    const groupMap: Record<string, Record<string, Scalar>> = {};
    for (const [aggName, def] of Object.entries(defs)) {
      try {
        groupMap[aggName] = computeGroupedAggregate(def.fn, def.column, def.by, rows, name, ensure);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (err instanceof DiagnosticError) {
          throw new DiagnosticError({
            code: err.code,
            message: `[aggregate] table ${name} ${aggName}: ${err.message}`,
            severity: err.severity,
            table: err.table ?? name,
            column: err.column,
            aggregate: aggName,
            rowKey: err.rowKey,
            range: err.range,
          });
        }
        throw new DiagnosticError({
          code: errorCodeFromMessage(message),
          message: `[aggregate] table ${name} ${aggName}: ${message}`,
          table: name,
          aggregate: aggName,
        });
      }
    }
    groupedAggregateResults[name] = groupMap;
  }

  const results: Record<string, TableEvaluation> = {};
  for (const [name, rows] of Object.entries(rowList)) {
    const ensure = ensureByTable[name];
    results[name] = {
      name,
      rows: rows.map((r) => ensure(r)),
      aggregates: aggregateResults[name] ?? {},
      groupedAggregates: groupedAggregateResults[name] ?? {},
    };
  }

  const { frontmatter: fmText, body, bodyOffset } = splitFrontmatter(raw);
  // Inject computed columns first (uses original cell positions from parseMarkdownTables),
  // then interpolate aggregates (regex-based, position-independent).
  let renderedBody = body;
  if (includeComputedColumns) {
    renderedBody = injectComputedColumns(renderedBody, tables, frontmatter.tables as Record<string, TableFrontmatter>, results, bodyOffset);
  }
  renderedBody = interpolateAggregates(renderedBody, aggregateResults, groupedAggregateResults, bodyOffset);
  if (!includeFrontmatter && renderedBody.startsWith("\n")) {
    renderedBody = renderedBody.slice(1);
  }
  const rendered = includeFrontmatter ? `${fmText}${renderedBody}` : renderedBody;

  return { frontmatter: frontmatter as FrontmatterDocument, tables: results, rendered };
}

export function validateMdxtab(raw: string, options: CompileOptions = {}): { diagnostics: Diagnostic[] } {
  try {
    compileMdxtab(raw, options);
    return { diagnostics: [] };
  } catch (err) {
    return { diagnostics: [toDiagnostic(err)] };
  }
}
