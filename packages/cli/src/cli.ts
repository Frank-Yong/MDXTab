import fs from "node:fs";
import { compileMdxtab, validateMdxtab } from "@mdxtab/core";
import type { CompileOptions, ExpressionLimits } from "@mdxtab/core";

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

function parsePositiveIntOption(name: keyof ExpressionLimits, value: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Invalid value for ${name}: expected a positive integer`);
  }
  return parsed;
}

function usage(): string {
  return [
    "Usage: mdxtab <validate|render> <file> [--json]",
    "       [--max-expression-length N] [--max-tokens N]",
    "       [--max-ast-depth N] [--max-parse-depth N] [--max-dependency-depth N]",
  ].join("\n") + "\n";
}

export function runCli(argv: string[], io: CliIO = defaultIo): number {
  let command: string | undefined;
  let file: string | undefined;
  let jsonOutput = false;
  const compileOptions: CompileOptions = {};
  const expressionLimits: Partial<ExpressionLimits> = {};

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg.startsWith("--")) {
      if (arg === "--json") {
        jsonOutput = true;
        continue;
      }
      const optionMatch = arg.match(/^--(max-expression-length|max-tokens|max-ast-depth|max-parse-depth|max-dependency-depth)(?:=(.+))?$/);
      if (optionMatch) {
        const optionName = optionMatch[1];
        const value = optionMatch[2] ?? argv[index + 1];
        if (!value || (!optionMatch[2] && value.startsWith("--"))) {
          io.stderr(`Missing value for --${optionName}\n`);
          io.exit?.(1);
          return 1;
        }
        if (!optionMatch[2]) index += 1;

        try {
          switch (optionName) {
            case "max-expression-length":
              expressionLimits.maxLength = parsePositiveIntOption("maxLength", value);
              break;
            case "max-tokens":
              expressionLimits.maxTokens = parsePositiveIntOption("maxTokens", value);
              break;
            case "max-ast-depth":
              expressionLimits.maxAstDepth = parsePositiveIntOption("maxAstDepth", value);
              break;
            case "max-parse-depth":
              expressionLimits.maxParseDepth = parsePositiveIntOption("maxParseDepth", value);
              break;
            case "max-dependency-depth":
              expressionLimits.maxDependencyDepth = parsePositiveIntOption("maxDependencyDepth", value);
              break;
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          io.stderr(message + "\n");
          io.exit?.(1);
          return 1;
        }
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
  if (Object.keys(expressionLimits).length > 0) {
    compileOptions.expressionLimits = expressionLimits;
  }
  if (!command || !file) {
    io.stderr(usage());
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
      const result = validateMdxtab(raw, compileOptions);
      const exitCode = result.diagnostics.length === 0 ? 0 : 1;
      if (jsonOutput) {
        io.stdout(
          JSON.stringify({
            file,
            ok: exitCode === 0,
            diagnostics: result.diagnostics,
            errors: [],
            exitCode,
          }) + "\n",
        );
      } else if (result.diagnostics.length === 0) {
        io.stdout("OK\n");
      } else {
        io.stderr(result.diagnostics[0].message + "\n");
      }
      io.exit?.(exitCode);
      return exitCode;
    } else {
      const result = compileMdxtab(raw, compileOptions);
      io.stdout(result.rendered);
      if (!result.rendered.endsWith("\n")) io.stdout("\n");
      io.exit?.(0);
      return 0;
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (jsonOutput && command === "validate") {
      io.stdout(
        JSON.stringify({
          file,
          ok: false,
          diagnostics: [],
          errors: [message],
          exitCode: 1,
        }) + "\n",
      );
      io.exit?.(1);
      return 1;
    }
    io.stderr(message + "\n");
    io.exit?.(1);
    return 1;
  }
}
