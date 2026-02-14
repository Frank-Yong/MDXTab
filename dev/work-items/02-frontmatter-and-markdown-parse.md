# Work Item: Frontmatter and Markdown parsing

## Status
- State: DONE

## Description
Parse YAML frontmatter and Markdown tables into an internal model with basic schema checks.

## Sub-items
- Parse `mdxtab`, `tables`, `key` (default id), and `columns`.
- Validate `mdxtab` version is present and equals `1.0`.
- Extract table headers/rows; enforce declared column order and preserve row order.
- Trim header cells for column-name matching; do not trim data cells (preserve raw content). Reject tabs in data cells per spec.
- Preserve empty cells as raw blanks for the empty-cell policy to handle later.
- Fail clearly on missing sections or column/header mismatches.
