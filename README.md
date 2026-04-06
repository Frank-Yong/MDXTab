# MDXTab

Markdown eXtended Tables: keep data in markdown tables and logic in frontmatter.

## Documentation

- Start here: [docs/index.md](docs/index.md)
- Quick start: [docs/quick-start.md](docs/quick-start.md)
- Format overview: [docs/format-overview.md](docs/format-overview.md)
- CLI usage: [docs/cli-usage.md](docs/cli-usage.md)
- VS Code extension usage: [docs/vscode-extension.md](docs/vscode-extension.md)
- Troubleshooting: [docs/troubleshooting.md](docs/troubleshooting.md)

## Install

Prerequisites: Node.js 20+ (CI runs on Node 20) and npm.

```sh
npm install
```

## Build

```sh
npm run build
```

## Test

```sh
npm test
```

## CLI examples

```sh
npm exec -w @mdxtab/cli -- mdxtab validate ../../dev/examples/expenses.md
npm exec -w @mdxtab/cli -- mdxtab render ../../dev/examples/expenses.md
```

## Deep references

- Formal spec: [specs/formal-format-spec.md](specs/formal-format-spec.md)
- Development spec: [specs/development-spec.md](specs/development-spec.md)
- Technical design: [specs/technical-design.md](specs/technical-design.md)

## Repository structure

- User docs: [docs](docs)
- Internal development docs: [dev/docs](dev/docs)
- Work items: [dev/work-items](dev/work-items)
- Examples: [dev/examples](dev/examples)
