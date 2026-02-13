# VS Code Extension Tutorial (Fictional MVP: NoteSpark)

This walkthrough creates a minimal VS Code extension and shows how to run and install it locally.

## Prerequisites
- Node.js installed
- VS Code installed

## 1) Scaffold the extension
This generates the basic project structure, build config, and a starter extension entry point.
```bash
npm install -g yo generator-code
yo code
```
Choose:
- Type: New Extension (TypeScript)
- Name: notespark
- Identifier: notespark
- Description: MVP helper for NoteSpark
- Initialize git: yes

## 2) Open the project
Open the workspace and install dependencies so TypeScript can compile and VS Code can run the extension.
```bash
code notespark
npm install
```

## 3) Add a simple command
Commands are the simplest way to make an extension do something. Here we register a command that shows a message.
Edit src/extension.ts:
```ts
import * as vscode from "vscode";

export function activate(context: vscode.ExtensionContext) {
  const disposable = vscode.commands.registerCommand("notespark.hello", () => {
    vscode.window.showInformationMessage("NoteSpark MVP says hello!");
  });

  context.subscriptions.push(disposable);
}

export function deactivate() {}
```

## 4) Register the command
Commands must be declared in the extension manifest so VS Code can discover them in the Command Palette.
Edit package.json:
```json
"contributes": {
  "commands": [
    {
      "command": "notespark.hello",
      "title": "NoteSpark: Hello"
    }
  ]
}
```

## 5) Run the extension
The Extension Development Host is a sandboxed VS Code instance where you can test your extension without affecting your main editor.
- Press F5 to launch an Extension Development Host.
- In the new VS Code window, open the Command Palette (Ctrl+Shift+P).
- Run "NoteSpark: Hello".

## 6) Optional: add a simple MVP command
This demonstrates editing the active document, which is common for MVP helpers (templates, insertions, quick scaffolds).
Append to src/extension.ts:
```ts
const insertTemplate = vscode.commands.registerCommand("notespark.insertTemplate", async () => {
  const editor = vscode.window.activeTextEditor;
  if (!editor) return;
  const template = "# NoteSpark MVP\n\n- Goal:\n- Scope:\n- Owner:\n";
  await editor.edit((edit) => edit.insert(editor.selection.active, template));
});

context.subscriptions.push(insertTemplate);
```

Add to package.json:
```json
{
  "command": "notespark.insertTemplate",
  "title": "NoteSpark: Insert MVP Template"
}
```

## 7) Package and install locally
Packaging creates a .vsix file that VS Code can install, so you can share or test it outside the dev host.
```bash
npm install -g @vscode/vsce
vsce package
```
This creates a .vsix file. Install it in VS Code:
- Open the Extensions view
- Click "..." -> "Install from VSIX..."
- Select the generated .vsix

## 8) Share or publish (optional)
Distributing via .vsix is the quickest internal option; publishing is for wider distribution and updates.
- Share the .vsix for manual installs, or
- Follow VS Code Marketplace publishing docs if you want public distribution.
