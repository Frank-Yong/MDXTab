# Quick Start

This page gets you from zero to a working MDXTab file quickly.

## 1) Install dependencies

```sh
npm install
```

## 2) Validate a sample document

```sh
node packages/cli/dist/bin.js validate dev/examples/expenses.md
```

Expected result: no diagnostics for valid files.

## 3) Render a sample document

```sh
node packages/cli/dist/bin.js render dev/examples/expenses.md
```

Expected result: rendered markdown output with computed and aggregate values.

## 4) Use in VS Code

- Install the extension VSIX or Marketplace version.
- Open a markdown file with MDXTab frontmatter.
- Run command: `MDXTab: Render Preview`.

## Next

- [Format Overview](format-overview.md)
