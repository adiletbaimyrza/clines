import { Command, InvalidArgumentError } from "commander";
import { renderBanner } from "./banner.js";
import type { IO } from "./io.js";
import {
  run,
  runComplexity,
  runContext,
  runDup,
  type ComplexityOptions,
  type ContextOptions,
  type DupOptions,
  type RunOptions,
} from "./run.js";

export interface ProgramDeps {
  runner?: (options: RunOptions, io: IO) => Promise<number>;
  dupRunner?: (options: DupOptions, io: IO) => Promise<number>;
  complexityRunner?: (options: ComplexityOptions, io: IO) => Promise<number>;
  contextRunner?: (options: ContextOptions, io: IO) => Promise<number>;
  version?: string;
}

interface CountFlags {
  all?: boolean;
  readme?: boolean;
  config?: string;
}

interface DupFlags {
  all?: boolean;
  minLines: number;
  minCopies: number;
  open?: boolean;
  config?: string;
  html?: string;
}

interface ComplexityFlags {
  all?: boolean;
  top: number;
  open?: boolean;
  config?: string;
  html?: string;
}

interface ContextFlags {
  all?: boolean;
  window: number;
  top: number;
  max?: number;
  open?: boolean;
  config?: string;
  html?: string;
}

const EXAMPLES = `
Examples:
  $ clines                    show this banner
  $ clines count              report the current directory
  $ clines count --readme     report and update README.md
  $ clines dup                find duplicated code blocks
  $ clines dup --min-lines 8  raise the clone threshold
  $ clines cx --html cx.html  rank files by complexity
  $ clines ctx --window 1m    fit the repo to a context window
  $ clines ctx --max 200k     fail CI above a token budget
`;

function parsePositiveInt(value: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new InvalidArgumentError("must be a positive integer");
  }
  return parsed;
}

const SUFFIXES: Record<string, number> = { k: 1000, m: 1000000 };

function parseTokenCount(value: string): number {
  const match = /^(\d+(?:\.\d+)?)([km])?$/i.exec(value.trim());
  const scale = match === null ? 0 : (SUFFIXES[(match[2] ?? "").toLowerCase()] ?? 1);
  const parsed = match === null ? 0 : Math.round(Number(match[1]) * scale);
  if (parsed < 1) {
    throw new InvalidArgumentError("must be a positive token count, e.g. 200000, 200k or 1m");
  }
  return parsed;
}

export function buildProgram(io: IO, deps: ProgramDeps = {}): Command {
  const runner = deps.runner ?? run;
  const version = deps.version ?? "0.0.0";
  const program = new Command();

  program
    .name("clines")
    .description(
      "Measure your codebase — lines per language, duplication, complexity and context cost.",
    )
    .version(version)
    .showHelpAfterError("(run `clines --help` for usage)")
    .addHelpText("after", EXAMPLES);

  program
    .command("count")
    .description("Count lines of code and report per-language metrics.")
    .argument("[dir]", "directory to count", ".")
    .option("--readme", "also write the report into README.md")
    .option("--all", "include test, generated, vendored and docs files")
    .option("--config <path>", "path to a config file")
    .action(async (dir: string, flags: CountFlags) => {
      const options: RunOptions = {
        dir,
        readme: Boolean(flags.readme),
        all: flags.all === true,
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
    .option(
      "--min-copies <n>",
      "only report blocks duplicated at least n times",
      parsePositiveInt,
      2,
    )
    .option("--html <file>", "write a browsable HTML report to this path")
    .option("--no-open", "do not open the HTML report in a browser")
    .option("--all", "include test, generated, vendored and docs files")
    .option("--config <path>", "path to a config file")
    .action(async (dir: string, flags: DupFlags) => {
      const options: DupOptions = {
        dir,
        minLines: flags.minLines,
        all: flags.all === true,
        minCopies: flags.minCopies,
        open: flags.open !== false,
        ...(flags.config !== undefined ? { config: flags.config } : {}),
        ...(flags.html !== undefined ? { html: flags.html } : {}),
      };
      await dupRunner(options, io);
    });

  const complexityRunner = deps.complexityRunner ?? runComplexity;
  program
    .command("complexity")
    .alias("cx")
    .description("Rank files by decision-point complexity.")
    .argument("[dir]", "directory to scan", ".")
    .option("--top <n>", "number of files in the HTML report", parsePositiveInt, 100)
    .option("--html <file>", "write a browsable HTML report to this path")
    .option("--no-open", "do not open the HTML report in a browser")
    .option("--all", "include test, generated, vendored and docs files")
    .option("--config <path>", "path to a config file")
    .action(async (dir: string, flags: ComplexityFlags) => {
      const options: ComplexityOptions = {
        dir,
        top: flags.top,
        open: flags.open !== false,
        all: flags.all === true,
        ...(flags.config !== undefined ? { config: flags.config } : {}),
        ...(flags.html !== undefined ? { html: flags.html } : {}),
      };
      await complexityRunner(options, io);
    });

  const contextRunner = deps.contextRunner ?? runContext;
  program
    .command("context")
    .alias("ctx")
    .description("Estimate what the codebase costs an AI agent to read.")
    .argument("[dir]", "directory to scan", ".")
    .option("--window <n>", "context window to compare against", parseTokenCount, 200000)
    .option("--max <n>", "exit non-zero when the total exceeds this budget", parseTokenCount)
    .option("--top <n>", "number of files in the HTML report", parsePositiveInt, 100)
    .option("--html <file>", "write a browsable HTML report to this path")
    .option("--no-open", "do not open the HTML report in a browser")
    .option("--all", "include test, generated, vendored and docs files")
    .option("--config <path>", "path to a config file")
    .action(async (dir: string, flags: ContextFlags) => {
      const options: ContextOptions = {
        dir,
        window: flags.window,
        all: flags.all === true,
        top: flags.top,
        open: flags.open !== false,
        ...(flags.max !== undefined ? { max: flags.max } : {}),
        ...(flags.config !== undefined ? { config: flags.config } : {}),
        ...(flags.html !== undefined ? { html: flags.html } : {}),
      };
      await contextRunner(options, io);
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
