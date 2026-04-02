import { buildDependencyGraph } from "./dependency-graph.js";
import { evaluateAst } from "./evaluator.js";
import { parseExpression, type AstNode } from "./parser.js";
import { parseFrontmatter } from "./frontmatter.js";
import { parseMarkdownTables } from "./markdown.js";
import { lexExpression } from "./tokens.js";
import { assertExpressionLength, normalizeExpressionLimits } from "./expression-limits.js";
import { DiagnosticError, errorCodeFromMessage, lineRange, toDiagnostic } from "./diagnostics.js";
import type {
  CompileOptions,
  CompileResult,
  Diagnostic,
  ExpressionLimits,
  FrontmatterDocument,
  ParsedTable,
  ReportTableDefinition,
  ReportTableEvaluation,
  Scalar,
  SummaryRowDefinition,
  SummaryRowEvaluation,
  TableEvaluation,
  TableFrontmatter,
} from "./types.js";

const NUMERIC_RE = /^-?\d+(?:\.\d+)?$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d+:\d{2}$/;

type ColumnType = "number" | "string" | "date" | "bool" | "time" | undefined;
type LookupRowFn = (table: string, key: Scalar) => Record<string, Scalar>;

interface EvalRowContext {
  [key: string]: Scalar | EvalRowContext;
}

type EvalKind = "computed" | "aggregate" | "summary-row" | "report-table";

type GroupedAggregate = {
  fn: string;
  column: string;
  by: string;
};

type ParsedReportTable = {
  rowsFrom: string;
  key: string;
  columns: string[];
  cells: Record<string, AstNode>;
};

