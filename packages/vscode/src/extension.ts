import {
  commands,
  Diagnostic,
  DiagnosticCollection,
  DiagnosticSeverity,
  ExtensionContext,
  languages,
  Position,
  Range,
  TextDocument,
  TextDocumentContentProvider,
  Uri,
  window,
  workspace,
  EventEmitter,
} from "vscode";
import { compileMdxtab, validateMdxtab, type Diagnostic as CoreDiagnostic } from "@mdxtab/core";

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

function updateDiagnostics(doc: TextDocument, collection: DiagnosticCollection) {
  if (doc.languageId !== "markdown") return;
  const text = doc.getText();
  if (!looksLikeMdxtab(text)) {
    collection.delete(doc.uri);
    return;
  }
  const { diagnostics } = validateMdxtab(text);
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
  context.subscriptions.push(workspace.onDidOpenTextDocument((doc) => updateDiagnostics(doc, diagnostics)));
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
