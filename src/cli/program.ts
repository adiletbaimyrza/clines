import { Command, InvalidArgumentError } from "commander";
import { renderBanner } from "./banner.js";
import type { IO } from "./io.js";
import { run, runDup, type DupOptions, type RunOptions } from "./run.js";

export interface ProgramDeps {
  runner?: (options: RunOptions, io: IO) => Promise<number>;
  dupRunner?: (options: DupOptions, io: IO) => Promise<number>;
  version?: string;
}

interface CountFlags {
  readme?: boolean;
  config?: string;
}

interface DupFlags {
  minLines: number;
  config?: string;
  html?: string;
}

const EXAMPLES = `
Examples:
  $ clines                   show this banner
  $ clines count             report the current directory
  $ clines count --readme    report and update README.md
  $ clines dup               find duplicated code blocks
  $ clines dup --min-lines 8 raise the clone threshold
`;

function parsePositiveInt(value: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new InvalidArgumentError("must be a positive integer");
  }
  return parsed;
}

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

  const dupRunner = deps.dupRunner ?? runDup;
  program
    .command("dup")
    .description("Find duplicated code blocks and report the duplication percentage.")
    .argument("[dir]", "directory to scan", ".")
    .option("--min-lines <n>", "minimum block size to flag as a clone", parsePositiveInt, 5)
    .option("--html <file>", "write a browsable HTML report to this path")
    .option("--config <path>", "path to a config file")
    .action(async (dir: string, flags: DupFlags) => {
      const options: DupOptions = {
        dir,
        minLines: flags.minLines,
        ...(flags.config !== undefined ? { config: flags.config } : {}),
        ...(flags.html !== undefined ? { html: flags.html } : {}),
      };
      await dupRunner(options, io);
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
