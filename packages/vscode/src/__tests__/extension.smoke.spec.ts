import { beforeEach, describe, expect, it, vi } from "vitest";

const state = {
  commands: new Map<string, (...args: unknown[]) => unknown>(),
  previewProvider: undefined as undefined | { provideTextDocumentContent: (uri: unknown) => Promise<string> },
  openHandlers: [] as Array<(doc: MockDocument) => void>,
  closeHandlers: [] as Array<(doc: MockDocument) => void>,
  changeHandlers: [] as Array<(event: { document: MockDocument }) => void>,
  saveHandlers: [] as Array<(doc: MockDocument) => void>,
  visibleEditorHandlers: [] as Array<() => void>,
  diagnosticSetCalls: [] as Array<{ uri: MockUri; diagnostics: unknown[] }>,
  diagnosticDeleteCalls: [] as MockUri[],
  executedCommands: [] as Array<{ command: string; args: unknown[] }>,
  documents: new Map<string, MockDocument>(),
  window: undefined as
    | undefined
    | {
        activeTextEditor: undefined | { document: MockDocument };
        visibleTextEditors: Array<{ document: { uri: MockUri } }>;
      },
};

type MockUriParts = { scheme?: string; path?: string; query?: string };

class MockUri {
  constructor(
    public scheme: string,
    public path: string,
    public query: string = "",
  ) {}

  static from(parts: MockUriParts): MockUri {
    return new MockUri(parts.scheme ?? "file", parts.path ?? "", parts.query ?? "");
  }

  static parse(raw: string): MockUri {
    const [schemeAndPath, query = ""] = raw.split("?");
    const colon = schemeAndPath.indexOf(":");
    const scheme = colon >= 0 ? schemeAndPath.slice(0, colon) : "file";
    const path = colon >= 0 ? schemeAndPath.slice(colon + 1) : schemeAndPath;
    return new MockUri(scheme, path, query);
  }

  toString(): string {
    return `${this.scheme}:${this.path}${this.query ? `?${this.query}` : ""}`;
  }
}

class MockPosition {
  constructor(
    public line: number,
    public character: number,
  ) {}
}

class MockRange {
  constructor(
    public start: MockPosition,
    public end: MockPosition,
  ) {}
}

class MockDiagnostic {
  public code?: string;
  public source?: string;

  constructor(
    public range: MockRange,
    public message: string,
    public severity: number,
  ) {}
}

class MockEventEmitter<T> {
  private listeners: Array<(event: T) => void> = [];

  event = (listener: (event: T) => void) => {
    this.listeners.push(listener);
    return { dispose: () => undefined };
  };

  fire(event: T) {
    for (const listener of this.listeners) listener(event);
  }
}

class MockCompletionItem {
  public insertText?: string;

  constructor(
    public label: string,
    public kind?: number,
  ) {}
}

class MockDocumentSymbol {
  public children: MockDocumentSymbol[] = [];

  constructor(
    public name: string,
    public detail: string,
    public kind: number,
    public range: MockRange,
    public selectionRange: MockRange,
  ) {}
}

class MockLocation {
  constructor(
    public uri: MockUri,
    public range: MockRange,
  ) {}
}

class MockMarkdownString {
  constructor(public value: string) {}
}

class MockHover {
  constructor(public contents: MockMarkdownString) {}
}

class MockWorkspaceEdit {
  replace(): void {
    // no-op for smoke tests
  }
}

class MockCodeAction {
  public edit?: MockWorkspaceEdit;
  public diagnostics?: readonly MockDiagnostic[];

  constructor(
    public title: string,
    public kind: string,
  ) {}
}

type MockDocument = {
  languageId: string;
  version: number;
  uri: MockUri;
  getText: () => string;
  lineAt: (line: number) => { text: string; range: MockRange };
};

const createDoc = (uri: MockUri, text: string): MockDocument => {
  const lines = text.split("\n");
  return {
    languageId: "markdown",
    version: 1,
    uri,
    getText: () => text,
    lineAt: (line: number) => {
      const content = lines[line] ?? "";
      return {
        text: content,
        range: new MockRange(new MockPosition(line, 0), new MockPosition(line, content.length)),
      };
    },
  };
};

