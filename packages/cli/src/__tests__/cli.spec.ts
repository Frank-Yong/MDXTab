import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runCli } from "../cli.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixture = (name: string) => path.join(__dirname, "..", "..", "fixtures", name);

function makeIo() {
  const out: string[] = [];
  const err: string[] = [];
  let code: number | undefined;
  return {
    io: {
      stdout: (t: string) => out.push(t),
      stderr: (t: string) => err.push(t),
      exit: (c?: number) => {
        code = c;
      },
    },
    out,
    err,
    get code() {
      return code;
    },
  };
}

describe("mdxtab CLI", () => {
  it("renders a document", () => {
    const ctx = makeIo();
    const rc = runCli(["render", fixture("sample.md")], ctx.io);
    expect(rc).toBe(0);
    expect(ctx.code).toBe(0);
    expect(ctx.out.join("")).toContain("Summary: 300 / 40");
  });

  it("validates a document", () => {
    const ctx = makeIo();
    const rc = runCli(["validate", fixture("sample.md")], ctx.io);
    expect(rc).toBe(0);
    expect(ctx.code).toBe(0);
    expect(ctx.out.join("").trim()).toBe("OK");
  });

  it("fails on invalid input", () => {
    const ctx = makeIo();
    const rc = runCli(["render", fixture("invalid.md")], ctx.io);
    expect(rc).toBe(1);
    expect(ctx.code).toBe(1);
    expect(ctx.err.join("")).toMatch(/Unknown aggregate/);
  });

  it("emits JSON diagnostics on validate", () => {
    const ctx = makeIo();
    const rc = runCli(["validate", fixture("invalid.md"), "--json"], ctx.io);
    expect(rc).toBe(1);
    expect(ctx.code).toBe(1);
    const out = JSON.parse(ctx.out.join(""));
    expect(out.file).toContain("invalid.md");
    expect(out.ok).toBe(false);
    expect(out.exitCode).toBe(1);
    expect(out.errors).toEqual([]);
    expect(out.diagnostics).toHaveLength(1);
    expect(out.diagnostics[0].code).toBe("E_AGG_REF");
  });

  it("emits JSON ok on validate", () => {
    const ctx = makeIo();
    const rc = runCli(["validate", fixture("sample.md"), "--json"], ctx.io);
    expect(rc).toBe(0);
    expect(ctx.code).toBe(0);
    const out = JSON.parse(ctx.out.join(""));
    expect(out.file).toContain("sample.md");
    expect(out.ok).toBe(true);
    expect(out.exitCode).toBe(0);
    expect(out.errors).toEqual([]);
    expect(out.diagnostics).toEqual([]);
  });

  it("emits JSON errors on missing file", () => {
    const ctx = makeIo();
    const rc = runCli(["validate", fixture("missing.md"), "--json"], ctx.io);
    expect(rc).toBe(1);
    expect(ctx.code).toBe(1);
    const out = JSON.parse(ctx.out.join(""));
    expect(out.file).toContain("missing.md");
    expect(out.ok).toBe(false);
    expect(out.exitCode).toBe(1);
    expect(out.errors.length).toBeGreaterThan(0);
    expect(out.diagnostics).toEqual([]);
  });

  it("emits E_NUMBER diagnostics for non-finite arithmetic on validate", () => {
    const ctx = makeIo();
    const rc = runCli(["validate", fixture("non-finite.md"), "--json"], ctx.io);
    expect(rc).toBe(1);
    expect(ctx.code).toBe(1);
    const out = JSON.parse(ctx.out.join(""));
    expect(out.ok).toBe(false);
    expect(out.exitCode).toBe(1);
    expect(out.errors).toEqual([]);
    expect(out.diagnostics).toHaveLength(1);
    expect(out.diagnostics[0].code).toBe("E_NUMBER");
    expect(out.diagnostics[0].table).toBe("t");
    expect(out.diagnostics[0].column).toBe("total");
  });

  it("emits E_NUMBER diagnostics for non-finite aggregate results on validate", () => {
    const huge = `1${"0".repeat(308)}`;
    const tempFile = fixture("tmp-non-finite-aggregate.md");
    fs.writeFileSync(tempFile, `---
mdxtab: "1.0"
tables:
  t:
    key: id
    columns: [id, value]
    types:
      value: number
    aggregates:
      total: sum(value)
---

## t
| id | value |
|----|-------|
| a  | ${huge} |
| b  | ${huge} |
`);

    const ctx = makeIo();
    try {
      const rc = runCli(["validate", tempFile, "--json"], ctx.io);
      expect(rc).toBe(1);
      expect(ctx.code).toBe(1);
      const out = JSON.parse(ctx.out.join(""));
      expect(out.ok).toBe(false);
      expect(out.exitCode).toBe(1);
      expect(out.errors).toEqual([]);
      expect(out.diagnostics).toHaveLength(1);
      expect(out.diagnostics[0].code).toBe("E_NUMBER");
      expect(out.diagnostics[0].table).toBe("t");
      expect(out.diagnostics[0].aggregate).toBe("total");
    } finally {
      if (fs.existsSync(tempFile)) {
        fs.rmSync(tempFile);
      }
    }
  });

  it("allows overriding expression limits from the CLI", () => {
    const ctx = makeIo();
    const rc = runCli(["validate", fixture("sample.md"), "--max-expression-length", "3"], ctx.io);
    expect(rc).toBe(1);
    expect(ctx.code).toBe(1);
    expect(ctx.err.join(" ")).toMatch(/E_LIMIT/);
  });

  it("accepts expression limit overrides in equals form", () => {
    const ctx = makeIo();
    const rc = runCli(["validate", fixture("sample.md"), "--max-expression-length=32"], ctx.io);
    expect(rc).toBe(0);
    expect(ctx.code).toBe(0);
    expect(ctx.out.join("").trim()).toBe("OK");
  });

  it("accepts parse-depth overrides", () => {
    const ctx = makeIo();
    const rc = runCli(["validate", fixture("sample.md"), "--max-parse-depth=32"], ctx.io);
    expect(rc).toBe(0);
    expect(ctx.code).toBe(0);
    expect(ctx.out.join("").trim()).toBe("OK");
  });

  it("reports invalid expression limit values without throwing", () => {
    const ctx = makeIo();
    const rc = runCli(["validate", fixture("sample.md"), "--max-tokens", "foo"], ctx.io);
    expect(rc).toBe(1);
    expect(ctx.code).toBe(1);
    expect(ctx.err.join("")).toContain("Invalid value for maxTokens: expected a positive integer");
  });

  it("reports invalid equals-form expression limit values without throwing", () => {
    const ctx = makeIo();
    const rc = runCli(["validate", fixture("sample.md"), "--max-ast-depth=-1"], ctx.io);
    expect(rc).toBe(1);
    expect(ctx.code).toBe(1);
    expect(ctx.err.join("")).toContain("Invalid value for maxAstDepth: expected a positive integer");
  });
});
