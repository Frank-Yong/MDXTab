import type { Diagnostic, DiagnosticRange, DiagnosticSeverity } from "./types.js";

type DiagnosticInit = {
  code: string;
  message: string;
  severity?: DiagnosticSeverity;
  table?: string;
  column?: string;
  aggregate?: string;
  rowKey?: string;
  range?: DiagnosticRange;
};

export class DiagnosticError extends Error {
  code: string;
  severity: DiagnosticSeverity;
  table?: string;
  column?: string;
  aggregate?: string;
  rowKey?: string;
  range?: DiagnosticRange;

  constructor(init: DiagnosticInit) {
    super(init.message);
    this.code = init.code;
    this.severity = init.severity ?? "error";
    this.table = init.table;
    this.column = init.column;
    this.aggregate = init.aggregate;
    this.rowKey = init.rowKey;
    this.range = init.range;
  }
}

export function isDiagnosticError(err: unknown): err is DiagnosticError {
  return err instanceof DiagnosticError;
}

export function errorCodeFromMessage(message: string): string {
  const match = message.match(/\b(E_[A-Z0-9_]+)\b/);
  return match ? match[1] : "E_UNKNOWN";
}

export function toDiagnostic(err: unknown, fallback: Partial<Diagnostic> = {}): Diagnostic {
  if (isDiagnosticError(err)) {
    return {
      code: err.code,
      message: err.message,
      severity: err.severity,
      table: err.table,
      column: err.column,
      aggregate: err.aggregate,
      rowKey: err.rowKey,
      range: err.range,
      ...fallback,
    };
  }

  const message = err instanceof Error ? err.message : String(err);
  return {
    code: errorCodeFromMessage(message),
    message,
    severity: "error",
    ...fallback,
  };
}

export function lineRange(line: number, text?: string): DiagnosticRange {
  const endChar = text ? text.length : 0;
  return {
    start: { line, character: 0 },
    end: { line, character: endChar },
  };
}
