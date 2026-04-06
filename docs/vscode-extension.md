# VS Code Extension

The extension provides preview rendering and diagnostics inside markdown files.

## Install

- Marketplace: install `frank-yong.mdxtab`
- Local: install generated VSIX from `packages/vscode`

## Core commands

- `MDXTab: Render Preview` (`mdxtab.renderPreview`)
- `MDXTab: Validate Document` (`mdxtab.validateDocument`)

## Typical flow

1. Open a markdown file with MDXTab frontmatter.
2. Save or edit to trigger diagnostics.
3. Run render preview command to inspect computed output.
4. Use validate command to get explicit diagnostic count/status.

## Key settings

- `mdxtab.preview.markdownIt.enabled`
- `mdxtab.preview.showFrontmatter`
- `mdxtab.preview.showComputedColumns`
- `mdxtab.preview.showSummaryRows`
- `mdxtab.limits.*`

## Suggested setup

- Keep `mdxtab.preview.markdownIt.enabled` on for integrated preview.
- Keep computed/summary toggles on while authoring and debugging formulas.
- Tune `mdxtab.limits.*` only when your expressions are legitimately large.

## When diagnostics appear

- On open/change/save for markdown documents that look like MDXTab.
- In the Problems panel with MDXTab error codes (for example `E_LIMIT`, `E_NUMBER`, `E_REF`).

## Related

- [Quick Start](quick-start.md)
- [Troubleshooting](troubleshooting.md)

## Next

- [Troubleshooting](troubleshooting.md)
