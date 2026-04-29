import { parse as parseYaml } from "yaml";
import { DiagnosticError, lineRange } from "./diagnostics.js";
import type {
  FrontmatterDocument,
  PivotTableDefinition,
  ReportTableDefinition,
  SummaryRowDefinition,
  TableFrontmatter,
} from "./types.js";

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

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

function isValidIsoDate(value: string): boolean {
  if (!ISO_DATE_RE.test(value)) return false;
  const [yearRaw, monthRaw, dayRaw] = value.split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return false;

  if (month < 1 || month > 12) return false;
  if (day < 1) return false;

  const isLeapYear = (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
  const daysInMonth = [31, isLeapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day <= daysInMonth[month - 1];
}

function parsePivotTables(
  value: unknown,
  tables: Record<string, TableFrontmatter>,
  reportTables: Record<string, ReportTableDefinition>,
): Record<string, PivotTableDefinition> {
  const obj = expectObject(value, "pivot_tables");
  const result = Object.create(null) as Record<string, PivotTableDefinition>;
  const hasOwnTable = (name: string): name is keyof typeof tables =>
    Object.prototype.hasOwnProperty.call(tables, name);
  const hasOwnReportTable = (name: string): boolean =>
    Object.prototype.hasOwnProperty.call(reportTables, name);
  const pivotTableError = (name: string, message: string, column?: string): DiagnosticError =>
    new DiagnosticError({ code: "E_FRONTMATTER", message, table: name, column, range: lineRange(0) });

  const expectPivotObject = (pivotName: string, pivotValue: unknown, context: string, column?: string) => {
    try {
      return expectObject(pivotValue, context);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw pivotTableError(pivotName, message, column);
    }
  };

  const expectPivotString = (pivotName: string, pivotValue: unknown, context: string, column?: string) => {
    try {
      return expectString(pivotValue, context);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw pivotTableError(pivotName, message, column);
    }
  };

  const expectPivotStringArray = (pivotName: string, pivotValue: unknown, context: string, column?: string) => {
    try {
      return expectStringArray(pivotValue, context);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw pivotTableError(pivotName, message, column);
    }
  };

  const validateColumnReference = (
    pivotName: string,
    sourceTableName: string,
    reference: string,
    columnLabel: "rows.from" | "columns.from",
  ): string => {
    const ref = reference.trim();
    if (ref.length === 0) {
      throw pivotTableError(pivotName, `pivot_table ${pivotName} ${columnLabel} must not be empty`, columnLabel);
    }

    let tableName = sourceTableName;
    let columnName = ref;
    let usedTableReference = false;
    if (ref.includes(".")) {
      const parts = ref.split(".");
      if (parts.length !== 2 || parts[0].trim().length === 0 || parts[1].trim().length === 0) {
        throw pivotTableError(
          pivotName,
          `pivot_table ${pivotName} ${columnLabel} must be a column name or table.column reference`,
          columnLabel,
        );
      }
      tableName = parts[0].trim();
      columnName = parts[1].trim();
      usedTableReference = true;
    }

    if (!hasOwnTable(tableName)) {
      throw pivotTableError(
        pivotName,
        `pivot_table ${pivotName} ${columnLabel} references unknown table ${tableName}`,
        columnLabel,
      );
    }
    if (!tables[tableName].columns.includes(columnName)) {
      throw pivotTableError(
        pivotName,
        `pivot_table ${pivotName} ${columnLabel} references unknown column ${columnName} in table ${tableName}`,
        columnLabel,
      );
    }

    if (usedTableReference && !tables[sourceTableName].columns.includes(columnName)) {
      throw pivotTableError(
        pivotName,
        `pivot_table ${pivotName} ${columnLabel} references column ${columnName} that does not exist in source table ${sourceTableName}`,
        columnLabel,
      );
    }

    return tableName === sourceTableName ? columnName : `${tableName}.${columnName}`;
  };

  for (const [name, pivotValue] of Object.entries(obj)) {
    if (hasOwnTable(name)) {
      throw pivotTableError(name, `pivot_tables.${name} conflicts with table ${name}`);
    }
    if (hasOwnReportTable(name)) {
      throw pivotTableError(name, `pivot_tables.${name} conflicts with report_table ${name}`);
    }

    const pivotObj = expectPivotObject(name, pivotValue, `pivot_table ${name}`);
    const source = expectPivotString(name, pivotObj.source, `source for pivot_table ${name}`, "source");
    if (!hasOwnTable(source)) {
      throw pivotTableError(name, `pivot_table ${name} references unknown source table ${source}`, "source");
    }
    const sourceTable = tables[source];

    if (pivotObj.rows === undefined) {
      throw pivotTableError(name, `pivot_table ${name}: rows is required`, "rows");
    }
    const rowsObj = expectPivotObject(name, pivotObj.rows, `rows for pivot_table ${name}`, "rows");
    const rowsFromRaw = expectPivotString(name, rowsObj.from, `rows.from for pivot_table ${name}`, "rows.from");
    const rowsFrom = validateColumnReference(name, source, rowsFromRaw, "rows.from");
    const rowsOrder = rowsObj.order === undefined
      ? undefined
      : expectPivotStringArray(name, rowsObj.order, `rows.order for pivot_table ${name}`, "rows.order");

    if (pivotObj.columns === undefined) {
      throw pivotTableError(name, `pivot_table ${name}: columns is required`, "columns");
    }
    const columnsObj = expectPivotObject(name, pivotObj.columns, `columns for pivot_table ${name}`, "columns");
    const columnsFrom = expectPivotString(
      name,
      columnsObj.from,
      `columns.from for pivot_table ${name}`,
      "columns.from",
    );
    const normalizedColumnsFrom = validateColumnReference(name, source, columnsFrom, "columns.from");

    const columnsLabelRaw = columnsObj.label === undefined
      ? undefined
      : expectPivotString(name, columnsObj.label, `columns.label for pivot_table ${name}`, "columns.label");
    let columnsLabel: PivotTableDefinition["columns"]["label"];
    if (columnsLabelRaw !== undefined) {
      if (columnsLabelRaw !== "iso_date" && columnsLabelRaw !== "short_month_day") {
        throw pivotTableError(
          name,
          `pivot_table ${name} columns.label must be one of iso_date, short_month_day`,
          "columns.label",
        );
      }
      columnsLabel = columnsLabelRaw;
    }

    let columnsRange: PivotTableDefinition["columns"]["range"];
    if (columnsObj.range !== undefined) {
      const rangeObj = expectPivotObject(name, columnsObj.range, `columns.range for pivot_table ${name}`, "columns.range");
      const start = expectPivotString(
        name,
        rangeObj.start,
        `columns.range.start for pivot_table ${name}`,
        "columns.range.start",
      );
      const end = expectPivotString(
        name,
        rangeObj.end,
        `columns.range.end for pivot_table ${name}`,
        "columns.range.end",
      );

      if (!isValidIsoDate(start)) {
        throw pivotTableError(
          name,
          `pivot_table ${name} columns.range.start must be an ISO date (YYYY-MM-DD)`,
          "columns.range.start",
        );
      }
      if (!isValidIsoDate(end)) {
        throw pivotTableError(
          name,
          `pivot_table ${name} columns.range.end must be an ISO date (YYYY-MM-DD)`,
          "columns.range.end",
        );
      }
      if (start > end) {
        throw pivotTableError(
          name,
          `pivot_table ${name} columns.range.start must be before or equal to columns.range.end`,
          "columns.range",
        );
      }

      if (
        rangeObj.step !== undefined
        && rangeObj.step !== "day"
        && rangeObj.step !== "week"
        && rangeObj.step !== "month"
      ) {
        throw pivotTableError(
          name,
          `pivot_table ${name} columns.range.step must be one of day, week, month`,
          "columns.range.step",
        );
      }

      columnsRange = {
        start,
        end,
        step: rangeObj.step,
      };
    }

    const valueExpr = expectPivotString(name, pivotObj.value, `value for pivot_table ${name}`, "value");

    if (
      pivotObj.empty_cells !== undefined
      && pivotObj.empty_cells !== "null"
      && pivotObj.empty_cells !== "zero"
      && pivotObj.empty_cells !== "empty-string"
      && pivotObj.empty_cells !== "error"
    ) {
      throw pivotTableError(
        name,
        `Invalid empty_cells value for pivot_table ${name}: ${String(pivotObj.empty_cells)}`,
        "empty_cells",
      );
    }

    let totals: PivotTableDefinition["totals"];
    if (pivotObj.totals !== undefined) {
      const totalsObj = expectPivotObject(name, pivotObj.totals, `totals for pivot_table ${name}`, "totals");
      const totalsRow = totalsObj.row === undefined
        ? undefined
        : expectPivotString(name, totalsObj.row, `totals.row for pivot_table ${name}`, "totals.row");

      let totalsColumn: NonNullable<NonNullable<PivotTableDefinition["totals"]>["column"]> | undefined;
      if (totalsObj.column !== undefined) {
        const columnObj = expectPivotObject(name, totalsObj.column, `totals.column for pivot_table ${name}`, "totals.column");
        const parsedTotalsColumn = Object.create(null) as NonNullable<NonNullable<PivotTableDefinition["totals"]>["column"]>;
        for (const [footerName, footerValue] of Object.entries(columnObj)) {
          const footerPath = `totals.column.${footerName}`;
          const footerObj = expectPivotObject(
            name,
            footerValue,
            `${footerPath} for pivot_table ${name}`,
            footerPath,
          );
          if (
            footerObj.mode !== undefined
            && footerObj.mode !== "sum"
            && footerObj.mode !== "running_sum"
          ) {
            throw pivotTableError(
              name,
              `pivot_table ${name} totals.column.${footerName}.mode must be one of sum, running_sum`,
              `${footerPath}.mode`,
            );
          }
          parsedTotalsColumn[footerName] = { mode: footerObj.mode as "sum" | "running_sum" | undefined };
        }
        totalsColumn = parsedTotalsColumn;
      }

      totals = {
        row: totalsRow,
        column: totalsColumn,
      };
    }

    result[name] = {
      source,
      rows: {
        from: rowsFrom,
        order: rowsOrder,
      },
      columns: {
        from: normalizedColumnsFrom,
        range: columnsRange,
        label: columnsLabel,
      },
      value: valueExpr,
      empty_cells: pivotObj.empty_cells,
      totals,
    };
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
    const pivot_tables = obj.pivot_tables
      ? parsePivotTables(obj.pivot_tables, tables, report_tables ?? Object.create(null))
      : undefined;

    return { mdxtab, tables, report_tables, pivot_tables };
  } catch (err) {
    if (err instanceof DiagnosticError) throw err;
    const message = err instanceof Error ? err.message : String(err);
    throw new DiagnosticError({ code: "E_FRONTMATTER", message, range: lineRange(0) });
  }
}
