import { parse as parseYaml } from "yaml";
import { DiagnosticError, lineRange } from "./diagnostics.js";
import type { FrontmatterDocument, ReportTableDefinition, SummaryRowDefinition, TableFrontmatter } from "./types.js";

function expectObject(value: unknown, context: string): Record<string, unknown> {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  throw new Error(`Invalid ${context}: expected object`);
}

function expectString(value: unknown, context: string): string {
  if (typeof value === "string") return value;
  throw new Error(`Invalid ${context}: expected string`);
}

function expectStringArray(value: unknown, context: string): string[] {
  if (!Array.isArray(value)) throw new Error(`Invalid ${context}: expected array of strings`);
  const arr = value.map((v) => {
    if (typeof v !== "string") throw new Error(`Invalid ${context}: expected array of strings`);
    return v;
  });
  if (arr.length === 0) throw new Error(`Invalid ${context}: must not be empty`);
  return arr;
}

function parseSummaryRows(
  tableName: string,
  value: unknown,
  columns: string[],
  computed: Record<string, string> | undefined,
): Record<string, SummaryRowDefinition> {
  const obj = expectObject(value, `summary_rows for table ${tableName}`);
  const result: Record<string, SummaryRowDefinition> = {};
  const allowedColumns = new Set<string>([...columns, ...Object.keys(computed ?? {})]);

  for (const [rowKey, rowValue] of Object.entries(obj)) {
    const rowObj = expectObject(rowValue, `summary_rows.${rowKey} for table ${tableName}`);

    if (rowObj.label === undefined) {
      throw new Error(`summary_rows.${rowKey} for table ${tableName}: label is required`);
    }
    const label = expectString(rowObj.label, `summary_rows.${rowKey}.label for table ${tableName}`);

    if (rowObj.cells === undefined) {
      throw new Error(`summary_rows.${rowKey} for table ${tableName}: cells is required`);
    }
    const cellsObj = expectObject(rowObj.cells, `summary_rows.${rowKey}.cells for table ${tableName}`);
    const cells: Record<string, string> = {};
    for (const [col, expr] of Object.entries(cellsObj)) {
      if (!allowedColumns.has(col)) {
        throw new Error(
          `summary_rows.${rowKey}.cells references unknown column "${col}" in table ${tableName}`,
        );
      }
      cells[col] = expectString(expr, `summary_rows.${rowKey}.cells.${col} for table ${tableName}`);
    }
    if (Object.keys(cells).length === 0) {
      throw new Error(`summary_rows.${rowKey}.cells for table ${tableName}: must not be empty`);
    }

    result[rowKey] = { label, cells };
  }

  return result;
}

function parseReportTables(
  value: unknown,
  tables: Record<string, TableFrontmatter>,
): Record<string, ReportTableDefinition> {
  const obj = expectObject(value, "report_tables");
  const result = Object.create(null) as Record<string, ReportTableDefinition>;
  const hasOwnTable = (name: string): name is keyof typeof tables =>
    Object.prototype.hasOwnProperty.call(tables, name);
  const reportTableError = (name: string, message: string, column?: string): DiagnosticError =>
    new DiagnosticError({ code: "E_FRONTMATTER", message, table: name, column, range: lineRange(0) });
  const expectReportObject = (reportName: string, reportValue: unknown, context: string, column?: string) => {
    try {
      return expectObject(reportValue, context);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw reportTableError(reportName, message, column);
    }
  };
  const expectReportString = (reportName: string, reportValue: unknown, context: string, column?: string) => {
    try {
      return expectString(reportValue, context);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw reportTableError(reportName, message, column);
    }
  };
  const expectReportStringArray = (
    reportName: string,
    reportValue: unknown,
    context: string,
    column?: string,
  ) => {
    try {
      return expectStringArray(reportValue, context);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw reportTableError(reportName, message, column);
    }
  };

  for (const [name, reportValue] of Object.entries(obj)) {
    if (hasOwnTable(name)) {
      throw reportTableError(name, `report_tables.${name} conflicts with table ${name}`);
    }

    const reportObj = expectReportObject(name, reportValue, `report_table ${name}`);
    const rowsFrom = expectReportString(name, reportObj.rows_from, `rows_from for report_table ${name}`, "rows_from");
    if (!hasOwnTable(rowsFrom)) {
      throw reportTableError(name, `report_table ${name} references unknown rows_from table ${rowsFrom}`, "rows_from");
    }
    const sourceTable = tables[rowsFrom];

    const columns = expectReportStringArray(name, reportObj.columns, `columns for report_table ${name}`, "columns");
    const key = reportObj.key === undefined
      ? sourceTable.key ?? "id"
      : expectReportString(name, reportObj.key, `key for report_table ${name}`, "key");
    if (!sourceTable.columns.includes(key)) {
      throw reportTableError(name, `report_table ${name} key ${key} is not a column in source table ${rowsFrom}`, "key");
    }

    if (reportObj.cells === undefined) {
      throw reportTableError(name, `report_table ${name}: cells is required`, "cells");
    }
    const cellsObj = expectReportObject(name, reportObj.cells, `cells for report_table ${name}`, "cells");
    const cells = Object.create(null) as Record<string, string>;

    for (const [column, expr] of Object.entries(cellsObj)) {
      if (!columns.includes(column)) {
        throw reportTableError(name, `report_table ${name}.cells references unknown column ${column}`, column);
      }
      cells[column] = expectReportString(name, expr, `report_table ${name}.cells.${column}`, column);
    }

    for (const column of columns) {
      if (!Object.prototype.hasOwnProperty.call(cells, column)) {
        throw reportTableError(name, `report_table ${name}.cells is missing expression for column ${column}`, column);
      }
    }

    result[name] = { rows_from: rowsFrom, key, columns, cells };
  }

  return result;
}

