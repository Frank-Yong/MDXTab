# Work Item: Interpolation renderer

## Status
- State: DONE

## Description
Render Markdown by replacing allowed `{{ table.aggregate }}` placeholders.

## Sub-items
- Parse and replace aggregate placeholders only; reject arbitrary expressions.
- Preserve all other Markdown content as-is.
- Tests: successful substitutions, unknown aggregate errors, no-op when none present.
