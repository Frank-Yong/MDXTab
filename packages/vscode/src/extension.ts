import {
  CodeAction,
  CodeActionKind,
  CodeActionProvider,
  commands,
  Diagnostic,
  DiagnosticCollection,
  DiagnosticSeverity,
  CompletionItem,
  CompletionItemKind,
  DocumentSymbol,
  DocumentSymbolProvider,
  DefinitionProvider,
  ExtensionContext,
  Hover,
  HoverProvider,
  languages,
  Location,
  MarkdownString,
  Position,
  Range,
  SymbolKind,
  TextDocument,
  TextDocumentContentProvider,
  Uri,
  window,
  WorkspaceEdit,
  workspace,
  EventEmitter,
} from "vscode";
import {
  compileMdxtab,
  parseFrontmatter,
  parseMarkdownTables,
  toDiagnostic,
  validateMdxtab,
  type CompileOptions,
  type Diagnostic as CoreDiagnostic,
} from "./core/index.js";

const SCHEME = "mdxtab-preview";

function makePreviewUri(docUri: Uri): Uri {
  return Uri.from({ scheme: SCHEME, path: docUri.path, query: encodeURIComponent(docUri.toString()) });
}

function getExpressionLimitOptionsFromConfig(): CompileOptions["expressionLimits"] {
  const config = workspace.getConfiguration("mdxtab");
  const maxExpressionLength = config.get<number>("limits.maxExpressionLength", 4096);
  const maxTokens = config.get<number>("limits.maxTokens", 512);
  const maxAstDepth = config.get<number>("limits.maxAstDepth", 64);
  const maxParseDepth = config.get<number>("limits.maxParseDepth", 256);
  const maxDependencyDepth = config.get<number>("limits.maxDependencyDepth", 128);

  return {
    maxLength: maxExpressionLength,
    maxTokens,
    maxAstDepth,
    maxParseDepth,
    maxDependencyDepth,
  };
}

function getCompileOptionsFromConfig(): CompileOptions {
  const config = workspace.getConfiguration("mdxtab");
  const showFrontmatter = config.get<boolean>("preview.showFrontmatter", false);
  const showComputedColumns = config.get<boolean>("preview.showComputedColumns", true);
  const showSummaryRows = config.get<boolean>("preview.showSummaryRows", true);

  return {
    includeFrontmatter: showFrontmatter,
    includeComputedColumns: showComputedColumns,
    includeSummaryRows: showSummaryRows,
    expressionLimits: getExpressionLimitOptionsFromConfig(),
  };
}

function getValidationCompileOptionsFromConfig(): CompileOptions {
  return {
    expressionLimits: getExpressionLimitOptionsFromConfig(),
  };
}

class PreviewProvider implements TextDocumentContentProvider {
  private emitter = new EventEmitter<Uri>();

  readonly onDidChange = this.emitter.event;

  refresh(uri: Uri) {
    this.emitter.fire(uri);
  }

  async provideTextDocumentContent(uri: Uri): Promise<string> {
    const target = uri.query ? Uri.parse(decodeURIComponent(uri.query)) : undefined;
    const doc = target ? await workspace.openTextDocument(target) : undefined;
    if (!doc) return "No document to render";
    try {
      const result = compileMdxtab(doc.getText(), getCompileOptionsFromConfig());
      return result.rendered;
    } catch (err) {
      const diag = toDiagnostic(err);
      return formatDiagnostics([diag]);
    }
  }
}

class MdxtabSymbolProvider implements DocumentSymbolProvider {
  constructor(private cache: Map<string, ParsedContext>) {}

  provideDocumentSymbols(document: TextDocument): DocumentSymbol[] {
    if (document.languageId !== "markdown") return [];
    const context = getParsedContext(document, this.cache);
    if (!context.frontmatter || !context.tables) return [];
    const { frontmatter, tables, entries } = context;

    const tableByName = new Map(tables.map((table) => [table.name, table]));
    const symbols: DocumentSymbol[] = [];

    for (const [name, schema] of Object.entries(frontmatter.tables)) {
      const table = tableByName.get(name);
      if (!table) continue;

      const header = table.headers[0];
      const lastRow = table.rows[table.rows.length - 1];
      const startLine = header?.line ?? 0;
      const startChar = header?.start ?? 0;
      const endLine = lastRow?.line ?? startLine;
      const endChar = lastRow?.cells[lastRow.cells.length - 1]?.end ?? header?.end ?? startChar + 1;
      const range = new Range(new Position(startLine, startChar), new Position(endLine, endChar));
      const selectionRange = new Range(
        new Position(startLine, startChar),
        new Position(startLine, header?.end ?? startChar + 1),
      );

      const tableSymbol = new DocumentSymbol(name, "table", SymbolKind.Struct, range, selectionRange);
      const children: DocumentSymbol[] = [];

      for (const cell of table.headers) {
        const colName = cell.trimmed;
        const colRange = new Range(
          new Position(cell.line ?? startLine, cell.start ?? startChar),
          new Position(cell.line ?? startLine, cell.end ?? (cell.start ?? startChar) + 1),
        );
        children.push(new DocumentSymbol(colName, "column", SymbolKind.Field, colRange, colRange));
      }

      const aggregateNames = Object.keys(schema.aggregates ?? {});
      for (const aggName of aggregateNames) {
        const entry = entries.find(
          (item) => item.kind === "aggregate" && item.table === name && item.name === aggName,
        );
        const aggRange = entry
          ? new Range(new Position(entry.line, entry.start), new Position(entry.line, entry.end))
          : range;
        const aggSelection = entry
          ? new Range(new Position(entry.line, entry.start), new Position(entry.line, entry.end))
          : selectionRange;
        children.push(new DocumentSymbol(aggName, "aggregate", SymbolKind.Function, aggRange, aggSelection));
      }

      tableSymbol.children = children;
      symbols.push(tableSymbol);
    }

    return symbols;
  }
}

