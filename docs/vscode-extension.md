# VS Code Extension

The extension provides preview rendering and diagnostics inside markdown files.

## Core commands

- `MDXTab: Render Preview` (`mdxtab.renderPreview`)
- `MDXTab: Validate Document` (`mdxtab.validateDocument`)

## Typical flow

1. Open a markdown file with MDXTab frontmatter.
2. Save or edit to trigger diagnostics.
3. Run render preview command to inspect computed output.

## Key settings

- `mdxtab.preview.markdownIt.enabled`
- `mdxtab.preview.showFrontmatter`
- `mdxtab.preview.showComputedColumns`
- `mdxtab.preview.showSummaryRows`
- `mdxtab.limits.*`

## Next

- [Troubleshooting](troubleshooting.md)
