import { Command } from "commander";
import type { IO } from "./io.js";
import { run, type RunOptions } from "./run.js";

export interface ProgramDeps {
  runner?: (options: RunOptions, io: IO) => Promise<number>;
  version?: string;
}

interface ScanFlags {
  json?: boolean;
  readme?: boolean;
  stdout?: boolean;
  config?: string;
}

export function buildProgram(io: IO, deps: ProgramDeps = {}): Command {
  const runner = deps.runner ?? run;
  const program = new Command();

  program
    .name("clines")
    .description("Measure your codebase and update your README.")
    .version(deps.version ?? "0.0.0");

  program
    .command("scan", { isDefault: true })
    .description("Scan a directory and report code metrics.")
    .argument("[dir]", "directory to scan", ".")
    .option("--json", "output machine-readable JSON")
    .option("--stdout", "print the summary to stdout (default)")
    .option("--no-readme", "do not update README.md")
    .option("--config <path>", "path to a config file")
    .action(async (dir: string, flags: ScanFlags) => {
      const options: RunOptions = {
        dir,
        json: Boolean(flags.json),
        readme: flags.readme !== false,
        ...(flags.config !== undefined ? { config: flags.config } : {}),
      };
      await runner(options, io);
    });

  return program;
}