type HoverEntry = {
  table: string;
  kind: "computed" | "aggregate" | "report-table" | "pivot-table";
  name: string;
  expr: string;
  line: number;
  start: number;
  end: number;
  exprStart: number;
  exprEnd: number;
};

class MdxtabHoverProvider implements HoverProvider {
  constructor(private cache: Map<string, ParsedContext>) {}

  provideHover(document: TextDocument, position: Position): Hover | undefined {
    if (document.languageId !== "markdown") return undefined;
    const entry = findHoverEntry(document, position, this.cache);
    if (!entry) return undefined;

    const title =
      entry.kind === "computed"
        ? "Computed"
        : entry.kind === "aggregate"
        ? "Aggregate"
        : entry.kind === "report-table"
        ? "Report Table"
        : "Pivot Table";
    const label = `${entry.table}.${entry.name}`;
    const md = new MarkdownString(`**${title}:** ${label}\n\n\`${entry.expr}\``);
    return new Hover(md);
  }
}

class MdxtabCompletionProvider {
  constructor(private cache: Map<string, ParsedContext>) {}

  provideCompletionItems(document: TextDocument, position: Position): CompletionItem[] {
    if (document.languageId !== "markdown") return [];
    const context = getParsedContext(document, this.cache);
    if (!context.frontmatter || !context.frontmatterBounds) return [];
    const { frontmatter: parsedFrontmatter, tables: parsedTables, entries, lines, fencedLines } = context;
    const entry = entries.find(
      (item) =>
        item.line === position.line && position.character >= item.exprStart && position.character <= item.exprEnd,
    );

    const items: CompletionItem[] = [];
    if (entry && parsedFrontmatter) {
      const lineText = lines[position.line] ?? "";
      const dotTable = findDotCompletionTable(lineText, position.character, entry.table, parsedFrontmatter);
      if (dotTable) {
        const table = parsedFrontmatter.tables[dotTable];
        if (table) {
          for (const col of table.columns) {
            items.push(new CompletionItem(col, CompletionItemKind.Field));
          }
        }
        return items;
      }
      const table = parsedFrontmatter.tables[entry.table];
      if (table) {
        for (const col of table.columns) {
          items.push(new CompletionItem(col, CompletionItemKind.Field));
        }
      }
      for (const name of Object.keys(parsedFrontmatter.tables)) {
        items.push(new CompletionItem(name, CompletionItemKind.Struct));
      }
      for (const fn of ["sum", "avg", "min", "max", "count", "round", "if"]) {
        const item = new CompletionItem(fn, CompletionItemKind.Function);
        item.insertText = fn + "(";
        items.push(item);
      }
      return items;
    }

    if (parsedFrontmatter && parsedTables) {
      const headingStart = fencedLines.has(position.line)
        ? undefined
        : matchHeadingStart(lines[position.line] ?? "", position.character);
      if (headingStart) {
        for (const name of Object.keys(parsedFrontmatter.report_tables ?? {})) {
          items.push(new CompletionItem(name, CompletionItemKind.Struct));
        }
        for (const name of Object.keys(parsedFrontmatter.pivot_tables ?? {})) {
          items.push(new CompletionItem(name, CompletionItemKind.Struct));
        }
        return items;
      }

      const interpolation = matchAggregateInterpolation(lines[position.line] ?? "", position.character);
      if (interpolation) {
        const table = parsedFrontmatter.tables[interpolation.table];
        if (table?.aggregates) {
          for (const aggName of Object.keys(table.aggregates)) {
            items.push(new CompletionItem(aggName, CompletionItemKind.Function));
          }
        }
        return items;
      }

      const interpolationStart = matchInterpolationStart(lines[position.line] ?? "", position.character);
      if (interpolationStart) {
        for (const name of Object.keys(parsedFrontmatter.tables)) {
          items.push(new CompletionItem(name, CompletionItemKind.Struct));
        }
        return items;
      }
    }

    return [];
  }
}

class MdxtabDefinitionProvider implements DefinitionProvider {
  constructor(private cache: Map<string, ParsedContext>) {}

  provideDefinition(document: TextDocument, position: Position): Location | undefined {
    if (document.languageId !== "markdown") return undefined;
    const context = getParsedContext(document, this.cache);
    if (!context.frontmatter || !context.tables || !context.frontmatterBounds) return undefined;
    const { frontmatter: parsedFrontmatter, tables: parsedTables, entries, lines } = context;

    const interpolation = matchAggregateInterpolation(lines[position.line] ?? "", position.character);
    if (interpolation) {
      const match = entries.find(
        (entry) => entry.kind === "aggregate" && entry.table === interpolation.table && entry.name === interpolation.name,
      );
      if (match) {
        const range = new Range(
          new Position(match.line, match.start),
          new Position(match.line, match.end),
        );
        return new Location(document.uri, range);
      }
    }

    for (const table of parsedTables) {
      const schema = parsedFrontmatter.tables[table.name];
      if (!schema?.computed) continue;
      for (const header of table.headers) {
        if (header.line !== position.line) continue;
        const start = header.start ?? 0;
        const end = header.end ?? start + header.trimmed.length;
        if (position.character < start || position.character > end) continue;
        const name = header.trimmed;
        const match = entries.find(
          (entry) => entry.kind === "computed" && entry.table === table.name && entry.name === name,
        );
        if (match) {
          const range = new Range(
            new Position(match.line, match.start),
            new Position(match.line, match.end),
          );
          return new Location(document.uri, range);
        }
      }
    }

    return undefined;
  }
}

