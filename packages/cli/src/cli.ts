import fs from "node:fs";
import { compileMdxtab, validateMdxtab } from "@mdxtab/core";

export interface CliIO {
  stdout: (text: string) => void;
  stderr: (text: string) => void;
  exit?: (code?: number) => void;
}

const defaultIo: CliIO = {
  stdout: (text: string) => process.stdout.write(text),
  stderr: (text: string) => process.stderr.write(text),
  exit: (code?: number) => process.exit(code ?? 0),
};

export function runCli(argv: string[], io: CliIO = defaultIo): number {
  let command: string | undefined;
  let file: string | undefined;
  let jsonOutput = false;
  for (const arg of argv) {
    if (arg.startsWith("--")) {
      if (arg === "--json") {
        jsonOutput = true;
        continue;
      }
      io.stderr(`Unknown option: ${arg}\n`);
      io.exit?.(1);
      return 1;
    }
    if (!command) {
      command = arg;
    } else if (!file) {
      file = arg;
    } else {
      io.stderr("Too many arguments\n");
      io.exit?.(1);
      return 1;
    }
  }
  if (!command || !file) {
    io.stderr("Usage: mdxtab <validate|render> <file> [--json]\n");
    io.exit?.(1);
    return 1;
  }
  if (command !== "validate" && command !== "render") {
    io.stderr(`Unknown command: ${command}\n`);
    io.exit?.(1);
    return 1;
  }
  if (jsonOutput && command !== "validate") {
    io.stderr("--json is only supported with the validate command\n");
    io.exit?.(1);
    return 1;
  }

  try {
    const raw = fs.readFileSync(file, "utf8");
    if (command === "validate") {
      const result = validateMdxtab(raw);
      if (jsonOutput) {
        io.stdout(JSON.stringify(result) + "\n");
      } else if (result.diagnostics.length === 0) {
        io.stdout("OK\n");
      } else {
        io.stderr(result.diagnostics[0].message + "\n");
      }
      const code = result.diagnostics.length === 0 ? 0 : 1;
      io.exit?.(code);
      return code;
    } else {
      const result = compileMdxtab(raw);
      io.stdout(result.rendered);
      if (!result.rendered.endsWith("\n")) io.stdout("\n");
      io.exit?.(0);
      return 0;
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    io.stderr(message + "\n");
    io.exit?.(1);
    return 1;
  }
}
