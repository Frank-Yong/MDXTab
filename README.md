# MDXTab - Markdown eXtended Tables

1. **Proposed format (final choice + rationale)**
2. **Formal spec (v1)**
3. **Formula grammar**
4. **Evaluation model (how it computes)**
5. **Parser architecture**
6. **Comparison vs Excel / Google Sheets**
7. **What this format is *not* trying to be**

---

# Development quickstart

## Prerequisites

- Node.js 20 LTS (includes `node`, `npm`, `npx` on PATH)

## Install

```sh
npm install
```

## Build the VS Code extension

```sh
npm run -w mdxtab build
```

## Package a VSIX

`npm exec -w mdxtab` runs the command from packages/vscode. The build step copies @mdxtab/core into dist, so `--no-dependencies` keeps the VSIX lean.

```sh
npm exec -w mdxtab -- vsce package --no-dependencies
```

---

# 1️⃣ Chosen approach (why this one)

✅ **Markdown Tables + YAML frontmatter for logic**

| Requirement    | Why this wins                                 |
| -------------- | --------------------------------------------- |
| Finance        | Deterministic, auditable, diffable            |
| Planning       | Named rows & aggregates, no fragile cell refs |
| Docs-with-math | Markdown stays readable                       |
| GitHub         | Clean diffs, CI validation                    |
| Longevity      | Easy to render → HTML, PDF, Excel             |

Excel-style “formula in every cell” is actively bad for versioned finance.

---

# 2️⃣ MDXTab – Formal Spec (v1)

## File structure

```md
---
mdxtab: 1.0
tables:
  <tableName>:
    key: <columnName>        # optional, default: id
    columns:
      - <columnName>
    empty_cells: null|zero|empty-string|error  # optional, default: null
    types:                   # optional
      <columnName>: number|string|date|bool|time
    computed:
      <columnName>: <expression>
    aggregates:
      <name>: <expression>
---

# Human-readable Markdown

## <Table title>

| column | column | column |
|--------|--------|--------|
| value  | value  | value  |
```

---

## Required rules

* Each table:

  * Has a **name**
  * Has a **stable row key**
* Markdown tables:

  * Contain **raw data only**
  * No formulas inline
  * Empty cells default to **null** unless overridden
* All logic lives in frontmatter

---

## Example (Finance)

```md
---
mdxtab: 1.0
tables:
  expenses:
    key: id
    columns: [id, category, net, tax, gross]
    types:
      net: number
      tax: number
      gross: number
    computed:
      tax: net * 0.25
      gross: net + tax
    aggregates:
      net_total: sum(net)
      tax_total: sum(tax)
      gross_total: sum(gross)
---

## Expenses

| id | category | net |
|----|----------|-----|
| h1 | Hosting  | 100 |
| a1 | Ads      | 200 |
| s1 | Support  | 150 |

### Totals
- Net: {{ expenses.net_total }}
- Tax: {{ expenses.tax_total }}
- Gross: {{ expenses.gross_total }}
```

---

# 3️⃣ Formula Grammar (EBNF)

This is intentionally **small and boring** (good thing).

```
expression  ::= logical
logical     ::= comparison (("and" | "or") comparison)*
comparison  ::= sum (("==" | "!=" | ">" | "<" | ">=" | "<=") sum)*
sum         ::= term (("+" | "-") term)*
term        ::= factor (("*" | "/") factor)*
factor      ::= number
              | string
              | boolean
              | reference
              | function
              | "(" expression ")"

reference   ::= identifier
              | "row." identifier
              | table_ref

table_ref   ::= identifier "[" identifier "]." identifier

function    ::= identifier "(" arguments? ")"
arguments   ::= expression ("," expression)*
```

---

## Built-in functions (v1)

| Function         | Meaning          |
| ---------------- | ---------------- |
| `sum(col)`       | Column sum       |
| `avg(col)`       | Average          |
| `min(col)`       | Minimum          |
| `max(col)`       | Maximum          |
| `count(col)`     | Non-null count   |
| `round(x, n)`    | Decimal rounding |
| `if(cond, a, b)` | Conditional      |
| `hours(x)`       | H:MM to hours    |

No volatile functions. No I/O. No side effects.