class MdxtabCodeActionProvider implements CodeActionProvider {
  provideCodeActions(
    document: TextDocument,
    _range: Range,
    context: { diagnostics: readonly Diagnostic[] },
  ): CodeAction[] {
    if (document.languageId !== "markdown") return [];
    if (!looksLikeMdxtab(document.getText())) return [];

    const actions: CodeAction[] = [];
    for (const diag of context.diagnostics) {
      if (diag.source !== "mdxtab") continue;
      const code = getDiagnosticCode(diag);
      if (!code) continue;
      if (code === "E_TABLE_TAB") {
        const action = fixTabsInRow(document, diag);
        if (action) actions.push(action);
      }
      if (code === "E_TABLE") {
        const action = addMissingTable(document, diag);
        if (action) actions.push(action);
      }
      if (code === "E_COLUMN_MISMATCH") {
        const action = fixTableHeader(document, diag);
        if (action) actions.push(action);
      }
      if (code === "E_KEY_COLUMN") {
        const action = addMissingKeyColumn(document, diag);
        if (action) actions.push(action);
      }
      if (code === "E_REF") {
        const action = addColumnFromUnknownRef(document, diag);
        if (action) actions.push(action);
      }
      if (code === "E_LOOKUP") {
        const action = addMissingLookupRow(document, diag);
        if (action) actions.push(action);
      }
      if (code === "E_TABLE_COLUMN_COUNT") {
        const action = fixRowColumnCount(document, diag);
        if (action) actions.push(action);
      }
      if (code === "E_KEY") {
        const action = fillMissingKey(document, diag);
        if (action) actions.push(action);
      }
      if (code === "E_KEY_DUP") {
        const action = fixDuplicateKey(document, diag);
        if (action) actions.push(action);
      }
    }
    return actions;
  }
}

function findHoverEntry(
  document: TextDocument,
  position: Position,
  cache: Map<string, ParsedContext>,
): HoverEntry | undefined {
  const context = getParsedContext(document, cache);
  const { lines, frontmatterBounds, frontmatter, tables, entries, fencedLines } = context;
  if (!frontmatterBounds) return undefined;

  if (position.line > frontmatterBounds.start && position.line < frontmatterBounds.end) {
    for (const entry of entries) {
      if (entry.line !== position.line) continue;
      if (position.character < entry.start || position.character > entry.end) continue;
      return entry;
    }
  }

  if (frontmatter && tables) {
    return findBodyHoverEntry(lines, position, frontmatter, tables, fencedLines);
  }

  return undefined;
}

function getFrontmatterBounds(lines: string[]): { start: number; end: number } | undefined {
  if (lines.length === 0 || lines[0].trim() !== "---") return undefined;
  for (let i = 1; i < lines.length; i += 1) {
    if (lines[i].trim() === "---") return { start: 0, end: i };
  }
  return undefined;
}

