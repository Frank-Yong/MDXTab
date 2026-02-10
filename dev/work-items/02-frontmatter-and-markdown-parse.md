# Work Item: Frontmatter and Markdown parsing

## Description
Parse YAML frontmatter and Markdown tables into an internal model with basic schema checks.

## Sub-items
- Parse `mdxtab`, `tables`, `key` (default id), and `columns`.
- Extract table headers/rows; enforce column order match.
- Preserve row order; capture empty cells as raw blanks for later policy handling.
- Fail clearly on missing sections or column/header mismatches.