Example:
```md
computed:
  duration: hours(end) - hours(start) - hours(break)
```

## Expression guardrails

MDXTab rejects pathological expressions with a structured `E_LIMIT` diagnostic
instead of attempting unbounded parse/evaluate work.

Current implementation limits:

| Limit | Value |
| ----- | ----- |
| Maximum expression length | 4096 characters |
| Maximum token count | 512 tokens |
| Maximum AST depth | 64 |
| Maximum dependency traversal depth | 128 |

These limits apply to computed columns, aggregates, and dependency ordering.
When a limit is exceeded, validation/rendering fails with normal table/column or
aggregate context so the offending expression can be located quickly.

Core API note:
- `compileMdxtab()` and `validateMdxtab()` accept `expressionLimits` in `CompileOptions`.

CLI note:

```sh
mdxtab validate report.md --max-expression-length 8192 --max-ast-depth 128
mdxtab render report.md --max-tokens 1024 --max-dependency-depth 256
```

---

# 4️⃣ Evaluation Model (how it works)

### Phase 1: Parse

* Markdown → tables
* YAML → schema + expressions

### Phase 2: Validate

* Column existence
* Type checking
* No circular dependencies
* Deterministic ordering
* Expression guardrails for pathological input size and nesting

### Phase 3: Row evaluation

Computed columns are evaluated **per row**:

```text
row.tax   = row.net * 0.25
row.gross = row.net + row.tax
```

Order is auto-resolved via dependency graph.

---

### Phase 4: Aggregates

Aggregates operate over **final column values**:

```text
sum(net)
sum(gross)
```

Grouped aggregates:

```text
sum(duration) by project
```

Rendered usage:

```md
{{ time_entries.hours_by_project[Alpha] }}
```

---

### Phase 5: Rendering

Output options:

* Replace `{{ }}` in Markdown
* Export CSV / XLSX
* Generate HTML tables

---

# 5️⃣ Parser & Evaluator Architecture

## High-level components

```text
Lexer → AST → Validator → Evaluator → Renderer
```

---

## Minimal implementation stack

### Parsing

* Markdown parser (tables only)
* YAML parser
* Expression parser (Pratt parser is perfect)

### Internal model

```ts
Table {
  name
  rows: Row[]
  columns
  computedColumns
  aggregates
}

Row {
  id
  values
}
```

---

## Circular dependency detection

Graph-based:

```
tax   → net
gross → tax
```

Cycle = error, fail fast.

---

## Determinism guarantee

* No randomness
* No wall-clock time functions
* No mutation
* Same input → same output

This matters for finance audits.

---

# 6️⃣ Comparison: MDXTab vs Excel / Sheets

### Feature comparison

| Feature          | MDXTab        | Excel | Sheets      |
| ---------------- | ------------- | ----- | ----------- |
| Git diffs        | ⭐⭐⭐⭐⭐         | ❌     | ❌           |
| Auditable        | ⭐⭐⭐⭐⭐         | ⭐⭐    | ⭐⭐          |
| Docs integration | ⭐⭐⭐⭐⭐         | ⭐     | ⭐           |
| Cell formulas    | ❌ (by design) | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐       |
| Macros           | ❌             | ⭐⭐⭐⭐  | ⭐⭐          |
| Circular refs    | ❌             | 😬    | 😬          |
| Ref stability    | ⭐⭐⭐⭐⭐         | ❌     | ❌           |
| Automation       | CI/CD         | VBA   | Apps Script |

---

### What Excel does better

* Interactive exploration
* Ad-hoc modeling
* Charts & pivot tables

### What MDXTab does better

* **Financial truth**
* **Planning**
* **Long-term maintenance**
* **Team workflows**
* **Code reviews**

This is closer to **SQL + Markdown** than Excel.

---

# 7️⃣ What MDXTab is *not*

Let’s be explicit:

❌ Not a spreadsheet replacement
❌ Not for ad-hoc “what if I drag this”
❌ Not for non-technical users (without tooling)
❌ Not VBA-compatible

It’s a **source-of-truth format**, not a UI.

---

## Natural evolution path

If this grows:

* v1 → tables + math
* v2 → multi-file imports
* v3 → chart metadata
* v4 → constraints & assertions
* v5 → versioned financial models

Still text. Still sane.
