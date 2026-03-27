# MDXTab VS Code Extension (Spike)

**Markdown Extended Tables**

- Command: **MDXTab: Render Preview** (`mdxtab.renderPreview`) — renders the active Markdown file through the MDXTab compiler into a preview document.
- Diagnostics: recompiles on open/change/save; errors surface as markdown diagnostics at the top of the file.
- Preview scheme: `mdxtab-preview:` opens a virtual document with the rendered output (frontmatter + interpolated aggregates).
- **Computed column preview**: columns defined in frontmatter `computed` are rendered in the Markdown preview with their evaluated per-row values. Columns already authored as headers have their empty cells filled in; columns not in the source table are appended automatically.

## Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `mdxtab.preview.markdownIt.enabled` | `true` | Enable MDXTab rendering in the built-in Markdown preview. |
| `mdxtab.preview.showFrontmatter` | `false` | Show frontmatter and formulas in the preview. |
| `mdxtab.preview.showComputedColumns` | `true` | Show computed columns in preview tables. Disable to render tables exactly as authored. |

This is a spike; packaging, icons, and richer error mapping are still TBD.
