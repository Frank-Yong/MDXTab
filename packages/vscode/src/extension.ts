import {
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
  workspace,
  EventEmitter,
} from "vscode";
import {
  compileMdxtab,
  parseFrontmatter,
  parseMarkdownTables,
  validateMdxtab,
  type Diagnostic as CoreDiagnostic,
} from "@mdxtab/core";

const SCHEME = "mdxtab-preview";

function makePreviewUri(docUri: Uri): Uri {
  return Uri.from({ scheme: SCHEME, path: docUri.path, query: encodeURIComponent(docUri.toString()) });
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
      const config = workspace.getConfiguration("mdxtab");
      const showFrontmatter = config.get<boolean>("preview.showFrontmatter", false);
      const { diagnostics } = validateMdxtab(doc.getText(), { includeFrontmatter: showFrontmatter });
      if (diagnostics.length > 0) return formatDiagnostics(diagnostics);
      const result = compileMdxtab(doc.getText(), { includeFrontmatter: showFrontmatter });
      return result.rendered;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return `Render error: ${message}`;
    }
  }
}

class MdxtabSymbolProvider implements DocumentSymbolProvider {
  provideDocumentSymbols(document: TextDocument): DocumentSymbol[] {
    if (document.languageId !== "markdown") return [];
    const text = document.getText();
    if (!looksLikeMdxtab(text)) return [];

    let frontmatter: ReturnType<typeof parseFrontmatter>;
    let tables: ReturnType<typeof parseMarkdownTables>;
    try {
      frontmatter = parseFrontmatter(text);
      tables = parseMarkdownTables(text);
    } catch {
      return [];
    }

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
        children.push(new DocumentSymbol(aggName, "aggregate", SymbolKind.Function, range, selectionRange));
      }

      tableSymbol.children = children;
      symbols.push(tableSymbol);
    }

    return symbols;
  }
}

type HoverEntry = {
  table: string;
  kind: "computed" | "aggregate";
  name: string;
  expr: string;
  line: number;
  start: number;
  end: number;
  exprStart: number;
  exprEnd: number;
};

class MdxtabHoverProvider implements HoverProvider {
  provideHover(document: TextDocument, position: Position): Hover | undefined {
    if (document.languageId !== "markdown") return undefined;
    const text = document.getText();
    if (!looksLikeMdxtab(text)) return undefined;
    const entry = findHoverEntry(text, position);
    if (!entry) return undefined;

    const title = entry.kind === "computed" ? "Computed" : "Aggregate";
    const label = `${entry.table}.${entry.name}`;
    const md = new MarkdownString(`**${title}:** ${label}\n\n\`${entry.expr}\``);
    return new Hover(md);
  }
}

class MdxtabCompletionProvider {
  provideCompletionItems(document: TextDocument, position: Position): CompletionItem[] {
    if (document.languageId !== "markdown") return [];
    const text = document.getText();
    if (!looksLikeMdxtab(text)) return [];

    const lines = text.replace(/\r\n?/g, "\n").split("\n");
    const frontmatter = getFrontmatterBounds(lines);
    if (!frontmatter) return [];

    let parsedFrontmatter: ReturnType<typeof parseFrontmatter> | undefined;
    let parsedTables: ReturnType<typeof parseMarkdownTables> | undefined;
    try {
      parsedFrontmatter = parseFrontmatter(text);
      parsedTables = parseMarkdownTables(text);
    } catch {
      parsedFrontmatter = undefined;
      parsedTables = undefined;
    }

    const entries = parseFrontmatterEntries(lines, frontmatter.start + 1, frontmatter.end);
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
  provideDefinition(document: TextDocument, position: Position): Location | undefined {
    if (document.languageId !== "markdown") return undefined;
    const text = document.getText();
    if (!looksLikeMdxtab(text)) return undefined;

    const lines = text.replace(/\r\n?/g, "\n").split("\n");
    const frontmatter = getFrontmatterBounds(lines);
    if (!frontmatter) return undefined;

    let parsedFrontmatter: ReturnType<typeof parseFrontmatter> | undefined;
    let parsedTables: ReturnType<typeof parseMarkdownTables> | undefined;
    try {
      parsedFrontmatter = parseFrontmatter(text);
      parsedTables = parseMarkdownTables(text);
    } catch {
      return undefined;
    }

    const entries = parseFrontmatterEntries(lines, frontmatter.start + 1, frontmatter.end);

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

function findHoverEntry(text: string, position: Position): HoverEntry | undefined {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const frontmatter = getFrontmatterBounds(lines);
  if (!frontmatter) return undefined;
  let parsedFrontmatter: ReturnType<typeof parseFrontmatter> | undefined;
  let parsedTables: ReturnType<typeof parseMarkdownTables> | undefined;
  try {
    parsedFrontmatter = parseFrontmatter(text);
    parsedTables = parseMarkdownTables(text);
  } catch {
    parsedFrontmatter = undefined;
    parsedTables = undefined;
  }

  if (position.line > frontmatter.start && position.line < frontmatter.end) {
    const entries = parseFrontmatterEntries(lines, frontmatter.start + 1, frontmatter.end);
    for (const entry of entries) {
      if (entry.line !== position.line) continue;
      if (position.character < entry.start || position.character > entry.end) continue;
      return entry;
    }
  }

  if (parsedFrontmatter && parsedTables) {
    return findBodyHoverEntry(lines, position, parsedFrontmatter, parsedTables);
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
): HoverEntry | undefined {
  const lineText = lines[position.line] ?? "";
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
  const diagnostics = validateMdxtab(text).diagnostics;
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
  const vsDiag = new Diagnostic(range, diag.message, severity);
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
    languages.registerDocumentSymbolProvider({ language: "markdown" }, new MdxtabSymbolProvider()),
  );
  context.subscriptions.push(
    languages.registerHoverProvider({ language: "markdown" }, new MdxtabHoverProvider()),
  );
  context.subscriptions.push(
    languages.registerCompletionItemProvider({ language: "markdown" }, new MdxtabCompletionProvider(), "."),
  );
  context.subscriptions.push(
    languages.registerDefinitionProvider({ language: "markdown" }, new MdxtabDefinitionProvider()),
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

  const active = window.activeTextEditor?.document;
  if (active) updateDiagnostics(active, diagnostics);

}

export function deactivate() {
  // nothing to clean up
}
