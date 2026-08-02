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

const EXAMPLES = `
Examples:
  $ clines                   show this banner
  $ clines count             report the current directory
  $ clines count src         report a specific directory
  $ clines count --readme    report and update README.md
`;

export function buildProgram(io: IO, deps: ProgramDeps = {}): Command {
  const runner = deps.runner ?? run;
  const version = deps.version ?? "0.0.0";
  const program = new Command();

  program
    .name("clines")
    .description("Measure your codebase — count code, comments and blanks per language.")
    .version(version)
    .showHelpAfterError("(run `clines --help` for usage)")
    .addHelpText("after", EXAMPLES);

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

export async function runCli(argv: string[], io: IO, deps: ProgramDeps = {}): Promise<void> {
  const version = deps.version ?? "0.0.0";
  if (argv.slice(2).length === 0) {
    io.out(renderBanner(version));
    return;
  }
  const program = buildProgram(io, deps);
  program.exitOverride();
  await program.parseAsync(argv);
}