function validateTable(name: string, value: unknown): TableFrontmatter {
  const obj = expectObject(value, `table ${name}`);
  const columns = expectStringArray(obj.columns, `columns for table ${name}`);
  const keyName = obj.key === undefined ? "id" : expectString(obj.key, `key for table ${name}`);

  const computed = obj.computed
    ? Object.fromEntries(
        Object.entries(expectObject(obj.computed, `computed for table ${name}`)).map(([k, v]) => [
          k,
          expectString(v, `computed expression for ${name}.${k}`),
        ]),
      )
    : undefined;

  const aggregates = obj.aggregates
    ? Object.fromEntries(
        Object.entries(expectObject(obj.aggregates, `aggregates for table ${name}`)).map(([k, v]) => [
          k,
          expectString(v, `aggregate expression for ${name}.${k}`),
        ]),
      )
    : undefined;

  const types: TableFrontmatter["types"] = obj.types
    ? Object.fromEntries(
        Object.entries(expectObject(obj.types, `types for table ${name}`)).map(([k, v]) => {
          if (v !== "number" && v !== "string" && v !== "date" && v !== "bool" && v !== "time") {
            throw new Error(`Invalid type for ${name}.${k}: ${String(v)}`);
          }
          return [k, v];
        }),
      )
    : undefined;

  if (
    obj.empty_cells !== undefined &&
    obj.empty_cells !== "null" &&
    obj.empty_cells !== "zero" &&
    obj.empty_cells !== "empty-string" &&
    obj.empty_cells !== "error"
  ) {
    throw new Error(`Invalid empty_cells value for table ${name}: ${String(obj.empty_cells)}`);
  }

  const summary_rows: Record<string, SummaryRowDefinition> | undefined = obj.summary_rows
    ? parseSummaryRows(name, obj.summary_rows, columns, computed)
    : undefined;

  return {
    key: keyName,
    columns,
    computed,
    aggregates,
    types,
    empty_cells: obj.empty_cells,
    summary_rows,
  };
}

export function parseFrontmatter(raw: string): FrontmatterDocument {
  try {
    const normalized = raw.replace(/\r\n?/g, "\n");
    const start = normalized.indexOf("---\n");
    if (start !== 0) {
      throw new Error("Frontmatter must start with ---");
    }
    const end = normalized.indexOf("\n---", 4);
    if (end === -1) {
      throw new Error("Closing --- for frontmatter not found");
    }
    const yamlText = normalized.slice(4, end);
    const parsed = parseYaml(yamlText);
    const obj = expectObject(parsed, "frontmatter root");

    const mdxtab = expectString(obj.mdxtab, "mdxtab version");
    if (mdxtab !== "1.0") throw new Error(`Unsupported mdxtab version: ${mdxtab}`);

    const tablesObj = expectObject(obj.tables, "tables");
    const tables = Object.create(null) as Record<string, TableFrontmatter>;
    for (const [name, value] of Object.entries(tablesObj)) {
      tables[name] = validateTable(name, value);
    }

    const report_tables = obj.report_tables
      ? parseReportTables(obj.report_tables, tables)
      : undefined;

    return { mdxtab, tables, report_tables };
  } catch (err) {
    if (err instanceof DiagnosticError) throw err;
    const message = err instanceof Error ? err.message : String(err);
    throw new DiagnosticError({ code: "E_FRONTMATTER", message, range: lineRange(0) });
  }
}
