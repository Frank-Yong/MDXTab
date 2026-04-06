# CLI Usage

Use CLI commands to validate and render MDXTab documents.

## Build first

```sh
npm run -w @mdxtab/core build
npm run -w @mdxtab/cli build
```

## Command shape

```sh
node packages/cli/dist/bin.js <validate|render> <path-to-markdown>
```

## Validate

```sh
node packages/cli/dist/bin.js validate path/to/file.md
```

Validation returns non-zero on diagnostics/errors, which is useful for CI gates.

## Render

```sh
node packages/cli/dist/bin.js render path/to/file.md
```

Render writes markdown output to stdout.

## JSON diagnostics

```sh
node packages/cli/dist/bin.js validate path/to/file.md --json
```

Use JSON mode for machine-readable pipelines.

## Guardrail limit overrides

```sh
node packages/cli/dist/bin.js validate report.md --max-expression-length 8192 --max-ast-depth 128 --max-parse-depth 512
node packages/cli/dist/bin.js render report.md --max-tokens 1024 --max-dependency-depth 256
```

These flags tune expression limits when needed for large but valid models.

## CI example

```sh
node packages/cli/dist/bin.js validate docs/finance.md --json
```

Fail the job if the command exits non-zero.

## Useful options

- expression limits can be overridden via CLI flags
- use JSON output in CI pipelines

## Next

- [VS Code Extension](vscode-extension.md)
- [Troubleshooting](troubleshooting.md)
