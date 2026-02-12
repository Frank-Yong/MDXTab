import type { ParsedTable, TableRow } from "./types.js";

function sliceFrontmatter(lines: string[]): string[] {
  if (lines[0]?.trim() !== "---") return lines;
  const end = lines.findIndex((line, idx) => idx > 0 && line.trim() === "---");
  if (end === -1) return lines;
  return lines.slice(end + 1);
}

function parsePipeRow(line: string): string[] {
  let text = line;
  if (text.startsWith("|")) text = text.slice(1);
  if (text.endsWith("|")) text = text.slice(0, -1);
  return text.split("|").map((cell) => cell); // preserve raw spacing
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
  const body = sliceFrontmatter(lines);

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
      const headerCells = parsePipeRow(trimmed).map((cell) => ({ raw: cell, trimmed: cell.trim() }));

      const rows: TableRow[] = [];
      let j = i + 2;
      while (j < body.length) {
        const dataLine = body[j];
        const dataTrimmed = dataLine.trim();
        if (!(dataTrimmed.startsWith("|") && dataTrimmed.endsWith("|"))) break;

        const cells = parsePipeRow(dataTrimmed);
        if (cells.some((c) => c.includes("\t"))) {
          throw new Error("Tab characters are not allowed in data cells");
        }
        if (cells.length !== headerCells.length) {
          throw new Error("Row has different number of columns than header");
        }
        rows.push({ cells: cells.map((raw) => ({ raw })) });
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