vi.mock("vscode", () => {
  const executeCommand = vi.fn(async (command: string, ...args: unknown[]) => {
    state.executedCommands.push({ command, args });
    return undefined;
  });

  const commands = {
    registerCommand: vi.fn((name: string, callback: (...args: unknown[]) => unknown) => {
      state.commands.set(name, callback);
      return { dispose: () => state.commands.delete(name) };
    }),
    executeCommand,
  };

  const diagnosticCollection = {
    set: vi.fn((uri: MockUri, diagnostics: unknown[]) => {
      state.diagnosticSetCalls.push({ uri, diagnostics });
    }),
    delete: vi.fn((uri: MockUri) => {
      state.diagnosticDeleteCalls.push(uri);
    }),
    dispose: vi.fn(),
  };

  const workspace = {
    getConfiguration: vi.fn(() => ({
      get: (_key: string, defaultValue: unknown) => defaultValue,
    })),
    registerTextDocumentContentProvider: vi.fn((_scheme: string, provider: { provideTextDocumentContent: (uri: unknown) => Promise<string> }) => {
      state.previewProvider = provider;
      return { dispose: () => undefined };
    }),
    onDidOpenTextDocument: vi.fn((callback: (doc: MockDocument) => void) => {
      state.openHandlers.push(callback);
      return { dispose: () => undefined };
    }),
    onDidCloseTextDocument: vi.fn((callback: (doc: MockDocument) => void) => {
      state.closeHandlers.push(callback);
      return { dispose: () => undefined };
    }),
    onDidChangeTextDocument: vi.fn((callback: (event: { document: MockDocument }) => void) => {
      state.changeHandlers.push(callback);
      return { dispose: () => undefined };
    }),
    onDidSaveTextDocument: vi.fn((callback: (doc: MockDocument) => void) => {
      state.saveHandlers.push(callback);
      return { dispose: () => undefined };
    }),
    openTextDocument: vi.fn(async (uri: MockUri) => state.documents.get(uri.toString())),
  };

  const languages = {
    createDiagnosticCollection: vi.fn(() => diagnosticCollection),
    registerDocumentSymbolProvider: vi.fn(() => ({ dispose: () => undefined })),
    registerHoverProvider: vi.fn(() => ({ dispose: () => undefined })),
    registerCompletionItemProvider: vi.fn(() => ({ dispose: () => undefined })),
    registerDefinitionProvider: vi.fn(() => ({ dispose: () => undefined })),
    registerCodeActionsProvider: vi.fn(() => ({ dispose: () => undefined })),
  };

  const window = {
    activeTextEditor: undefined as undefined | { document: MockDocument },
    visibleTextEditors: [] as Array<{ document: { uri: MockUri } }>,
    onDidChangeVisibleTextEditors: vi.fn((callback: () => void) => {
      state.visibleEditorHandlers.push(callback);
      return { dispose: () => undefined };
    }),
    showErrorMessage: vi.fn(),
    showInformationMessage: vi.fn(),
    showWarningMessage: vi.fn(),
  };
  state.window = window;

  return {
    CodeAction: MockCodeAction,
    CodeActionKind: { QuickFix: "quickfix" },
    commands,
    Diagnostic: MockDiagnostic,
    DiagnosticSeverity: { Error: 0, Warning: 1 },
    CompletionItem: MockCompletionItem,
    CompletionItemKind: { Field: 5, Struct: 6, Function: 7 },
    DocumentSymbol: MockDocumentSymbol,
    SymbolKind: { Struct: 5, Field: 8, Function: 11 },
    Hover: MockHover,
    Location: MockLocation,
    MarkdownString: MockMarkdownString,
    Position: MockPosition,
    Range: MockRange,
    WorkspaceEdit: MockWorkspaceEdit,
    EventEmitter: MockEventEmitter,
    languages,
    workspace,
    window,
    Uri: MockUri,
  };
});

const compileMdxtab = vi.fn(() => ({ rendered: "rendered-output" }));
const validateMdxtab = vi.fn(() => ({ diagnostics: [] as Array<Record<string, unknown>> }));

vi.mock("../core/index.js", () => ({
  compileMdxtab,
  validateMdxtab,
  toDiagnostic: vi.fn(() => ({ code: "E_TEST", message: "boom", severity: "error" })),
  parseFrontmatter: vi.fn(() => ({ tables: {} })),
  parseMarkdownTables: vi.fn(() => []),
}));

