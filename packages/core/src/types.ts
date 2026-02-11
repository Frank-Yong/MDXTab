export type Scalar = number | string | boolean | null;

export interface ColumnSchema {
  name: string;
  type?: "number" | "string" | "date" | "bool";
}

export interface ComputedColumn {
  name: string;
  expression: string;
}

export interface AggregateDefinition {
  name: string;
  expression: string;
}

export interface TableFrontmatter {
  key?: string;
  columns: string[];
  computed?: Record<string, string>;
  aggregates?: Record<string, string>;
  types?: Record<string, ColumnSchema["type"]>;
  empty_cells?: "null" | "zero" | "empty-string" | "error";
}

export interface FrontmatterDocument {
  mdxtab: string;
  tables: Record<string, TableFrontmatter>;
}

export interface HeaderCell {
  raw: string;
  trimmed: string;
}

export interface DataCell {
  raw: string;
}

export interface TableRow {
  cells: DataCell[];
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

export interface TableEvaluation {
  name: string;
  rows: Record<string, Scalar>[];
  aggregates: Record<string, Scalar>;
}

export interface CompileResult {
  frontmatter: FrontmatterDocument;
  tables: Record<string, TableEvaluation>;
  rendered: string;
}

export interface CompileOptions {
  includeFrontmatter?: boolean;
}