function getFencedLines(lines: string[]): Set<number> {
  const fencedLines = new Set<number>();
  let inFence = false;
  let fenceTicks = 0;

  for (let i = 0; i < lines.length; i += 1) {
    if (inFence) {
      fencedLines.add(i);
      const closeRe = new RegExp(`^\\s*` + "`" + `{${fenceTicks},}\\s*$`);
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

function parseFrontmatterEntries(lines: string[], start: number, end: number): HoverEntry[] {
  const entries: HoverEntry[] = [];
  let tablesIndent: number | undefined;
  let tableIndent: number | undefined;
  let sectionIndent: number | undefined;
  let currentTable = "";
  let currentSection: "computed" | "aggregate" | undefined;

  for (let i = start; i < end; i += 1) {
    const line = lines[i];
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const indent = line.match(/^\s*/)?.[0].length ?? 0;

    if (/^tables\s*:/i.test(trimmed)) {
      tablesIndent = indent;
      currentTable = "";
      currentSection = undefined;
      continue;
    }

    if (tablesIndent !== undefined && indent > tablesIndent && trimmed.endsWith(":")) {
      const nameMatch = trimmed.match(/^([A-Za-z0-9_]+)\s*:/);
      if (nameMatch) {
        currentTable = nameMatch[1];
        tableIndent = indent;
        currentSection = undefined;
        continue;
      }
    }

    if (tableIndent !== undefined && indent > tableIndent) {
      const sectionMatch = trimmed.match(/^(computed|aggregates)\s*:/);
      if (sectionMatch) {
        currentSection = sectionMatch[1] === "computed" ? "computed" : "aggregate";
        sectionIndent = indent;
        continue;
      }
    }

    if (currentTable && currentSection && sectionIndent !== undefined && indent > sectionIndent) {
      const entryMatch = trimmed.match(/^([A-Za-z0-9_]+)\s*:\s*(.*)$/);
      if (entryMatch) {
        const name = entryMatch[1];
        const expr = entryMatch[2];
        const startIndex = line.indexOf(name);
        const endIndex = startIndex + name.length;
        const colonIndex = line.indexOf(":", endIndex);
        let exprStart = colonIndex === -1 ? endIndex + 1 : colonIndex + 1;
        while (exprStart < line.length && line[exprStart] === " ") exprStart += 1;
        const exprEnd = line.length;
        entries.push({
          table: currentTable,
          kind: currentSection,
          name,
          expr,
          line: i,
          start: startIndex,
          end: endIndex,
          exprStart,
          exprEnd,
        });
      }
    }
  }

  return entries;
}

function findBodyHoverEntry(
  lines: string[],
  position: Position,
  frontmatter: ReturnType<typeof parseFrontmatter>,
  tables: ReturnType<typeof parseMarkdownTables>,
  fencedLines: Set<number>,
): HoverEntry | undefined {
  if (fencedLines.has(position.line)) return undefined;
  const lineText = lines[position.line] ?? "";
  const heading = extractHeadingInfo(lineText);
  if (heading) {
    const { text, start, end } = heading;
    if (position.character >= start && position.character <= end) {
      const report = frontmatter.report_tables?.[text];
      if (report) {
        return {
          table: text,
          kind: "report-table",
          name: "rows_from",
          expr: `rows_from=${report.rows_from}, columns=${report.columns.join(", ")}`,
          line: position.line,
          start,
          end,
          exprStart: start,
          exprEnd: end,
        };
      }
      const pivot = frontmatter.pivot_tables?.[text];
      if (pivot) {
        return {
          table: text,
          kind: "pivot-table",
          name: "source",
          expr: `source=${pivot.source}, rows.from=${pivot.rows.from}, columns.from=${pivot.columns.from}, value=${pivot.value}`,
          line: position.line,
          start,
          end,
          exprStart: start,
          exprEnd: end,
        };
      }
    }
  }

  const aggregateMatch = matchAggregateInterpolation(lineText, position.character);
  if (aggregateMatch) {
    const table = frontmatter.tables[aggregateMatch.table];
    const expr = table?.aggregates?.[aggregateMatch.name];
    if (expr) {
      return {
        table: aggregateMatch.table,
        kind: "aggregate",
        name: aggregateMatch.name,
        expr,
        line: position.line,
        start: aggregateMatch.start,
        end: aggregateMatch.end,
        exprStart: aggregateMatch.start,
        exprEnd: aggregateMatch.end,
      };
    }
  }

  for (const table of tables) {
    const schema = frontmatter.tables[table.name];
    if (!schema?.computed) continue;
    for (const header of table.headers) {
      if (header.line !== position.line) continue;
      const start = header.start ?? 0;
      const end = header.end ?? start + header.trimmed.length;
      if (position.character < start || position.character > end) continue;
      const expr = schema.computed[header.trimmed];
      if (!expr) continue;
      return {
        table: table.name,
        kind: "computed",
        name: header.trimmed,
        expr,
        line: header.line ?? position.line,
        start,
        end,
        exprStart: start,
        exprEnd: end,
      };
    }
  }

  return undefined;
}

function matchAggregateInterpolation(
  line: string,
  position: number,
): { table: string; name: string; start: number; end: number } | undefined {
  const re = /\{\{\s*([A-Za-z0-9_]+)\.([A-Za-z0-9_]+)\s*\}\}/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(line))) {
    const start = match.index;
    const end = match.index + match[0].length;
    if (position >= start && position <= end) {
      return { table: match[1], name: match[2], start, end };
    }
  }
  return undefined;
}

function matchInterpolationStart(line: string, position: number): { start: number } | undefined {
  const startIndex = line.lastIndexOf("{{", position);
  if (startIndex === -1) return undefined;
  const endIndex = line.indexOf("}}", startIndex + 2);
  if (endIndex !== -1 && endIndex < position) return undefined;
  return { start: startIndex };
}

function matchHeadingStart(line: string, position: number): { start: number } | undefined {
  const heading = extractHeadingInfo(line);
  if (!heading) return undefined;
  const { start, end } = heading;
  if (position < start || position > end) return undefined;
  return { start };
}

function extractHeadingInfo(line: string): { text: string; start: number; end: number } | undefined {
  const markerMatch = line.match(/^\s*#{1,6}\s+/);
  if (!markerMatch) return undefined;
  const rawHeading = line.slice(markerMatch[0].length);
  const text = rawHeading.trim();
  const leadingWhitespace = rawHeading.match(/^\s*/)?.[0].length ?? 0;
  const start = markerMatch[0].length + leadingWhitespace;
  const end = start + text.length;
  return { text, start, end };
}

function findDotCompletionTable(
  line: string,
  position: number,
  currentTable: string,
  frontmatter: ReturnType<typeof parseFrontmatter>,
): string | undefined {
  const prefix = line.slice(0, position);
  const match = prefix.match(/([A-Za-z0-9_]+)\s*(?:\[[^\]]*\])?\s*\.\s*([A-Za-z0-9_]*)$/);
  if (!match) return undefined;
  const tableName = match[1];
  if (tableName === "row") return currentTable;
  if (tableName in frontmatter.tables) return tableName;
  return undefined;
}

function updateDiagnostics(
  doc: TextDocument,
  collection: DiagnosticCollection,
) {
  if (doc.languageId !== "markdown") return;
  const text = doc.getText();
  if (!looksLikeMdxtab(text)) {
    collection.delete(doc.uri);
    return;
  }
  const diagnostics = validateMdxtab(text, getValidationCompileOptionsFromConfig()).diagnostics;
  if (diagnostics.length === 0) {
    collection.delete(doc.uri);
    return;
  }
  collection.set(doc.uri, diagnostics.map((diag) => toVsDiagnostic(diag)));
}

function toVsDiagnostic(diag: CoreDiagnostic): Diagnostic {
  const range = diag.range
    ? new Range(
        new Position(diag.range.start.line, diag.range.start.character),
        new Position(diag.range.end.line, diag.range.end.character),
      )
    : new Range(new Position(0, 0), new Position(0, 1));
  const severity = diag.severity === "warning" ? DiagnosticSeverity.Warning : DiagnosticSeverity.Error;
  const contextParts: string[] = [];
  if (diag.table) contextParts.push(`table=${diag.table}`);
  if (diag.column) contextParts.push(`column=${diag.column}`);
  if (diag.aggregate) contextParts.push(`aggregate=${diag.aggregate}`);
  if (diag.rowKey) contextParts.push(`row=${diag.rowKey}`);
  const context = contextParts.length > 0 ? ` (${contextParts.join(", ")})` : "";
  const message = diag.code ? `[${diag.code}] ${diag.message}${context}` : `${diag.message}${context}`;
  const vsDiag = new Diagnostic(range, message, severity);
  vsDiag.code = diag.code;
  vsDiag.source = "mdxtab";
  return vsDiag;
}

function looksLikeMdxtab(text: string): boolean {
  if (!text.startsWith("---")) return false;
  const end = text.indexOf("\n---", 3);
  if (end === -1) return false;
  const frontmatter = text.slice(0, end + 4);
  return /\nmdxtab\s*:/.test(frontmatter);
}

function getDiagnosticCode(diag: Diagnostic): string | undefined {
  if (typeof diag.code === "string") return diag.code;
  if (diag.code && typeof diag.code === "object" && "value" in diag.code) {
    return String((diag.code as { value: unknown }).value);
  }
  return undefined;
}

function fixTabsInRow(document: TextDocument, diag: Diagnostic): CodeAction | undefined {
  const lineIndex = diag.range?.start.line;
  if (lineIndex === undefined) return undefined;
  const line = document.lineAt(lineIndex);
  if (!line.text.includes("\t")) return undefined;
  const replacement = line.text.replace(/\t/g, "  ");
  const edit = new WorkspaceEdit();
  edit.replace(document.uri, line.range, replacement);
  const action = new CodeAction("MDXTab: replace tabs with spaces", CodeActionKind.QuickFix);
  action.edit = edit;
  action.diagnostics = [diag];
  return action;
}

function addMissingTable(document: TextDocument, diag: Diagnostic): CodeAction | undefined {
  const tableName = extractMissingTableName(diag.message);
  if (!tableName) return undefined;
  let frontmatter: ReturnType<typeof parseFrontmatter>;
  let tables: ReturnType<typeof parseMarkdownTables>;
  try {
    frontmatter = parseFrontmatter(document.getText());
    tables = parseMarkdownTables(document.getText());
  } catch {
    return undefined;
  }
  if (!frontmatter.tables[tableName]) return undefined;
  if (tables.some((table) => table.name === tableName)) return undefined;

  const schema = frontmatter.tables[tableName];
  const columns = schema.columns;
  if (columns.length === 0) return undefined;

  const header = `| ${columns.join(" | ")} |`;
  const separator = `|${columns.map(() => "---").join("|")}|`;
  const row = `| ${columns.map(() => " ").join(" | ")} |`;
  const suffix = document.getText().endsWith("\n") ? "\n" : "\n\n";
  const insertText = `${suffix}## ${tableName}\n\n${header}\n${separator}\n${row}\n`;

  const edit = new WorkspaceEdit();
  edit.insert(document.uri, document.positionAt(document.getText().length), insertText);
  const action = new CodeAction(`MDXTab: add table '${tableName}'`, CodeActionKind.QuickFix);
  action.edit = edit;
  action.diagnostics = [diag];
  return action;
}

function fixTableHeader(document: TextDocument, diag: Diagnostic): CodeAction | undefined {
  const tableName = extractTableNameFromMessage(diag.message);
  if (!tableName) return undefined;
  let frontmatter: ReturnType<typeof parseFrontmatter>;
  let tables: ReturnType<typeof parseMarkdownTables>;
  try {
    frontmatter = parseFrontmatter(document.getText());
    tables = parseMarkdownTables(document.getText());
  } catch {
    return undefined;
  }
  const schema = frontmatter.tables[tableName];
  if (!schema) return undefined;
  const table = tables.find((t) => t.name === tableName);
  const headerLine = table?.headers[0]?.line;
  if (headerLine === undefined) return undefined;

  const line = document.lineAt(headerLine);
  const indent = line.text.match(/^\s*/)?.[0] ?? "";
  const header = `${indent}| ${schema.columns.join(" | ")} |`;

  const edit = new WorkspaceEdit();
  edit.replace(document.uri, line.range, header);
  const action = new CodeAction(`MDXTab: align header for '${tableName}'`, CodeActionKind.QuickFix);
  action.edit = edit;
  action.diagnostics = [diag];
  return action;
}

function addMissingKeyColumn(document: TextDocument, diag: Diagnostic): CodeAction | undefined {
  const match = diag.message.match(/Key column ([A-Za-z0-9_]+)/);
  const keyName = match ? match[1] : undefined;
  const tableName = extractTableNameFromMessage(diag.message) ?? extractContextValue(diag.message, "table");
  if (!keyName || !tableName) return undefined;
  return addColumnToSchema(document, diag, tableName, keyName, `MDXTab: add key column '${keyName}'`);
}

function addColumnFromUnknownRef(document: TextDocument, diag: Diagnostic): CodeAction | undefined {
  const columnMatch = diag.message.match(/unknown column ([A-Za-z0-9_]+)/);
  const identMatch = diag.message.match(/unknown identifier ([A-Za-z0-9_]+)/);
  const columnName = columnMatch?.[1] ?? identMatch?.[1];
  if (!columnName) return undefined;
  const tableName = extractContextValue(diag.message, "table");
  if (!tableName) return undefined;
  return addColumnToSchema(document, diag, tableName, columnName, `MDXTab: add column '${columnName}'`);
}

function addMissingLookupRow(document: TextDocument, diag: Diagnostic): CodeAction | undefined {
  const match = diag.message.match(/Missing row ([A-Za-z0-9_]+)\[([^\]]+)\]/);
  if (!match) return undefined;
  const tableName = match[1];
  const rowKey = match[2];
  let frontmatter: ReturnType<typeof parseFrontmatter>;
  let tables: ReturnType<typeof parseMarkdownTables>;
  try {
    frontmatter = parseFrontmatter(document.getText());
    tables = parseMarkdownTables(document.getText());
  } catch {
    return undefined;
  }
  const schema = frontmatter.tables[tableName];
  if (!schema) return undefined;
  const columns = schema.columns;
  if (columns.length === 0) return undefined;
  const keyName = schema.key ?? "id";
  const keyIndex = columns.indexOf(keyName);
  if (keyIndex === -1) return undefined;

  const table = tables.find((t) => t.name === tableName);
  const lastRow = table?.rows[table.rows.length - 1];
  if (!table || !lastRow || lastRow.line === undefined) return undefined;

  const values = columns.map((col) => (col === keyName ? rowKey : ""));
  const row = `| ${values.join(" | ")} |`;
  const insertPos = document.lineAt(lastRow.line).range.end;

  const edit = new WorkspaceEdit();
  edit.insert(document.uri, insertPos, `\n${row}`);
  const action = new CodeAction(`MDXTab: add missing row '${rowKey}'`, CodeActionKind.QuickFix);
  action.edit = edit;
  action.diagnostics = [diag];
  return action;
}