describe("vscode extension smoke", () => {
  beforeEach(() => {
    state.commands.clear();
    state.previewProvider = undefined;
    state.openHandlers.length = 0;
    state.closeHandlers.length = 0;
    state.changeHandlers.length = 0;
    state.saveHandlers.length = 0;
    state.visibleEditorHandlers.length = 0;
    state.diagnosticSetCalls.length = 0;
    state.diagnosticDeleteCalls.length = 0;
    state.executedCommands.length = 0;
    state.documents.clear();
    if (state.window) {
      state.window.activeTextEditor = undefined;
      state.window.visibleTextEditors.length = 0;
    }

    compileMdxtab.mockReset();
    compileMdxtab.mockReturnValue({ rendered: "rendered-output" });
    validateMdxtab.mockReset();
    validateMdxtab.mockReturnValue({ diagnostics: [] });
  });

  it("activates and registers core commands/providers", async () => {
    const extension = await import("../extension.js");
    const context = { subscriptions: [] as Array<{ dispose: () => void }> };

    const api = extension.activate(context as never);

    expect(typeof api.extendMarkdownIt).toBe("function");
    expect(state.previewProvider).toBeDefined();
    expect(state.commands.has("mdxtab.renderPreview")).toBe(true);
    expect(state.commands.has("mdxtab.validateDocument")).toBe(true);
    expect(state.openHandlers.length).toBeGreaterThan(0);
  });

  it("updates diagnostics when a markdown mdxtab document opens", async () => {
    validateMdxtab.mockReturnValue({
      diagnostics: [
        {
          code: "E_LIMIT",
          message: "too deep",
          severity: "error",
          table: "t",
          column: "c",
          range: {
            start: { line: 0, character: 0 },
            end: { line: 0, character: 5 },
          },
        },
      ],
    });

    const extension = await import("../extension.js");
    const context = { subscriptions: [] as Array<{ dispose: () => void }> };
    extension.activate(context as never);

    const doc = createDoc(
      MockUri.from({ scheme: "file", path: "/tmp/sample.md" }),
      "---\nmdxtab: \"1.0\"\n---\n\n## t\n| id | value |\n|----|-------|\n| a  | 1     |",
    );

    state.openHandlers.forEach((handler) => handler(doc));

    expect(state.diagnosticSetCalls.length).toBe(1);
    expect(state.diagnosticSetCalls[0].uri.toString()).toBe(doc.uri.toString());
    expect(state.diagnosticSetCalls[0].diagnostics.length).toBe(1);
  });

  it("renders preview content via the registered content provider", async () => {
    const extension = await import("../extension.js");
    const context = { subscriptions: [] as Array<{ dispose: () => void }> };
    extension.activate(context as never);

    const sourceUri = MockUri.from({ scheme: "file", path: "/tmp/preview.md" });
    const sourceDoc = createDoc(
      sourceUri,
      "---\nmdxtab: \"1.0\"\n---\n\n## t\n| id | value |\n|----|-------|\n| a  | 1     |",
    );
    state.documents.set(sourceUri.toString(), sourceDoc);

    const previewUri = MockUri.from({
      scheme: "mdxtab-preview",
      path: sourceUri.path,
      query: encodeURIComponent(sourceUri.toString()),
    });

    const rendered = await state.previewProvider?.provideTextDocumentContent(previewUri);

    expect(rendered).toBe("rendered-output");
    expect(compileMdxtab).toHaveBeenCalledTimes(1);
  });

  it("executes render-preview command and opens mdxtab-preview uri", async () => {
    const vscode = await import("vscode");
    const extension = await import("../extension.js");
    const context = { subscriptions: [] as Array<{ dispose: () => void }> };
    extension.activate(context as never);

    const sourceUri = MockUri.from({ scheme: "file", path: "/tmp/active.md" });
    const sourceDoc = createDoc(
      sourceUri,
      "---\nmdxtab: \"1.0\"\n---\n\n## t\n| id | value |\n|----|-------|\n| a  | 1     |",
    );
    (vscode.window as { activeTextEditor?: { document: MockDocument } }).activeTextEditor = { document: sourceDoc };

    const command = state.commands.get("mdxtab.renderPreview");
    expect(command).toBeDefined();

    await command?.();

    expect(state.executedCommands.length).toBe(1);
    expect(state.executedCommands[0].command).toBe("vscode.open");
    expect(String(state.executedCommands[0].args[0])).toContain("mdxtab-preview");
  });
});
