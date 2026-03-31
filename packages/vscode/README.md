# MDXTab VS Code Extension (Spike)

**Markdown Extended Tables**

- Command: **MDXTab: Render Preview** (`mdxtab.renderPreview`) — renders the active Markdown file through the MDXTab compiler into a preview document.
- Diagnostics: recompiles on open/change/save; errors surface as markdown diagnostics at the top of the file.
- Preview scheme: `mdxtab-preview:` opens a virtual document with the rendered output (frontmatter + interpolated aggregates).
- **Computed column preview**: columns defined in frontmatter `computed` are rendered in the Markdown preview with their evaluated per-row values. Columns already authored as headers have their empty cells filled in; columns not in the source table are appended automatically.
- **Summary row preview**: rows defined in frontmatter `summary_rows` are rendered as synthetic rows appended at the bottom of the table preview.
- **Expression guardrails**: validation rejects pathological computed/aggregate
  expressions with `E_LIMIT` diagnostics before they can trigger stack overflow
  or excessive work.

## Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `mdxtab.preview.markdownIt.enabled` | `true` | Enable MDXTab rendering in the built-in Markdown preview. |
| `mdxtab.preview.showFrontmatter` | `false` | Show frontmatter and formulas in the preview. |
| `mdxtab.preview.showComputedColumns` | `true` | Show computed columns in preview tables. Disable to render tables exactly as authored. |
| `mdxtab.preview.showSummaryRows` | `true` | Show synthetic summary rows from `summary_rows` in preview tables. Disable to hide summary rows while keeping authored rows unchanged. |
| `mdxtab.limits.maxExpressionLength` | `4096` | Maximum expression length in characters before `E_LIMIT` is reported. |
| `mdxtab.limits.maxTokens` | `512` | Maximum token count before `E_LIMIT` is reported. |
| `mdxtab.limits.maxAstDepth` | `64` | Maximum AST depth before `E_LIMIT` is reported. |
| `mdxtab.limits.maxDependencyDepth` | `128` | Maximum dependency traversal depth before `E_LIMIT` is reported. |

## Summary Rows (`summary_rows`)

MDXTab supports summary rows defined in table frontmatter. Summary row cells are
expressions evaluated left-to-right and can reference prior cells in the same
summary row via `self.<column>`.

```yaml
tables:
  expenses:
    key: category
    columns: [category, p1, p2, p3, row_total]
    computed:
      row_total: p1 + p2 + p3
    summary_rows:
      running_balance:
        label: Running Balance
        cells:
          p1: sum(p1)
          p2: self.p1 + sum(p2)
          p3: self.p2 + sum(p3)
```

In preview, the synthetic row is appended after the last data row.

## Expression Limits

The current compiler applies explicit limits to expressions:

| Limit | Value |
|---------|---------|
| Maximum expression length | 4096 characters |
| Maximum token count | 512 tokens |
| Maximum AST depth | 64 |
| Maximum dependency traversal depth | 128 |

If one of these limits is exceeded, the extension surfaces an `E_LIMIT`
diagnostic through the normal MDXTab validation path.

The core compiler also supports configurable limits via compile options, and
the extension maps the settings above to those compile options for validation
and preview rendering.

This is a spike; packaging, icons, and richer error mapping are still TBD.