function fixRowColumnCount(document: TextDocument, diag: Diagnostic): CodeAction | undefined {
  if (!diag.range) return undefined;
  const rowLine = diag.range.start.line;
  const lines = document.getText().replace(/\r\n?/g, "\n").split("\n");
  const headerLine = findHeaderLineForRow(lines, rowLine);
  if (headerLine === undefined) return undefined;
  const headerCells = parsePipeRowCells(lines[headerLine]).map((cell) => cell.trim());
  if (headerCells.length === 0) return undefined;

  const headerCount = headerCells.length;
  const currentCells = parsePipeRowCells(lines[rowLine]).map((cell) => cell.trim());
  const nextCells = currentCells.slice(0, headerCount);
  while (nextCells.length < headerCount) nextCells.push("");

  const line = document.lineAt(rowLine);
  const indent = line.text.match(/^\s*/)?.[0] ?? "";
  const replacement = `${indent}| ${nextCells.join(" | ")} |`;
  const edit = new WorkspaceEdit();
  edit.replace(document.uri, line.range, replacement);
  const action = new CodeAction("MDXTab: align row column count", CodeActionKind.QuickFix);
  action.edit = edit;
  action.diagnostics = [diag];
  return action;
}

function fillMissingKey(document: TextDocument, diag: Diagnostic): CodeAction | undefined {
  if (!diag.range) return undefined;
  const tableName = extractTableNameFromMessage(diag.message);
  if (!tableName) return undefined;
  let frontmatter: ReturnType<typeof parseFrontmatter>;
  let tables: ReturnType<typeof parseMarkdownTables>;
  try {
    frontmatter = parseFrontmatter(document.getText());
    tables = parseMarkdownTables(document.getText());
  } catch {
    return undefined;
  }
  const schema = frontmatter.tables[tableName];
  if (!schema) return undefined;
  const keyName = schema.key ?? "id";
  const keyIndex = schema.columns.indexOf(keyName);
  if (keyIndex === -1) return undefined;

  const rowLine = diag.range.start.line;
  const table = tables.find((t) => t.name === tableName);
  const row = table?.rows.find((r) => r.line === rowLine);
  if (!row) return undefined;
  const cell = row.cells[keyIndex];
  if (!cell || cell.start === undefined || cell.end === undefined) return undefined;

  const value = `row_${rowLine + 1}`;
  const edit = new WorkspaceEdit();
  edit.replace(document.uri, new Range(rowLine, cell.start, rowLine, cell.end), ` ${value} `);
  const action = new CodeAction("MDXTab: fill missing key", CodeActionKind.QuickFix);
  action.edit = edit;
  action.diagnostics = [diag];
  return action;
}

