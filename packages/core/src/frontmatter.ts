import { parse as parseYaml } from "yaml";
import type { FrontmatterDocument, TableFrontmatter } from "./types.js";

function expectObject(value: unknown, context: string): Record<string, unknown> {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  throw new Error(`Invalid ${context}: expected object`);
}

function expectString(value: unknown, context: string): string {
  if (typeof value === "string") return value;
  throw new Error(`Invalid ${context}: expected string`);
}

function expectStringArray(value: unknown, context: string): string[] {
  if (!Array.isArray(value)) throw new Error(`Invalid ${context}: expected array of strings`);
  const arr = value.map((v) => {
    if (typeof v !== "string") throw new Error(`Invalid ${context}: expected array of strings`);
    return v;
  });
  if (arr.length === 0) throw new Error(`Invalid ${context}: must not be empty`);
  return arr;
}

function validateTable(name: string, value: unknown): TableFrontmatter {
  const obj = expectObject(value, `table ${name}`);
  const columns = expectStringArray(obj.columns, `columns for table ${name}`);
  const keyName = obj.key === undefined ? "id" : expectString(obj.key, `key for table ${name}`);

  const computed = obj.computed
    ? Object.fromEntries(
        Object.entries(expectObject(obj.computed, `computed for table ${name}`)).map(([k, v]) => [
          k,
          expectString(v, `computed expression for ${name}.${k}`),
        ]),
      )
    : undefined;

  const aggregates = obj.aggregates
    ? Object.fromEntries(
        Object.entries(expectObject(obj.aggregates, `aggregates for table ${name}`)).map(([k, v]) => [
          k,
          expectString(v, `aggregate expression for ${name}.${k}`),
        ]),
      )
    : undefined;

  const types: TableFrontmatter["types"] = obj.types
    ? Object.fromEntries(
        Object.entries(expectObject(obj.types, `types for table ${name}`)).map(([k, v]) => {
          if (v !== "number" && v !== "string" && v !== "date" && v !== "bool") {
            throw new Error(`Invalid type for ${name}.${k}: ${String(v)}`);
          }
          return [k, v];
        }),
      )
    : undefined;

  if (
    obj.empty_cells !== undefined &&
    obj.empty_cells !== "null" &&
    obj.empty_cells !== "zero" &&
    obj.empty_cells !== "empty-string" &&
    obj.empty_cells !== "error"
  ) {
    throw new Error(`Invalid empty_cells value for table ${name}: ${String(obj.empty_cells)}`);
  }

  return {
    key: keyName,
    columns,
    computed,
    aggregates,
    types,
    empty_cells: obj.empty_cells,
  };
}

export function parseFrontmatter(raw: string): FrontmatterDocument {
  const normalized = raw.replace(/\r\n?/g, "\n");
  const start = normalized.indexOf("---\n");
  if (start !== 0) {
    throw new Error("Frontmatter must start with ---");
  }
  const end = normalized.indexOf("\n---", 4);
  if (end === -1) {
    throw new Error("Closing --- for frontmatter not found");
  }
  const yamlText = normalized.slice(4, end);
  const parsed = parseYaml(yamlText);
  const obj = expectObject(parsed, "frontmatter root");

  const mdxtab = expectString(obj.mdxtab, "mdxtab version");
  if (mdxtab !== "1.0") throw new Error(`Unsupported mdxtab version: ${mdxtab}`);

  const tablesObj = expectObject(obj.tables, "tables");
  const tables: Record<string, TableFrontmatter> = {};
  for (const [name, value] of Object.entries(tablesObj)) {
    tables[name] = validateTable(name, value);
  }

  return { mdxtab, tables };
}
