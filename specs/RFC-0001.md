# RFC-0001: MDXTab – Markdown-Extended Tabular Data with Deterministic Computation

## Status

**Draft**

## Authors

(You)

## Target Audience

Developers, technical writers, financial planners, and teams requiring auditable, version-controlled tabular data with deterministic computation.

## Motivation

Spreadsheets (Excel, Google Sheets) are powerful but unsuitable as long-term sources of truth for finance, planning, and documentation:

* Binary formats produce poor diffs
* Cell-based references are fragile
* Computation logic is opaque
* Review and audit workflows are weak

**MDXTab** addresses these problems by combining:

* Markdown for human readability
* Structured metadata for computation
* A minimal, deterministic expression language
* Git-friendly text representation

---

## Design Goals

1. **Human-Readable**

   * Files must render meaningfully as Markdown without tooling.
2. **Deterministic**

   * Same input produces the same output, always.
3. **Auditable**

   * All logic is explicit and reviewable.
4. **Diff-Friendly**

   * Small logical changes produce small diffs.
5. **Composable**

   * Easy to parse, validate, and transform.

---

## Non-Goals

* Interactive spreadsheet UI
* Macros or side effects
* Volatile or time-dependent functions
* Implicit state or hidden dependencies
* Full Excel compatibility

---

## File Structure

An MDXTab document consists of:

1. **YAML Frontmatter** (schema + logic)
2. **Markdown Body** (data + presentation)

```md
---
mdxtab: 1.0
tables:
  <tableName>:
    key: <columnName>
    columns: [<columnName>, ...]
    types:
      <columnName>: number|string|bool|date
    computed:
      <columnName>: <expression>
    aggregates:
      <name>: <expression>
---

# Markdown content
```

---

## Tables

### Table Identification

Each table **MUST** have:

* A unique name
* A stable row key column

If `key` is omitted, it defaults to `id`.

---

### Markdown Table Rules

* Markdown tables:

  * **MUST contain only literal values**
  * **MUST NOT contain formulas**
* Column order:

  * Must match `columns` declaration
* Rows:

  * Identified by the key column value

Example:

```md
| id | category | net |
|----|----------|-----|
| h1 | Hosting  | 100 |
| a1 | Ads      | 200 |
```

---

## Data Types

Supported primitive types:

| Type   | Description             |
| ------ | ----------------------- |
| number | IEEE-754 floating point |
| string | UTF-8 text              |
| bool   | true / false            |
| date   | ISO-8601 (YYYY-MM-DD)   |

Type validation **MUST** fail on mismatch.

---

## Computed Columns

Computed columns are defined in frontmatter and evaluated per row.

```yaml
computed:
  tax: net * 0.25
  gross: net + tax
```

Rules:

* Computed columns:

  * MUST NOT appear in Markdown tables
  * MAY reference other computed columns
* Dependency cycles **MUST** cause validation failure

---

## Aggregates

Aggregates operate over the full table after row evaluation.

```yaml
aggregates:
  total_net: sum(net)
  total_tax: sum(tax)
```

Aggregates:

* Are scalar values
* MAY be referenced in Markdown via interpolation

---

## Expression Language

### Characteristics

* Pure
* Side-effect free
* Deterministic
* Strongly scoped

---

### Grammar (EBNF)

```
expression  ::= logical
logical     ::= comparison (("and" | "or") comparison)*
comparison  ::= sum (("==" | "!=" | ">" | "<" | ">=" | "<=") sum)*
sum         ::= term (("+" | "-") term)*
term        ::= factor (("*" | "/") factor)*
factor      ::= literal
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

### Built-in Functions (v1)

| Function    | Description    |
| ----------- | -------------- |
| sum(col)    | Sum of column  |
| avg(col)    | Average        |
| min(col)    | Minimum        |
| max(col)    | Maximum        |
| count(col)  | Non-null count |
| round(x, n) | Rounding       |
| if(c,a,b)   | Conditional    |

---

## Evaluation Order

1. Parse frontmatter and Markdown
2. Validate schema and types
3. Build dependency graph
4. Evaluate computed columns per row
5. Evaluate aggregates
6. Render output

---

## Interpolation

Aggregates may be referenced in Markdown:

```md
Total cost: {{ expenses.total_net }}
```

Interpolation **MUST NOT** execute arbitrary expressions.

---

## Error Handling

Failures **MUST** be fatal for:

* Type mismatches
* Missing columns
* Circular dependencies
* Invalid expressions

Errors **SHOULD** be reported with:

* File name
* Table name
* Column or aggregate name
* Line number (if available)

---

## Versioning

The `mdxtab` field declares the spec version.

```yaml
mdxtab: 1.0
```

Breaking changes **MUST** increment the major version.

---

## Security Considerations

* No I/O
* No file access
* No network access
* No runtime code execution

This format is safe to evaluate in CI environments.

---

# Project Roadmap

## Level 1: Specification & Foundations

### 1.1 Finalize Core Specification

* Define v1 as stable and frozen
* Clarify edge cases and error conditions

**Issues**

* Define required vs optional frontmatter fields
* Formalize type coercion rules
* Define numeric precision and rounding behavior

---

### 1.2 Reference Examples

* Finance
* Planning
* Docs-with-math

**Issues**

* Add finance example with tax and totals
* Add project planning example (timeline, cost)
* Add math documentation example with derived values

---

## Level 2: Reference Implementation

### 2.1 Parser

**Issues**

* Implement YAML frontmatter parser
* Implement Markdown table extractor
* Implement schema validation

---

### 2.2 Expression Engine

**Issues**

* Implement expression lexer
* Implement Pratt parser
* Implement AST evaluator
* Implement dependency graph & cycle detection

---

### 2.3 Evaluation Runtime

**Issues**

* Row-level computed column evaluation
* Aggregate evaluation
* Deterministic evaluation ordering

---

## Level 3: Tooling

### 3.1 CLI Tool

**Issues**

* `mdxtab validate` command
* `mdxtab render` command
* `mdxtab export csv/xlsx`

---

### 3.2 CI Integration

**Issues**

* GitHub Action for validation
* Fail PRs on computation errors
* Diff-aware validation output

---

## Level 4: Developer Experience

### 4.1 Editor Support

**Issues**

* VS Code syntax highlighting
* Frontmatter schema validation
* Expression autocomplete

---

### 4.2 Linting

**Issues**

* Unused column detection
* Redundant aggregate detection
* Precision-loss warnings

---

## Level 5: Ecosystem

### 5.1 Interoperability

**Issues**

* Excel import/export
* JSON export
* Static site generator plugins

---

### 5.2 Visualization (Metadata Only)

**Issues**

* Chart metadata spec
* Renderer-agnostic chart hints

---

## Suggested Repo Structure

```text
/spec
  RFC-0001.md
/examples
/reference-impl
  /parser
  /evaluator
/cli
/vscode-extension
```

