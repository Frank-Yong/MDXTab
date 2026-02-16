# Contributing to MDXTab

Thanks for helping improve MDXTab. This repo uses a monorepo layout with core, CLI, and VS Code extension packages.

## Quick start
1) Install Node.js 20+
2) Install deps: `npm install`
3) Run tests: `npm test`

## Dev workflow
- Core/CLI/VS Code packages live under `packages/`.
- Build VS Code extension: `npm run -w mdxtab build`
- Build CLI: `npm run -w @mdxtab/cli build`

## Pull requests
- Keep PRs focused and small.
- Include tests or updates to existing tests when behavior changes.
- Update docs when user-facing behavior changes.
- Run `npm test` before opening a PR.

## Commit style
- Use clear, imperative subjects (e.g., "Add CI workflow").
- Link to issues when applicable.

## Help
If you are unsure about a change, open a draft PR or start a discussion in the issue tracker.
