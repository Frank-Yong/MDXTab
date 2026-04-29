export type Scalar = number | string | boolean | null;

export interface ColumnSchema {
  name: string;
  type?: "number" | "string" | "date" | "bool" | "time";
}

export interface ComputedColumn {
  name: string;
  expression: string;
}

export interface AggregateDefinition {
  name: string;
  expression: string;
}

export interface SummaryRowDefinition {
  label: string;
  cells: Record<string, string>;
}

export interface ReportTableDefinition {
  rows_from: string;
  key?: string;
  columns: string[];
  cells: Record<string, string>;
}

export interface PivotRowsDefinition {
  from: string;
  order?: string[];
}

export interface PivotColumnsRangeDefinition {
  start: string;
  end: string;
  step?: "day" | "week" | "month";
}

export interface PivotColumnsDefinition {
  from: string;
  range?: PivotColumnsRangeDefinition;
  label?: string;
}

export interface PivotTotalsColumnModeDefinition {
  mode?: "sum" | "running_sum";
}

export interface PivotTotalsDefinition {
  row?: string;
  column?: Record<string, PivotTotalsColumnModeDefinition>;
}

export interface PivotTableDefinition {
  source: string;
  rows: PivotRowsDefinition;
  columns: PivotColumnsDefinition;
  value: string;
  key?: string;
  empty_cells?: "null" | "zero" | "empty-string" | "error";
  totals?: PivotTotalsDefinition;
}

export interface TableFrontmatter {
  key?: string;
  columns: string[];
  computed?: Record<string, string>;
  aggregates?: Record<string, string>;
  types?: Record<string, ColumnSchema["type"]>;
  empty_cells?: "null" | "zero" | "empty-string" | "error";
  summary_rows?: Record<string, SummaryRowDefinition>;
}

export interface FrontmatterDocument {
  mdxtab: string;
  tables: Record<string, TableFrontmatter>;
  report_tables?: Record<string, ReportTableDefinition>;
  pivot_tables?: Record<string, PivotTableDefinition>;
}

export interface HeaderCell {
  raw: string;
  trimmed: string;
  line?: number;
  start?: number;
  end?: number;
}

export interface DataCell {
  raw: string;
  start?: number;
  end?: number;
}

export interface TableRow {
  cells: DataCell[];
  line?: number;
}

export interface ParsedTable {
  name: string;
  headers: HeaderCell[];
  rows: TableRow[];
}

export interface ParseResult {
  frontmatter: FrontmatterDocument;
  tables: ParsedTable[];
}

export interface SummaryRowEvaluation {
  key: string;
  label: string;
  cells: Record<string, Scalar>;
}

export interface TableEvaluation {
  name: string;
  rows: Record<string, Scalar>[];
  aggregates: Record<string, Scalar>;
  groupedAggregates?: Record<string, Record<string, Scalar>>;
  summaryRows?: SummaryRowEvaluation[];
}

export interface ReportTableEvaluation {
  name: string;
  rowsFrom: string;
  columns: string[];
  rows: Record<string, Scalar>[];
}

export interface PivotAxisEntry {
  id: string;
  key: Scalar;
  label: string;
  index: number;
}

export interface PivotRowEvaluation {
  key: Scalar;
  values: Record<string, Scalar>;
  total?: Scalar;
}

export interface PivotFooterRowEvaluation {
  key: string;
  mode: "sum" | "running_sum";
  values: Record<string, Scalar>;
  total?: Scalar;
}

export interface PivotTableEvaluation {
  name: string;
  source: string;
  rowsFrom: string;
  columnsFrom: string;
  value: string;
  rowAxis: PivotAxisEntry[];
  columnAxis: PivotAxisEntry[];
  rows: PivotRowEvaluation[];
  rowTotalName?: string;
  footerRows?: PivotFooterRowEvaluation[];
}

export interface CompileResult {
  frontmatter: FrontmatterDocument;
  tables: Record<string, TableEvaluation>;
  reportTables: Record<string, ReportTableEvaluation>;
  pivotTables: Record<string, PivotTableEvaluation>;
  rendered: string;
}

export interface ExpressionLimits {
  maxLength: number;
  maxTokens: number;
  maxAstDepth: number;
  maxParseDepth: number;
  maxDependencyDepth: number;
}

export interface CompileOptions {
  includeFrontmatter?: boolean;
  includeComputedColumns?: boolean;
  includeSummaryRows?: boolean;
  expressionLimits?: Partial<ExpressionLimits>;
}

export interface DiagnosticPosition {
  line: number;
  character: number;
}

export interface DiagnosticRange {
  start: DiagnosticPosition;
  end: DiagnosticPosition;
}

export type DiagnosticSeverity = "error" | "warning";

export interface Diagnostic {
  code: string;
  message: string;
  severity: DiagnosticSeverity;
  table?: string;
  column?: string;
  aggregate?: string;
  rowKey?: string;
  range?: DiagnosticRange;
}
