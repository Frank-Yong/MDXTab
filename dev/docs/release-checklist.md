# Release Checklist (Internal Beta)

## Versioning plan
- Current internal beta: 0.1.0
- Next release (Phase 3): 0.2.0

## Pre-release steps
1) Update versions in:
   - root package.json
   - packages/core/package.json
   - packages/cli/package.json
   - packages/vscode/package.json
2) Update dependencies to match (e.g., @mdxtab/core).
3) Update CHANGELOG.md with a short summary of changes.

## Build and test
1) Run: `npm test`
2) Build extension: `npm run -w mdxtab build`
3) Build CLI: `npm run -w @mdxtab/cli build`

## Package
1) Run: `npx vsce package --no-dependencies` from packages/vscode (core is copied into dist by the build step)
2) Verify the .vsix file was produced.
3) Verify CLI render works: `node packages/cli/dist/bin.js render packages/cli/fixtures/sample.md`

## Install and validate
1) Install the .vsix in VS Code.
2) Open a sample MDXTab document.
3) Verify:
   - Render preview works
   - Diagnostics appear in Problems panel
   - Symbols/hover/completions are available

## Publish (internal)
- Share the .vsix and the version number with the beta group.
- Record feedback and known issues for the next release.

## Publish (Marketplace)
1) Bump versions (root, core, cli, vscode) and update dependencies to match.
2) Create a GitHub Release with a matching tag (e.g., v0.1.1).
3) The "Publish VS Code Extension" workflow runs on release and publishes using `VSCE_PAT`.
4) Latest publish: v0.2.0 (2026-02-18).
