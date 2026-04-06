# CLI Usage

Use CLI commands to validate and render MDXTab documents.

## Validate

```sh
node packages/cli/dist/bin.js validate path/to/file.md
```

## Render

```sh
node packages/cli/dist/bin.js render path/to/file.md
```

## JSON diagnostics

```sh
node packages/cli/dist/bin.js validate path/to/file.md --json
```

## Useful options

- expression limits can be overridden via CLI flags
- use JSON output in CI pipelines

## Next

- [VS Code Extension](vscode-extension.md)
- [Troubleshooting](troubleshooting.md)
