import fs from "node:fs";
import { compileMdxtab } from "@mdxtab/core";

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
  const [command, file] = argv;
  if (!command || !file) {
    io.stderr("Usage: mdxtab <validate|render> <file>\n");
    io.exit?.(1);
    return 1;
  }
  if (command !== "validate" && command !== "render") {
    io.stderr(`Unknown command: ${command}\n`);
    io.exit?.(1);
    return 1;
  }

  try {
    const raw = fs.readFileSync(file, "utf8");
    const result = compileMdxtab(raw);
    if (command === "validate") {
      io.stdout("OK\n");
    } else {
      io.stdout(result.rendered);
      if (!result.rendered.endsWith("\n")) io.stdout("\n");
    }
    io.exit?.(0);
    return 0;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    io.stderr(message + "\n");
    io.exit?.(1);
    return 1;
  }
}
