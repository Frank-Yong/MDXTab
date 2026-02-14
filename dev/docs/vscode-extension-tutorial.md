# MDXTab VS Code Extension Workflow (Beginner-Friendly)

This walkthrough shows how to build, run, and package the MDXTab VS Code extension in this repo. It is written for general programmers who have not used VS Code extensions or TypeScript before.

## Prerequisites
- Node.js installed (this provides npm, the package manager used below)
- VS Code installed (the editor that will load and run the extension)

## 1) Install dependencies
Install the project dependencies.
What happens: npm downloads the libraries this repo needs. Think of this as fetching all third-party code used by MDXTab.
Alternatives: You could use pnpm or yarn instead of npm. The main difference is the lockfile and how packages are stored on disk.
```bash
npm install
```

## 2) Build the extension
Build the extension.
```bash
npm run -w @mdxtab/vscode build
```
What happens: the build first compiles the core library, then compiles the VS Code extension into plain JavaScript in the dist/ folder. VS Code runs the compiled files, not the TypeScript source.
Alternatives: You can run the two builds separately, but if core is not rebuilt, the extension may run old code.

## 3) Run the extension in a dev host
The Extension Development Host is a separate VS Code window that loads your extension for testing.
- Open the repo in VS Code.
- In Run and Debug, choose the extension launch configuration if present, or press F5 from the packages/vscode folder.
- A new VS Code window opens with the extension loaded.
What happens: VS Code starts another window and runs the extension in a separate process. This keeps your main editor safe from crashes while you debug.
Alternatives: You can install a packaged extension instead (see step 6). That is closer to real users, but slower to iterate during development.

## 4) Try the MDXTab commands
Open a Markdown file with MDXTab frontmatter, then run:
- "MDXTab: Render Preview"
- "MDXTab: Validate Document"
What happens: the extension reads the file, runs the MDXTab parser, and either renders output or reports errors. Errors appear in VS Code’s Problems panel; preview opens a rendered version.
Differences: The preview is a rendered view, while diagnostics are error markers. They update on different triggers, so you might see one update before the other.

## 5) Change extension code
Extension code lives in packages/vscode/src/extension.ts.
- Make edits.
- Rebuild: `npm run -w @mdxtab/vscode build`
- Reload the Extension Development Host window.
What happens: rebuilding updates the compiled JavaScript files. Reloading the dev host makes VS Code load those new files.
Alternatives: A watch build can auto-compile in the background, but you still need to reload the dev host to run the new code.

## 6) Package and install locally
Create a .vsix package for local install or sharing.
```bash
npm install -g @vscode/vsce
cd packages/vscode
vsce package
```
Install the .vsix in VS Code:
- Open the Extensions view
- Click "..." -> "Install from VSIX..."
- Select the generated .vsix
What happens: vsce bundles the compiled extension into a single file. VS Code can install that file just like a marketplace download.
Alternatives: Use the dev host while developing (faster), or use a VSIX to test the real install experience (slower but closer to production).

## 7) Share or publish (optional)
- Share the .vsix internally, or
- Publish to the VS Code Marketplace for broader distribution.
Consequences: Publishing requires a publisher account and versioning. Sharing a VSIX is simpler but does not provide auto-updates.