function fixDuplicateKey(document: TextDocument, diag: Diagnostic): CodeAction | undefined {
  if (!diag.range) return undefined;
  const tableName = extractTableNameFromMessage(diag.message);
  const keyMatch = diag.message.match(/Duplicate key ([^\s]+)/);
  const keyValue = keyMatch ? keyMatch[1] : undefined;
  if (!tableName || !keyValue) return undefined;
  let frontmatter: ReturnType<typeof parseFrontmatter>;
  let tables: ReturnType<typeof parseMarkdownTables>;
  try {
    frontmatter = parseFrontmatter(document.getText());
    tables = parseMarkdownTables(document.getText());
  } catch {
    return undefined;
  }
  const schema = frontmatter.tables[tableName];
  if (!schema) return undefined;
  const keyName = schema.key ?? "id";
  const keyIndex = schema.columns.indexOf(keyName);
  if (keyIndex === -1) return undefined;

  const rowLine = diag.range.start.line;
  const table = tables.find((t) => t.name === tableName);
  const row = table?.rows.find((r) => r.line === rowLine);
  if (!row) return undefined;
  const cell = row.cells[keyIndex];
  if (!cell || cell.start === undefined || cell.end === undefined) return undefined;

  const value = `${keyValue}_${rowLine + 1}`;
  const edit = new WorkspaceEdit();
  edit.replace(document.uri, new Range(rowLine, cell.start, rowLine, cell.end), ` ${value} `);
  const action = new CodeAction("MDXTab: make key unique", CodeActionKind.QuickFix);
  action.edit = edit;
  action.diagnostics = [diag];
  return action;
}

function addColumnToSchema(
  document: TextDocument,
  diag: Diagnostic,
  tableName: string,
  columnName: string,
  title: string,
): CodeAction | undefined {
  let frontmatter: ReturnType<typeof parseFrontmatter>;
  try {
    frontmatter = parseFrontmatter(document.getText());
  } catch {
    return undefined;
  }
  const schema = frontmatter.tables[tableName];
  if (!schema) return undefined;
  if (schema.columns.includes(columnName)) return undefined;

  const updated = [...schema.columns, columnName];
  const lines = document.getText().replace(/\r\n?/g, "\n").split("\n");
  const bounds = getFrontmatterBounds(lines);
  if (!bounds) return undefined;

  const tableLine = findTableLine(lines, bounds.start + 1, bounds.end, tableName);
  if (tableLine === undefined) return undefined;
  const tableIndent = lines[tableLine].match(/^\s*/)?.[0] ?? "";

  const columnsLine = findColumnsLine(lines, tableLine + 1, bounds.end, tableIndent.length);
  const columnsText = `${tableIndent}  columns: [${updated.join(", ")}]`;

  const edit = new WorkspaceEdit();
  if (columnsLine !== undefined) {
    const targetLine = document.lineAt(columnsLine);
    edit.replace(document.uri, targetLine.range, columnsText);
  } else {
    const insertLine = document.lineAt(tableLine).range.end;
    edit.insert(document.uri, insertLine, `\n${columnsText}`);
  }

  const action = new CodeAction(title, CodeActionKind.QuickFix);
  action.edit = edit;
  action.diagnostics = [diag];
  return action;
}

