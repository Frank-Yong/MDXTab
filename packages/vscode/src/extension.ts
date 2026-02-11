import {
  commands,
  Diagnostic,
  DiagnosticCollection,
  DiagnosticSeverity,
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
import { compileMdxtab } from "@mdxtab/core";

const SCHEME = "mdxtab-preview";

class PreviewProvider implements TextDocumentContentProvider {
  private emitter = new EventEmitter<Uri>();

  readonly onDidChange = this.emitter.event;

  refresh(uri: Uri) {
    this.emitter.fire(uri);
  }

  async provideTextDocumentContent(uri: Uri): Promise<string> {
    const target = uri.query ? Uri.parse(uri.query) : undefined;
    const doc = target ? await workspace.openTextDocument(target) : undefined;
    if (!doc) return "No document to render";
    try {
      const config = workspace.getConfiguration("mdxtab");
      const showFrontmatter = config.get<boolean>("preview.showFrontmatter", false);
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
  try {
    compileMdxtab(doc.getText());
    collection.delete(doc.uri);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const diag = new Diagnostic(new Range(new Position(0, 0), new Position(0, 1)), message, DiagnosticSeverity.Error);
    collection.set(doc.uri, [diag]);
  }
}

export function activate() {
  const provider = new PreviewProvider();
  workspace.registerTextDocumentContentProvider(SCHEME, provider);

  const diagnostics = languages.createDiagnosticCollection("mdxtab");
  workspace.onDidOpenTextDocument((doc) => updateDiagnostics(doc, diagnostics));
  workspace.onDidChangeTextDocument((e) => updateDiagnostics(e.document, diagnostics));
  workspace.onDidSaveTextDocument((doc) => updateDiagnostics(doc, diagnostics));

  const renderPreview = commands.registerCommand("mdxtab.renderPreview", async () => {
    const editor = window.activeTextEditor;
    if (!editor) {
      window.showErrorMessage("No active editor to render");
      return;
    }
    const docUri = editor.document.uri;
    const previewUri = Uri.from({ scheme: SCHEME, path: docUri.path, query: docUri.toString() });
    provider.refresh(previewUri);
    await commands.executeCommand("vscode.open", previewUri, { preview: true });
  });

  const active = window.activeTextEditor?.document;
  if (active) updateDiagnostics(active, diagnostics);

  return { dispose: () => {
    renderPreview.dispose();
    diagnostics.dispose();
  } };
}

export function deactivate() {
  // nothing to clean up
}
