# Contributing to MDXTab

Thanks for helping improve MDXTab. This repo uses a monorepo layout with core, CLI, and VS Code extension packages.
By contributing, you agree to our Code of Conduct in CODE_OF_CONDUCT.md.

## Prerequisites
- Node.js 20 LTS (ensure `node`/`npm`/`npx` are on PATH)
- npm 9+ (recommended)

## Quick start
1) Install deps: `npm install`
2) Run tests: `npm test`

## Repo structure
```
packages/
  core/   # shared logic
  cli/    # command-line interface
  vscode/ # VS Code extension
```

## Dev workflow
- Core/CLI/VS Code packages live under `packages/`.
- Build VS Code extension: `npm run -w mdxtab build`
- Build CLI: `npm run -w @mdxtab/cli build`

## Packaging a VSIX
1) Install deps at repo root: `npm install`
2) Build the extension: `npm run -w mdxtab build`
3) Package from repo root (prevents repo-level files like `.git` from being pulled in):
	`npm exec -w mdxtab -- vsce package --no-dependencies`

## Running the VS Code extension locally
1) Build the extension: `npm run -w mdxtab build`
2) Press F5 in VS Code to launch the Extension Development Host

## Pull requests
- Keep PRs focused and small.
- Include tests or updates to existing tests when behavior changes.
- Update docs when user-facing behavior changes.
- Run `npm test` before opening a PR.

## Tests and CI
- Run tests locally: `npm test`
- CI must pass before merging

## Commit style
- Use clear, imperative subjects (e.g., "Add CI workflow").
- Link to issues when applicable.

## Help
If you are unsure about a change, open a draft PR or start a discussion in the issue tracker.

## PR checklist
- [ ] Tests pass locally (`npm test`)
- [ ] Docs updated (if needed)