function findTableLine(lines: string[], start: number, end: number, tableName: string): number | undefined {
  const tableRe = new RegExp(`^\\s*${escapeRegExp(tableName)}\\s*:`);
  for (let i = start; i < end; i += 1) {
    if (tableRe.test(lines[i])) return i;
  }
  return undefined;
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function findHeaderLineForRow(lines: string[], rowLine: number): number | undefined {
  for (let i = rowLine - 1; i >= 1; i -= 1) {
    if (isSeparatorLine(lines[i])) {
      const headerLine = i - 1;
      if (headerLine >= 0 && isPipeRow(lines[headerLine])) return headerLine;
    }
    if (!lines[i].trim()) break;
  }
  return undefined;
}

function isPipeRow(line: string): boolean {
  const trimmed = line.trim();
  return trimmed.startsWith("|") && trimmed.endsWith("|");
}

function parsePipeRowCells(line: string): string[] {
  const firstPipe = line.indexOf("|");
  const lastPipe = line.lastIndexOf("|");
  if (firstPipe === -1 || lastPipe === -1 || lastPipe <= firstPipe) return [];
  const body = line.slice(firstPipe + 1, lastPipe);
  return body.split("|");
}

function isSeparatorLine(line: string): boolean {
  const trimmed = line.trim();
  if (!(trimmed.startsWith("|") && trimmed.endsWith("|"))) return false;
  const cells = parsePipeRowCells(trimmed).map((cell) => cell.trim());
  if (cells.length === 0) return false;
  return cells.every((cell) => /^:?-{3,}:?$/.test(cell));
}

function findColumnsLine(
  lines: string[],
  start: number,
  end: number,
  tableIndent: number,
): number | undefined {
  for (let i = start; i < end; i += 1) {
    const line = lines[i];
    const indent = line.match(/^\s*/)?.[0].length ?? 0;
    if (indent <= tableIndent && /\S/.test(line)) return undefined;
    if (/^\s*columns\s*:/.test(line)) return i;
  }
  return undefined;
}

function extractTableNameFromMessage(message: string): string | undefined {
  const match = message.match(/table ([A-Za-z0-9_]+)/);
  return match ? match[1] : undefined;
}

function extractMissingTableName(message: string): string | undefined {
  const missingMatch = message.match(/Missing markdown table for ([A-Za-z0-9_]+)/);
  if (missingMatch) return missingMatch[1];
  const contextMatch = message.match(/table=([A-Za-z0-9_]+)/);
  return contextMatch ? contextMatch[1] : undefined;
}

function extractContextValue(message: string, key: string): string | undefined {
  const match = message.match(new RegExp(`${key}=([A-Za-z0-9_]+)`));
  return match ? match[1] : undefined;
}

type ParsedContext = {
  version: number;
  lines: string[];
  fencedLines: Set<number>;
  frontmatterBounds?: { start: number; end: number };
  frontmatter?: ReturnType<typeof parseFrontmatter>;
  tables?: ReturnType<typeof parseMarkdownTables>;
  entries: HoverEntry[];
};

function getParsedContext(document: TextDocument, cache: Map<string, ParsedContext>): ParsedContext {
  const key = document.uri.toString();
  const cached = cache.get(key);
  if (cached && cached.version === document.version) return cached;

  const text = document.getText();
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const fencedLines = getFencedLines(lines);
  const frontmatterBounds = getFrontmatterBounds(lines);
  let frontmatter: ReturnType<typeof parseFrontmatter> | undefined;
  let tables: ReturnType<typeof parseMarkdownTables> | undefined;
  let entries: HoverEntry[] = [];

  if (looksLikeMdxtab(text) && frontmatterBounds) {
    try {
      frontmatter = parseFrontmatter(text);
      tables = parseMarkdownTables(text);
      entries = parseFrontmatterEntries(lines, frontmatterBounds.start + 1, frontmatterBounds.end);
    } catch {
      frontmatter = undefined;
      tables = undefined;
      entries = [];
    }
  }

  const parsed: ParsedContext = {
    version: document.version,
    lines,
    fencedLines,
    frontmatterBounds,
    frontmatter,
    tables,
    entries,
  };
  cache.set(key, parsed);
  return parsed;
}

function formatDiagnostics(diagnostics: CoreDiagnostic[]): string {
  const lines = diagnostics.map((diag) => {
    const location = diag.range
      ? ` at ${diag.range.start.line + 1}:${diag.range.start.character + 1}`
      : "";
    return `- ${diag.code}: ${diag.message}${location}`;
  });
  return ["## MDXTab Errors", "", ...lines, ""].join("\n");
}

export function activate(context: ExtensionContext) {
  const provider = new PreviewProvider();
  context.subscriptions.push(workspace.registerTextDocumentContentProvider(SCHEME, provider));

  const parsedCache = new Map<string, ParsedContext>();

  const visiblePreviews = new Set<string>();
  const updateVisiblePreviews = () => {
    visiblePreviews.clear();
    for (const editor of window.visibleTextEditors) {
      const uri = editor.document.uri;
      if (uri.scheme !== SCHEME) continue;
      if (!uri.query) continue;
      const target = Uri.parse(decodeURIComponent(uri.query));
      visiblePreviews.add(target.toString());
    }
  };
  updateVisiblePreviews();
  context.subscriptions.push(window.onDidChangeVisibleTextEditors(() => updateVisiblePreviews()));

  const diagnostics = languages.createDiagnosticCollection("mdxtab");
  context.subscriptions.push(diagnostics);
  context.subscriptions.push(
    workspace.onDidOpenTextDocument((doc) => updateDiagnostics(doc, diagnostics)),
  );
  context.subscriptions.push(
    workspace.onDidCloseTextDocument((doc) => {
      diagnostics.delete(doc.uri);
      parsedCache.delete(doc.uri.toString());
      const key = doc.uri.toString();
      const pending = pendingUpdates.get(key);
      if (pending) {
        clearTimeout(pending);
        pendingUpdates.delete(key);
      }
    }),
  );
  context.subscriptions.push(
    languages.registerDocumentSymbolProvider({ language: "markdown" }, new MdxtabSymbolProvider(parsedCache)),
  );
  context.subscriptions.push(
    languages.registerHoverProvider({ language: "markdown" }, new MdxtabHoverProvider(parsedCache)),
  );
  context.subscriptions.push(
    languages.registerCompletionItemProvider(
      { language: "markdown" },
      new MdxtabCompletionProvider(parsedCache),
      ".",
      "{",
    ),
  );
  context.subscriptions.push(
    languages.registerDefinitionProvider({ language: "markdown" }, new MdxtabDefinitionProvider(parsedCache)),
  );
  context.subscriptions.push(
    languages.registerCodeActionsProvider(
      { language: "markdown" },
      new MdxtabCodeActionProvider(),
      { providedCodeActionKinds: [CodeActionKind.QuickFix] },
    ),
  );
  const debounceMs = 200;
  const pendingUpdates = new Map<string, ReturnType<typeof setTimeout>>();
  const scheduleUpdate = (doc: TextDocument) => {
    if (doc.languageId !== "markdown") return;
    if (!looksLikeMdxtab(doc.getText())) {
      diagnostics.delete(doc.uri);
      return;
    }
    const key = doc.uri.toString();
    const existing = pendingUpdates.get(key);
    if (existing) clearTimeout(existing);
    const handle = setTimeout(() => {
      pendingUpdates.delete(key);
      updateDiagnostics(doc, diagnostics);
      if (visiblePreviews.has(doc.uri.toString())) {
        provider.refresh(makePreviewUri(doc.uri));
      }
    }, debounceMs);
    pendingUpdates.set(key, handle);
  };
  context.subscriptions.push({
    dispose: () => {
      for (const handle of pendingUpdates.values()) clearTimeout(handle);
      pendingUpdates.clear();
    },
  });
  context.subscriptions.push(workspace.onDidChangeTextDocument((e) => {
    scheduleUpdate(e.document);
  }));
  context.subscriptions.push(workspace.onDidSaveTextDocument((doc) => {
    updateDiagnostics(doc, diagnostics);
    if (doc.languageId === "markdown" && visiblePreviews.has(doc.uri.toString())) {
      provider.refresh(makePreviewUri(doc.uri));
    }
  }));

  const renderPreview = commands.registerCommand("mdxtab.renderPreview", async () => {
    const editor = window.activeTextEditor;
    if (!editor) {
      window.showErrorMessage("No active editor to render");
      return;
    }
    const docUri = editor.document.uri;
    const previewUri = makePreviewUri(docUri);
    provider.refresh(previewUri);
    await commands.executeCommand("vscode.open", previewUri, { preview: true });
  });
  context.subscriptions.push(renderPreview);

  const validateCommand = commands.registerCommand("mdxtab.validateDocument", async () => {
    const editor = window.activeTextEditor;
    if (!editor) {
      window.showErrorMessage("No active editor to validate");
      return;
    }
    updateDiagnostics(editor.document, diagnostics);
    const { diagnostics: diags } = validateMdxtab(editor.document.getText(), getValidationCompileOptionsFromConfig());
    if (diags.length === 0) {
      window.showInformationMessage("MDXTab: no diagnostics");
    } else {
      window.showWarningMessage(`MDXTab: ${diags.length} diagnostic(s)`);
    }
  });
  context.subscriptions.push(validateCommand);

  const showSchemaCommand = commands.registerCommand("mdxtab.showTableSchema", async () => {
    const editor = window.activeTextEditor;
    if (!editor) {
      window.showErrorMessage("No active editor to inspect");
      return;
    }

    const text = editor.document.getText();
    if (!looksLikeMdxtab(text)) {
      window.showWarningMessage("MDXTab: active file does not look like an MDXTab document");
      return;
    }

    let frontmatter: ReturnType<typeof parseFrontmatter>;
    try {
      frontmatter = parseFrontmatter(text);
    } catch (err) {
      const detail = err instanceof Error ? `: ${err.message}` : "";
      window.showErrorMessage(`MDXTab: could not read table schema from frontmatter${detail}`);
      return;
    }

    const tableCount = Object.keys(frontmatter.tables).length;
    const reportCount = Object.keys(frontmatter.report_tables ?? {}).length;
    const pivotCount = Object.keys(frontmatter.pivot_tables ?? {}).length;
    if (tableCount === 0 && reportCount === 0 && pivotCount === 0) {
      window.showInformationMessage("MDXTab: no schemas found in frontmatter");
      return;
    }

    try {
      const schemaJson = JSON.stringify(
        {
          tables: frontmatter.tables,
          report_tables: frontmatter.report_tables ?? {},
          pivot_tables: frontmatter.pivot_tables ?? {},
        },
        null,
        2,
      );
      const schemaDoc = await workspace.openTextDocument({
        language: "markdown",
        content: [
          "# MDXTab Table Schema",
          "",
          `Source: ${editor.document.uri.fsPath || editor.document.uri.toString()}`,
          "",
          "```json",
          schemaJson,
          "```",
          "",
        ].join("\n"),
      });

      await window.showTextDocument(schemaDoc, { preview: true });
    } catch (err) {
      const detail = err instanceof Error ? `: ${err.message}` : "";
      window.showErrorMessage(`MDXTab: could not open schema view${detail}`);
    }
  });
  context.subscriptions.push(showSchemaCommand);

  const active = window.activeTextEditor?.document;
  if (active) updateDiagnostics(active, diagnostics);

  return { extendMarkdownIt };
}

function extendMarkdownIt(md: { core: { ruler: { after: (name: string, rule: string, fn: (state: { src: string }) => void) => void } } }) {
  md.core.ruler.after("normalize", "mdxtab", (state) => {
    const text = state.src;
    if (!looksLikeMdxtab(text)) return;
    const config = workspace.getConfiguration("mdxtab");
    const enabled = config.get<boolean>("preview.markdownIt.enabled", true);
    if (!enabled) return;
    try {
      const result = compileMdxtab(text, getCompileOptionsFromConfig());
      state.src = result.rendered;
    } catch (err) {
      const diag = toDiagnostic(err);
      state.src = formatDiagnostics([diag]);
    }
  });
  return md;
}

export function deactivate() {
  // nothing to clean up
}