function evalWithContext(
  ast: AstNode,
  ctx: {
    row: EvalRowContext;
    lookup: (table: string, key: Scalar, column: string) => Record<string, Scalar>;
    aggregate: (fn: string, col: string) => Scalar;
  },
  info: { table: string; target: string; kind: EvalKind; keyName?: string; rowKey?: string },
  limits: ExpressionLimits,
): Scalar {
  try {
    const value = evaluateAst(ast, ctx, limits);
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
        column:
          err.column ??
            (info.kind === "computed" || info.kind === "summary-row" || info.kind === "report-table"
              ? info.target
              : undefined),
        aggregate: err.aggregate ?? (info.kind === "aggregate" ? info.target : undefined),
        rowKey: err.rowKey ?? info.rowKey,
        range: err.range,
      });
    }
    throw new DiagnosticError({
      code: errorCodeFromMessage(message),
      message: contextMessage,
      table: info.table,
      column: info.kind === "computed" || info.kind === "summary-row" || info.kind === "report-table"
        ? info.target
        : undefined,
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

function wrapExpressionDiagnostic(
  err: unknown,
  info: { table: string; target: string; kind: EvalKind | "dependency"; aggregate?: boolean; rowKey?: string },
): DiagnosticError {
  const message = err instanceof Error ? err.message : String(err);
  const targetName = info.target || "<expression>";
  const contextTarget = targetName;
  const targetColumn = targetName.startsWith("<") ? undefined : targetName;
  const rowPart = info.rowKey ? ` summary_row=${info.rowKey}` : "";
  const contextMessage = `[${info.kind}] table ${info.table} ${contextTarget}${rowPart}: ${message}`;
  if (err instanceof DiagnosticError) {
    return new DiagnosticError({
      code: err.code,
      message: contextMessage,
      severity: err.severity,
      table: err.table ?? info.table,
      column: info.aggregate ? err.column : err.column ?? targetColumn,
      aggregate: info.aggregate ? err.aggregate ?? targetName : err.aggregate,
      rowKey: err.rowKey ?? info.rowKey,
      range: err.range,
    });
  }
  return new DiagnosticError({
    code: errorCodeFromMessage(message),
    message: contextMessage,
    table: info.table,
    column: info.aggregate ? undefined : targetColumn,
    aggregate: info.aggregate ? targetName : undefined,
    rowKey: info.rowKey,
  });
}

function parseComputedExpressions(
  tableName: string,
  map: Record<string, string> | undefined,
  limits: ExpressionLimits,
): Record<string, AstNode> {
  if (!map) return {};

  const result: Record<string, AstNode> = {};
  for (const [column, expr] of Object.entries(map)) {
    try {
      result[column] = parseExpression(lexExpression(expr, limits), limits);
    } catch (err) {
      throw wrapExpressionDiagnostic(err, { table: tableName, target: column, kind: "computed" });
    }
  }

  return result;
}

function parseAggregates(tableName: string, map: Record<string, string> | undefined, limits: ExpressionLimits): {
  scalar: Record<string, AstNode>;
  grouped: Record<string, GroupedAggregate>;
} {
  if (!map) {
    return {
      scalar: Object.create(null) as Record<string, AstNode>,
      grouped: Object.create(null) as Record<string, GroupedAggregate>,
    };
  }
  const scalar = Object.create(null) as Record<string, AstNode>;
  const grouped = Object.create(null) as Record<string, GroupedAggregate>;
  const groupRe = /^(sum|avg|min|max|count)\s*\(\s*([A-Za-z_][A-Za-z0-9_]*)\s*\)\s+by\s+([A-Za-z_][A-Za-z0-9_]*)\s*$/i;
  for (const [name, expr] of Object.entries(map)) {
    try {
      assertExpressionLength(expr, limits);
      const match = expr.trim().match(groupRe);
      if (match) {
        grouped[name] = { fn: match[1].toLowerCase(), column: match[2], by: match[3] };
        continue;
      }
      scalar[name] = parseExpression(lexExpression(expr, limits), limits);
    } catch (err) {
      throw wrapExpressionDiagnostic(err, {
        table: tableName,
        target: name,
        kind: "aggregate",
        aggregate: true,
      });
    }
  }
  return { scalar, grouped };
}

function parseReportTableExpressions(
  reportTables: Record<string, ReportTableDefinition> | undefined,
  limits: ExpressionLimits,
): Record<string, ParsedReportTable> {
  if (!reportTables) return Object.create(null) as Record<string, ParsedReportTable>;

  const result = Object.create(null) as Record<string, ParsedReportTable>;
  for (const [name, report] of Object.entries(reportTables)) {
    const cells: Record<string, AstNode> = {};
    for (const [column, expr] of Object.entries(report.cells)) {
      try {
        cells[column] = parseExpression(lexExpression(expr, limits), limits);
      } catch (err) {
        throw wrapExpressionDiagnostic(err, { table: name, target: column, kind: "report-table" });
      }
    }
    result[name] = {
      rowsFrom: report.rows_from,
      key: report.key ?? "id",
      columns: report.columns,
      cells,
    };
  }

  return result;
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
  limits: ExpressionLimits,
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
      limits,
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

function evaluateSummaryRows(
  tableName: string,
  defs: Record<string, SummaryRowDefinition>,
  rows: Record<string, Scalar>[],
  ensure: (row: Record<string, Scalar>) => Record<string, Scalar>,
  limits: ExpressionLimits,
): SummaryRowEvaluation[] {
  const results: SummaryRowEvaluation[] = [];
  for (const [rowKey, def] of Object.entries(defs)) {
    const selfCells: Record<string, Scalar> = {};
    const cellEntries = Object.entries(def.cells);

    for (const [col, exprStr] of cellEntries) {
      let ast: AstNode;
      try {
        ast = parseExpression(lexExpression(exprStr, limits), limits);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        throw new DiagnosticError({
          code: errorCodeFromMessage(message),
          message: `[summary-row] table ${tableName} ${col} summary_row=${rowKey}: ${message}`,
          table: tableName,
          column: col,
          rowKey,
        });
      }
      const aggregateFn = (fn: string, column: string) =>
        computeAggregate(fn, column, rows, tableName, ensure);

      const value = evalWithContext(
        ast,
        {
          row: { self: selfCells },
          lookup: () => {
            throw new Error("E_REF: lookup not supported in summary row expressions");
          },
          aggregate: aggregateFn,
        },
        { table: tableName, target: col, kind: "summary-row", keyName: "summary_row", rowKey },
        limits,
      );
      selfCells[col] = value;
    }

    results.push({ key: rowKey, label: def.label, cells: selfCells });
  }
  return results;
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

function getFencedLines(lines: string[]): Set<number> {
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
  return fencedLines;
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
  const fencedLines = getFencedLines(lines);

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

function injectSummaryRows(
  body: string,
  parsedTables: ParsedTable[],
  schemas: Record<string, TableFrontmatter>,
  evaluatedTables: Record<string, TableEvaluation>,
  bodyOffset: number,
  includeComputedColumns: boolean,
): string {
  const lines = body.split("\n");
  const fencedLines = getFencedLines(lines);

  // Process tables in reverse document order so that line insertions
  // for earlier tables don't shift the line indices of later tables.
  const tablesWithSummary = parsedTables
    .filter((pt) => {
      const evaluated = evaluatedTables[pt.name];
      return evaluated?.summaryRows && evaluated.summaryRows.length > 0;
    })
    .map((pt) => {
      // Determine insertion point in the body:
      // - after last data row when data rows exist
      // - otherwise after the separator row (header + 1)
      const lastRow = pt.rows[pt.rows.length - 1];
      const headerLine = (pt.headers[0]?.line ?? 0) - bodyOffset;
      const insertAfterLine = lastRow
        ? (lastRow.line ?? 0) - bodyOffset
        : headerLine + 1;
      return { pt, insertAfterLine };
    })
    .sort((a, b) => b.insertAfterLine - a.insertAfterLine);

  for (const { pt, insertAfterLine } of tablesWithSummary) {
    if (insertAfterLine < 0 || insertAfterLine >= lines.length) continue;

    // Skip tables whose header line falls inside a fenced code block.
    const headerLine = (pt.headers[0]?.line ?? 0) - bodyOffset;
    if (fencedLines.has(headerLine)) continue;

    const schema = schemas[pt.name];
    const evaluated = evaluatedTables[pt.name];
    if (!evaluated?.summaryRows) continue;

    // Build the effective column list for the current render mode.
    // Extra computed columns only exist in the table when computed-column
    // injection is enabled.
    const authoredHeaders = pt.headers.map((h) => h.trimmed);
    const extraComputed = includeComputedColumns && schema.computed
      ? Object.keys(schema.computed).filter((c) => !authoredHeaders.includes(c))
      : [];
    const allColumns = [...authoredHeaders, ...extraComputed];
    const keyCol = schema.key ?? "id";
    const keyIndex = allColumns.indexOf(keyCol);

    // Build one pipe-delimited row per summary row
    const summaryLines: string[] = [];
    for (const sr of evaluated.summaryRows) {
      const cells = allColumns.map((col, idx) => {
        // The label goes in the key column (first identifying column)
        if (idx === keyIndex || (keyIndex === -1 && idx === 0)) {
          return ` ${formatScalar(sr.label)} `;
        }
        if (col in sr.cells) {
          const val = formatScalar(sr.cells[col]);
          return val === "" ? " " : ` ${val} `;
        }
        return " ";
      });
      summaryLines.push(`|${cells.join("|")}|`);
    }

    // Insert after last data row (or after separator when table has no data rows)
    lines.splice(insertAfterLine + 1, 0, ...summaryLines);
  }

  return lines.join("\n");
}

function renderMarkdownTable(columns: string[], rows: Record<string, Scalar>[]): string[] {
  const headerCells = columns.map((column) => formatScalar(column));
  const header = `| ${headerCells.join(" | ")} |`;
  const separator = `|${headerCells.map((column) => "-".repeat(Math.max(column.length + 2, 3))).join("|")}|`;
  const dataLines = rows.map((row) => `| ${columns.map((column) => formatScalar(row[column])).join(" | ")} |`);
  return [header, separator, ...dataLines];
}

function isMarkdownTableStart(lines: string[], startIndex: number): boolean {
  if (startIndex + 1 >= lines.length) return false;
  const header = lines[startIndex];
  const separator = lines[startIndex + 1];
  if (!isPipeDelimitedRow(header)) return false;
  return /^\s*\|?(?:\s*:?-{3,}:?\s*\|)+\s*$/.test(separator);
}

function isPipeDelimitedRow(line: string): boolean {
  const trimmed = line.trim();
  return trimmed.startsWith("|") && trimmed.endsWith("|");
}

function injectReportTables(
  body: string,
  reportTables: Record<string, ReportTableEvaluation>,
): string {
  const hasOwnReportTable = (heading: string): heading is keyof typeof reportTables =>
    Object.prototype.hasOwnProperty.call(reportTables, heading);
  const lines = body.split("\n");
  const fencedLines = getFencedLines(lines);
  const headings = lines
    .map((line, index) => ({ line, index }))
    .filter(({ line, index }) => !fencedLines.has(index))
    .map(({ line, index }) => ({
      index,
      heading: line.match(/^\s*#{1,6}\s+(.*)$/)?.[1].trim(),
    }))
    .filter((entry): entry is { index: number; heading: string } => Boolean(entry.heading))
    .filter(({ heading }) => hasOwnReportTable(heading))
    .sort((a, b) => b.index - a.index);

  for (const { index, heading } of headings) {
    const report = reportTables[heading];
    const tableLines = renderMarkdownTable(report.columns, report.rows);
    let replaceStart = index + 1;
    while (replaceStart < lines.length && lines[replaceStart].trim() === "") {
      replaceStart += 1;
    }
    let replaceEnd = replaceStart;
    if (isMarkdownTableStart(lines, replaceStart)) {
      replaceEnd = replaceStart + 2;
      while (replaceEnd < lines.length && isPipeDelimitedRow(lines[replaceEnd])) {
        replaceEnd += 1;
      }
    }
    lines.splice(replaceStart, replaceEnd - replaceStart, ...tableLines);
  }

  return lines.join("\n");
}

function evaluateReportTables(
  reportTables: Record<string, ParsedReportTable>,
  rowList: Record<string, Record<string, Scalar>[]>,
  ensureByTable: Record<string, (row: Record<string, Scalar>) => Record<string, Scalar>>,
  lookupRow: LookupRowFn,
  aggregateResults: Record<string, Record<string, Scalar>>,
  groupedAggregateResults: Record<string, Record<string, Record<string, Scalar>>>,
  limits: ExpressionLimits,
): Record<string, ReportTableEvaluation> {
  const results = Object.create(null) as Record<string, ReportTableEvaluation>;
  const reportScope = Object.create(null) as EvalRowContext;

  const tableNames = new Set<string>([
    ...Object.keys(aggregateResults),
    ...Object.keys(groupedAggregateResults),
  ]);
  for (const tableName of tableNames) {
    reportScope[tableName] = Object.assign(
      Object.create(null),
      aggregateResults[tableName] ?? {},
      groupedAggregateResults[tableName] ?? {},
    ) as EvalRowContext;
  }

  for (const [name, report] of Object.entries(reportTables)) {
    const sourceRows = rowList[report.rowsFrom] ?? [];
    const ensure = ensureByTable[report.rowsFrom];
    const evaluatedRows: Record<string, Scalar>[] = [];

    for (const sourceRow of sourceRows) {
      const ensuredRow = ensure(sourceRow);
      const rowKey = String(ensuredRow[report.key] ?? "");
      const scopedRow: EvalRowContext = {
        ...ensuredRow,
        ...reportScope,
        row: ensuredRow,
      };
      const evaluated = Object.create(null) as Record<string, Scalar>;

      for (const column of report.columns) {
        evaluated[column] = evalWithContext(
          report.cells[column],
          {
            row: scopedRow,
            lookup: (table, key, _column) => lookupRow(table, key),
            aggregate: () => {
              throw new Error("E_AGG_IN_REPORT: aggregates not allowed in report table cell evaluation");
            },
          },
          { table: name, target: column, kind: "report-table", keyName: report.key, rowKey },
          limits,
        );
      }

      evaluatedRows.push(evaluated);
    }

    results[name] = {
      name,
      rowsFrom: report.rowsFrom,
      columns: report.columns,
      rows: evaluatedRows,
    };
  }

  return results;
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
  const {
    includeFrontmatter = true,
    includeComputedColumns = false,
    includeSummaryRows = false,
    expressionLimits,
  } = options;
  const limits = normalizeExpressionLimits(expressionLimits);
  const frontmatter = parseFrontmatter(raw);
  const tables = parseMarkdownTables(raw);

  const schemaNames = new Set(Object.keys(frontmatter.tables));
  const reportTableNames = new Set(Object.keys(frontmatter.report_tables ?? {}));
  const tableByName: Record<string, ParsedTable> = {};
  for (const t of tables) {
    if (!schemaNames.has(t.name)) {
      if (reportTableNames.has(t.name)) {
        continue;
      }
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
  const aggregateAsts = Object.create(null) as Record<string, Record<string, AstNode>>;
  const groupedAggregateDefs = Object.create(null) as Record<string, Record<string, GroupedAggregate>>;
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

    const computed = parseComputedExpressions(name, schema.computed, limits);
    computedAsts[name] = computed;
    try {
      computedOrder[name] = buildDependencyGraph(computed, limits).order;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const targetMatch = message.match(/(?:involving|visiting)\s+([A-Za-z_][A-Za-z0-9_]*)/);
      const target = targetMatch?.[1] ?? "<computed>";
      throw wrapExpressionDiagnostic(err, { table: name, target, kind: "dependency" });
    }

    const parsedAggregates = parseAggregates(name, schema.aggregates, limits);
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
    return ensureComputed(table, row, keyName, rowKey, computedOrder, computedAsts, lookupRow, computedDone, limits);
  };

  const ensureByTable: Record<string, (row: Record<string, Scalar>) => Record<string, Scalar>> = {};
  for (const name of Object.keys(rowList)) {
    ensureByTable[name] = (row) => {
      const keyName = keyByTable[name];
      const rowKey = String(row[keyName] ?? "");
      return ensureComputed(name, row, keyName, rowKey, computedOrder, computedAsts, lookupRow, computedDone, limits);
    };
  }

  // materialize computed columns for all rows
  for (const [name, rows] of Object.entries(rowList)) {
    const ensure = ensureByTable[name];
    rows.forEach((r) => ensure(r));
  }

  const aggregateResults = Object.create(null) as Record<string, Record<string, Scalar>>;
  const groupedAggregateResults = Object.create(null) as Record<string, Record<string, Record<string, Scalar>>>;
  for (const [name, asts] of Object.entries(aggregateAsts)) {
    const rows = rowList[name];
    const ensure = ensureByTable[name];
    const aggMap = Object.create(null) as Record<string, Scalar>;
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
        limits,
      );
    }
    aggregateResults[name] = aggMap;
  }

  for (const [name, defs] of Object.entries(groupedAggregateDefs)) {
    const rows = rowList[name];
    const ensure = ensureByTable[name];
    const groupMap = Object.create(null) as Record<string, Record<string, Scalar>>;
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

  const parsedReportTables = parseReportTableExpressions(frontmatter.report_tables, limits);
  const reportTableResults = evaluateReportTables(
    parsedReportTables,
    rowList,
    ensureByTable,
    lookupRow,
    aggregateResults,
    groupedAggregateResults,
    limits,
  );

  const results: Record<string, TableEvaluation> = {};
  for (const [name, rows] of Object.entries(rowList)) {
    const ensure = ensureByTable[name];
    const schema = frontmatter.tables[name];
    const summaryRows = schema.summary_rows
      ? evaluateSummaryRows(name, schema.summary_rows, rows, ensure, limits)
      : undefined;
    results[name] = {
      name,
      rows: rows.map((r) => ensure(r)),
      aggregates: aggregateResults[name] ?? {},
      groupedAggregates: groupedAggregateResults[name] ?? {},
      summaryRows,
    };
  }

  const { frontmatter: fmText, body, bodyOffset } = splitFrontmatter(raw);
  // Inject computed columns first (uses original cell positions from parseMarkdownTables),
  // then summary rows (appended after last data row),
  // then interpolate aggregates (regex-based, position-independent).
  let renderedBody = body;
  if (includeComputedColumns) {
    renderedBody = injectComputedColumns(renderedBody, tables, frontmatter.tables as Record<string, TableFrontmatter>, results, bodyOffset);
  }
  if (includeSummaryRows) {
    renderedBody = injectSummaryRows(
      renderedBody,
      tables,
      frontmatter.tables as Record<string, TableFrontmatter>,
      results,
      bodyOffset,
      includeComputedColumns,
    );
  }
  renderedBody = injectReportTables(renderedBody, reportTableResults);
  renderedBody = interpolateAggregates(renderedBody, aggregateResults, groupedAggregateResults, bodyOffset);
  if (!includeFrontmatter && renderedBody.startsWith("\n")) {
    renderedBody = renderedBody.slice(1);
  }
  const rendered = includeFrontmatter ? `${fmText}${renderedBody}` : renderedBody;

  return {
    frontmatter: frontmatter as FrontmatterDocument,
    tables: results,
    reportTables: reportTableResults,
    rendered,
  };
}

export function validateMdxtab(raw: string, options: CompileOptions = {}): { diagnostics: Diagnostic[] } {
  try {
    compileMdxtab(raw, options);
    return { diagnostics: [] };
  } catch (err) {
    return { diagnostics: [toDiagnostic(err)] };
  }
}
