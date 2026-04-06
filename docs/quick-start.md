# Quick Start

This page gets you from zero to a working MDXTab file quickly.

## Prerequisites

- Node.js 20+
- npm

## 1) Install dependencies

```sh
npm install
```

## 2) Build local packages

```sh
npm run -w mdxtab build
```

## 3) Validate a sample document

```sh
node packages/cli/dist/bin.js validate dev/examples/expenses.md
```

Expected result: no diagnostics for valid files.

## 4) Render a sample document

```sh
node packages/cli/dist/bin.js render dev/examples/expenses.md
```

Expected result: rendered markdown output with computed and aggregate values.

## 5) Use in VS Code

1. Install the extension from Marketplace or local VSIX.
2. Open `dev/examples/expenses.md`.
3. Run command: `MDXTab: Render Preview`.
4. Run command: `MDXTab: Validate Document`.

## Minimal MDXTab document

```md
---
mdxtab: "1.0"
tables:
	expenses:
		key: id
		columns: [id, net, tax]
		types:
			net: number
			tax: number
		computed:
			tax: net * 0.25
		aggregates:
			net_total: sum(net)
---

## expenses
| id | net |
|----|-----|
| e1 | 100 |
| e2 | 200 |

Total: {{ expenses.net_total }}
```

## Where to go next

- Learn the model: [Format Overview](format-overview.md)
- Run scripts in CI: [CLI Usage](cli-usage.md)
- Work inside editor: [VS Code Extension](vscode-extension.md)

## Next

- [Format Overview](format-overview.md)
