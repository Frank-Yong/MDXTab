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
2) Build extension: `npm run -w @mdxtab/vscode build`

## Package
1) Run: `npx vsce package --no-dependencies` from packages/vscode
2) Verify the .vsix file was produced.

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
