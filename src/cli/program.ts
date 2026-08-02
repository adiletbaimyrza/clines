import { Command } from "commander";
import { renderBanner } from "./banner.js";
import type { IO } from "./io.js";
import { run, type RunOptions } from "./run.js";

export interface ProgramDeps {
  runner?: (options: RunOptions, io: IO) => Promise<number>;
  version?: string;
}

interface CountFlags {
  readme?: boolean;
  config?: string;
}

export function buildProgram(io: IO, deps: ProgramDeps = {}): Command {
  const runner = deps.runner ?? run;
  const version = deps.version ?? "0.0.0";
  const program = new Command();

  program.name("clines").description("Measure your codebase.").version(version);

  program.action(() => {
    io.out(renderBanner(version));
  });

  program
    .command("count")
    .description("Count lines of code and report per-language metrics.")
    .argument("[dir]", "directory to count", ".")
    .option("--readme", "also write the report into README.md")
    .option("--config <path>", "path to a config file")
    .action(async (dir: string, flags: CountFlags) => {
      const options: RunOptions = {
        dir,
        readme: Boolean(flags.readme),
        ...(flags.config !== undefined ? { config: flags.config } : {}),
      };
      await runner(options, io);
    });

  return program;
}
