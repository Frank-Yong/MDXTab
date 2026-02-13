import type { ParsedTable, TableRow } from "./types.js";
import { DiagnosticError, lineRange } from "./diagnostics.js";

function sliceFrontmatter(lines: string[]): { body: string[]; offset: number } {
  if (lines[0]?.trim() !== "---") return { body: lines, offset: 0 };
  const end = lines.findIndex((line, idx) => idx > 0 && line.trim() === "---");
  if (end === -1) return { body: lines, offset: 0 };
  return { body: lines.slice(end + 1), offset: end + 1 };
}

function parsePipeRow(line: string): string[] {
  return parsePipeRowWithPositions(line).map((cell) => cell.raw);
}

function parsePipeRowWithPositions(line: string): Array<{ raw: string; start: number; end: number }> {
  const startIndex = line.startsWith("|") ? 1 : 0;
  const endIndex = line.endsWith("|") ? line.length - 1 : line.length;
  const cells: Array<{ raw: string; start: number; end: number }> = [];
  let segStart = startIndex;
  for (let i = startIndex; i <= endIndex; i += 1) {
    if (i === endIndex || line[i] === "|") {
      const raw = line.slice(segStart, i);
      cells.push({ raw, start: segStart, end: i });
      segStart = i + 1;
    }
  }
  return cells;
}

function isSeparator(line: string): boolean {
  const trimmed = line.trim();
  if (!(trimmed.startsWith("|") && trimmed.endsWith("|"))) return false;
  const cells = parsePipeRow(trimmed).map((cell) => cell.trim());
  if (cells.length === 0) return false;
  return cells.every((cell) => /^:?-{3,}:?$/.test(cell));
}

function parseHeadingText(line: string): string | null {
  const match = line.match(/^#+\s+(.*)$/);
  return match ? match[1].trim() : null;
}

export function parseMarkdownTables(raw: string): ParsedTable[] {
  const lines = raw.replace(/\r\n?/g, "\n").split("\n");
  const { body, offset } = sliceFrontmatter(lines);

  const tables: ParsedTable[] = [];
  let heading: string | null = null;

  let i = 0;
  while (i < body.length) {
    const line = body[i];
    const trimmed = line.trim();

    const newHeading = parseHeadingText(trimmed);
    if (newHeading) heading = newHeading;

    const next = body[i + 1]?.trim();
    if (
      trimmed.startsWith("|") &&
      trimmed.endsWith("|") &&
      next &&
      next.startsWith("|") &&
      next.endsWith("|") &&
      isSeparator(next)
    ) {
      const headerCells = parsePipeRowWithPositions(trimmed).map((cell) => ({
        raw: cell.raw,
        trimmed: cell.raw.trim(),
        line: offset + i,
        start: cell.start,
        end: cell.end,
      }));

      const rows: TableRow[] = [];
      let j = i + 2;
      while (j < body.length) {
        const dataLine = body[j];
        const dataTrimmed = dataLine.trim();
        if (!(dataTrimmed.startsWith("|") && dataTrimmed.endsWith("|"))) break;

        const cells = parsePipeRowWithPositions(dataTrimmed);
        if (cells.some((c) => c.raw.includes("\t"))) {
          throw new DiagnosticError({
            code: "E_TABLE_TAB",
            message: "Tab characters are not allowed in data cells",
            range: lineRange(offset + j, dataLine),
          });
        }
        if (cells.length !== headerCells.length) {
          throw new DiagnosticError({
            code: "E_TABLE_COLUMN_COUNT",
            message: "Row has different number of columns than header",
            range: lineRange(offset + j, dataLine),
          });
        }
        rows.push({
          cells: cells.map((cell) => ({ raw: cell.raw, start: cell.start, end: cell.end })),
          line: offset + j,
        });
        j += 1;
      }

      const name = heading ?? `table${tables.length + 1}`;
      tables.push({ name, headers: headerCells, rows });
      i = j;
      continue;
    }

    i += 1;
  }

  return tables;
}
