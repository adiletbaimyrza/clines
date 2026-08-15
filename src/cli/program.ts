import { Command, InvalidArgumentError, Option } from "commander";
import { serveStdio } from "../mcp/stdio.js";
import { renderBanner } from "./banner.js";
import type { IO } from "./io.js";
import { collect, flush, type FlushOptions } from "./pager.js";
import {
  run,
  runAgent,
  runComments,
  runComplexity,
  runCoupling,
  runContext,
  runDup,
  runRefactor,
  type AgentOptions,
  type CommentsOptions,
  type ComplexityOptions,
  type CouplingOptions,
  type ContextOptions,
  type DupOptions,
  type RefactorOptions,
  type RunOptions,
} from "./run.js";

export interface ProgramDeps {
  runner?: (options: RunOptions, io: IO) => Promise<number>;
  dupRunner?: (options: DupOptions, io: IO) => Promise<number>;
  complexityRunner?: (options: ComplexityOptions, io: IO) => Promise<number>;
  contextRunner?: (options: ContextOptions, io: IO) => Promise<number>;
  commentsRunner?: (options: CommentsOptions, io: IO) => Promise<number>;
  couplingRunner?: (options: CouplingOptions, io: IO) => Promise<number>;
  agentRunner?: (options: AgentOptions, io: IO) => Promise<number>;
  refactorRunner?: (options: RefactorOptions, io: IO) => Promise<number>;
  mcpInput?: AsyncIterable<string>;
  flush?: FlushOptions;
  version?: string;
}

interface CountFlags {
  all?: boolean;
  json?: boolean;
  diff?: string;
  readme?: boolean;
  distribution?: boolean;
  dist?: boolean;
  config?: string;
}

interface DupFlags {
  all?: boolean;
  json?: boolean;
  diff?: string;
  maxDuplication?: number;
  crossFile?: boolean;
  renamed?: boolean;
  churn?: boolean;
  top: number;
  minLines: number;
  minCopies: number;
  open?: boolean;
  config?: string;
  html?: string;
}

interface ComplexityFlags {
  all?: boolean;
  json?: boolean;
  diff?: string;
  maxDensity?: number;
  sort: "raw" | "density";
  minLines: number;
  explain?: boolean;
  top: number;
  open?: boolean;
  config?: string;
  html?: string;
}

interface ContextFlags {
  all?: boolean;
  json?: boolean;
  diff?: string;
  window: number;
  budget: number;
  top: number;
  max?: number;
  open?: boolean;
  config?: string;
  html?: string;
}

interface RefactorFlags {
  all?: boolean;
  json?: boolean;
  diff?: string;
  maxReread?: number;
  explain?: boolean;
  sort: "cost" | "churn" | "recent";
  includeBots?: boolean;
  since: string;
  top: number;
  price?: number;
  config?: string;
}

interface AgentFlags {
  all?: boolean;
  json?: boolean;
  diff?: string;
  top: number;
  minLines: number;
  config?: string;
}

interface CouplingFlags {
  json?: boolean;
  since: string;
  top: number;
  minRevisions: number;
  minShared: number;
  minStrength: number;
  maxCommitSize: number;
  includeBots?: boolean;
  config?: string;
}

interface CommentsFlags {
  all?: boolean;
  json?: boolean;
  diff?: string;
  maxDrift?: number;
  years: number;
  top: number;
  scan: number;
  config?: string;
}

const EXAMPLES = `
Examples:
  $ clines                    show this banner
  $ clines count              report the current directory
  $ clines count --readme     report and update README.md
  $ clines count --dist       add distribution and the largest files
  $ clines dup                find duplicated code blocks
  $ clines dup --min-lines 8  raise the clone threshold
  $ clines cx --html cx.html  rank files by complexity
  $ clines ctx --window 1m    fit the repo to a context window
  $ clines ctx --max 200k     fail CI above a token budget
  $ clines ctx --json | jq    machine-readable output from any command
  $ clines ctx --diff main    only the files this branch changed
  $ clines comments           find comments the code moved away from
  $ clines refactor           decide which files are worth refactoring
  $ clines coupling           find files that keep changing together
  $ clines agent              rate what is safe to hand to a coding agent
  $ clines cx --top all       list every file, through your pager
  $ clines mcp                serve the analyses to an AI agent over MCP
`;

const MCP_HELP = `Usage: clines mcp

Serve the analyses to an AI coding agent over the Model Context Protocol,
speaking JSON-RPC 2.0 on stdin and stdout. It takes no options: the directory,
row count and diff ref are arguments of each tool call.

Tools:
  clines_count      lines, comments and blanks per language
  clines_dup        duplicated code blocks
  clines_cx         files ranked by complexity
  clines_ctx        estimated token cost to read the repo
  clines_comments   comments the code has drifted away from
  clines_refactor   which files are worth refactoring
  clines_coupling   files that keep changing together
  clines_agent      what is safe to hand to a coding agent

Register it with an agent, for example:
  $ claude mcp add clines -- npx clines mcp
`;

const UNLIMITED = Number.MAX_SAFE_INTEGER;

function parseRowCount(value: string): number {
  const trimmed = value.trim().toLowerCase();
  if (trimmed === "all" || trimmed === "0") {
    return UNLIMITED;
  }
  return parsePositiveInt(value);
}

function parsePrice(value: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new InvalidArgumentError("must be a price per million tokens, e.g. 3 or 0.25");
  }
  return parsed;
}

function parsePercentage(value: string): number {
  const parsed = Number(value.trim().replace(/%$/, ""));
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) {
    throw new InvalidArgumentError("must be a percentage between 0 and 100, e.g. 5 or 12.5");
  }
  return parsed;
}

function parsePositiveNumber(value: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new InvalidArgumentError("must be a positive number, e.g. 20 or 12.5");
  }
  return parsed;
}

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

export type ExitReporter = (code: number) => void;

export function buildProgram(io: IO, deps: ProgramDeps, onExit: ExitReporter): Command {
  const runner = deps.runner ?? run;
  const version = deps.version ?? "0.0.0";
  const program = new Command();

  program
    .name("clines")
    .description(
      "Measure your codebase — lines per language, duplication, complexity, token cost, comment drift, change coupling, and what is worth refactoring.",
    )
    .version(version)
    .option("--no-pager", "print long output directly instead of through a pager")
    .showHelpAfterError("(run `clines --help` for usage)")
    .addHelpText("after", EXAMPLES);

  program
    .command("count")
    .description("Count lines of code and report per-language metrics.")
    .addHelpText(
      "after",
      "\nExamples:\n  $ clines count\n  $ clines count --distribution\n  $ clines count src --readme\n  $ clines count --all\n",
    )
    .argument("[dir]", "directory to count", ".")
    .option("--readme", "also write the report into README.md")
    .option("--distribution", "also show file-size distribution, density and the largest files")
    .addOption(new Option("--dist").hideHelp())
    .option("--all", "include test, generated, vendored and docs files")
    .option("--json", "print the report as JSON on stdout")
    .option("--diff <ref>", "only report on files changed since this git ref")
    .option("--config <path>", "path to a config file")
    .action(async (dir: string, flags: CountFlags) => {
      const options: RunOptions = {
        dir,
        readme: Boolean(flags.readme),
        distribution: flags.distribution === true || flags.dist === true,
        all: flags.all === true,
        json: flags.json === true,
        ...(flags.diff !== undefined ? { diff: flags.diff } : {}),
        version,
        ...(flags.config !== undefined ? { config: flags.config } : {}),
      };
      onExit(await runner(options, io));
    });

  const dupRunner = deps.dupRunner ?? runDup;
  program
    .command("dup")
    .description("Find duplicated code blocks and report the duplication percentage.")
    .addHelpText(
      "after",
      "\nExamples:\n  $ clines dup\n  $ clines dup --min-lines 8 --min-copies 3\n  $ clines dup --html dup.html\n",
    )
    .argument("[dir]", "directory to scan", ".")
    .option("--min-lines <n>", "minimum block size to flag as a clone", parsePositiveInt, 5)
    .option(
      "--min-copies <n>",
      "only report blocks duplicated at least n times",
      parsePositiveInt,
      2,
    )
    .option("--top <n>", "clone groups and files to list, or `all`", parseRowCount, 10)
    .option("--cross-file", "ignore duplication that sits inside a single file")
    .option("--renamed", "also count clones that match once identifiers are ignored")
    .option("--churn", "show when each clone was last touched (needs git)")
    .option(
      "--max-duplication <pct>",
      "exit 2 when duplication exceeds this percentage",
      parsePercentage,
    )
    .option("--html <file>", "write a browsable HTML report to this path")
    .option("--open", "open the HTML report in a browser")
    .option("--all", "include test, generated, vendored and docs files")
    .option("--json", "print the report as JSON on stdout")
    .option("--diff <ref>", "only report on files changed since this git ref")
    .option("--config <path>", "path to a config file")
    .action(async (dir: string, flags: DupFlags) => {
      const options: DupOptions = {
        dir,
        top: flags.top,
        crossFile: flags.crossFile === true,
        renamed: flags.renamed === true,
        churn: flags.churn === true,
        minLines: flags.minLines,
        all: flags.all === true,
        json: flags.json === true,
        ...(flags.diff !== undefined ? { diff: flags.diff } : {}),
        version,
        minCopies: flags.minCopies,
        ...(flags.maxDuplication !== undefined ? { maxDuplication: flags.maxDuplication } : {}),
        open: flags.open === true,
        ...(flags.config !== undefined ? { config: flags.config } : {}),
        ...(flags.html !== undefined ? { html: flags.html } : {}),
      };
      onExit(await dupRunner(options, io));
    });

  const complexityRunner = deps.complexityRunner ?? runComplexity;
  program
    .command("complexity")
    .alias("cx")
    .description("Rank files by decision-point complexity.")
    .addOption(
      new Option("--sort <order>", "rank by raw complexity or by density")
        .choices(["raw", "density"])
        .default("raw"),
    )
    .option("--min-lines <n>", "ignore files below this many code lines", parsePositiveInt, 1)
    .option("--explain", "add the branch, loop and boolean breakdown")
    .option(
      "--max-density <n>",
      "exit 2 when any file exceeds this complexity per 100 lines",
      parsePositiveNumber,
    )
    .addHelpText(
      "after",
      "\nExamples:\n  $ clines cx\n  $ clines cx --explain\n  $ clines cx --sort density --min-lines 100\n",
    )
    .argument("[dir]", "directory to scan", ".")
    .option("--top <n>", "files to list, or `all`", parseRowCount, 20)
    .option("--html <file>", "write a browsable HTML report to this path")
    .option("--open", "open the HTML report in a browser")
    .option("--all", "include test, generated, vendored and docs files")
    .option("--json", "print the report as JSON on stdout")
    .option("--diff <ref>", "only report on files changed since this git ref")
    .option("--config <path>", "path to a config file")
    .action(async (dir: string, flags: ComplexityFlags) => {
      const options: ComplexityOptions = {
        dir,
        sort: flags.sort,
        minLines: flags.minLines,
        explain: flags.explain === true,
        ...(flags.maxDensity !== undefined ? { maxDensity: flags.maxDensity } : {}),
        top: flags.top,
        open: flags.open === true,
        all: flags.all === true,
        json: flags.json === true,
        ...(flags.diff !== undefined ? { diff: flags.diff } : {}),
        version,
        ...(flags.config !== undefined ? { config: flags.config } : {}),
        ...(flags.html !== undefined ? { html: flags.html } : {}),
      };
      onExit(await complexityRunner(options, io));
    });

  const contextRunner = deps.contextRunner ?? runContext;
  program
    .command("context")
    .alias("ctx")
    .description("Estimate what the codebase costs an AI agent to read.")
    .addHelpText(
      "after",
      "\nExamples:\n  $ clines ctx\n  $ clines ctx --window 1m --budget 100k\n  $ clines ctx --max 200k\n",
    )
    .argument("[dir]", "directory to scan", ".")
    .option("--window <n>", "context window to compare against", parseTokenCount, 200000)
    .option("--budget <n>", "working set a single read should fit inside", parseTokenCount, 50000)
    .option("--max <n>", "exit non-zero when the total exceeds this budget", parseTokenCount)
    .option("--top <n>", "files to list, or `all`", parseRowCount, 20)
    .option("--html <file>", "write a browsable HTML report to this path")
    .option("--open", "open the HTML report in a browser")
    .option("--all", "include test, generated, vendored and docs files")
    .option("--json", "print the report as JSON on stdout")
    .option("--diff <ref>", "only report on files changed since this git ref")
    .option("--config <path>", "path to a config file")
    .action(async (dir: string, flags: ContextFlags) => {
      const options: ContextOptions = {
        dir,
        window: flags.window,
        budget: flags.budget,
        all: flags.all === true,
        json: flags.json === true,
        ...(flags.diff !== undefined ? { diff: flags.diff } : {}),
        version,
        top: flags.top,
        open: flags.open === true,
        ...(flags.max !== undefined ? { max: flags.max } : {}),
        ...(flags.config !== undefined ? { config: flags.config } : {}),
        ...(flags.html !== undefined ? { html: flags.html } : {}),
      };
      onExit(await contextRunner(options, io));
    });

  const commentsRunner = deps.commentsRunner ?? runComments;
  program
    .command("comments")
    .alias("cm")
    .description("Find comments the code has drifted away from (needs git).")
    .addHelpText(
      "after",
      "\nExamples:\n  $ clines comments\n  $ clines comments --years 1 --scan 200\n",
    )
    .argument("[dir]", "directory to scan", ".")
    .option(
      "--years <n>",
      "how far the code may drift before a comment is suspect",
      parsePositiveInt,
      3,
    )
    .option("--top <n>", "files to list, or `all`", parseRowCount, 20)
    .option("--scan <n>", "how many of the most commented files to blame", parsePositiveInt, 50)
    .option(
      "--max-drift <pct>",
      "exit 2 when drifted comment blocks exceed this share",
      parsePercentage,
    )
    .option("--all", "include test, generated, vendored and docs files")
    .option("--json", "print the report as JSON on stdout")
    .option("--diff <ref>", "only report on files changed since this git ref")
    .option("--config <path>", "path to a config file")
    .action(async (dir: string, flags: CommentsFlags) => {
      const options: CommentsOptions = {
        dir,
        all: flags.all === true,
        json: flags.json === true,
        ...(flags.diff !== undefined ? { diff: flags.diff } : {}),
        version,
        years: flags.years,
        top: flags.top,
        scan: flags.scan,
        ...(flags.maxDrift !== undefined ? { maxDrift: flags.maxDrift } : {}),
        ...(flags.config !== undefined ? { config: flags.config } : {}),
      };
      onExit(await commentsRunner(options, io));
    });

  const refactorRunner = deps.refactorRunner ?? runRefactor;
  program
    .command("refactor")
    .alias("rf")
    .description("Decide which files are worth refactoring, by cost and change rate (needs git).")
    .addHelpText(
      "after",
      "\nExamples:\n  $ clines refactor\n  $ clines refactor --since '6 months ago'\n  $ clines refactor --price 3\n",
    )
    .argument("[dir]", "directory to scan", ".")
    .option("--since <when>", "how far back to read git history", "2 years ago")
    .addOption(
      new Option("--sort <order>", "rank by re-read cost, lines changed, or recency")
        .choices(["cost", "churn", "recent"])
        .default("cost"),
    )
    .option("--explain", "add the churn, churn share and recency columns")
    .option("--include-bots", "count commits from bots and automation too")
    .option("--price <usd>", "price per million tokens, to cost the re-reads", parsePrice)
    .option(
      "--max-reread <n>",
      "exit 2 when any file has cost more than this many tokens to re-read",
      parseTokenCount,
    )
    .option("--top <n>", "files to list, or `all`", parseRowCount, 20)
    .option("--all", "include test, generated, vendored and docs files")
    .option("--json", "print the report as JSON on stdout")
    .option("--diff <ref>", "only report on files changed since this git ref")
    .option("--config <path>", "path to a config file")
    .action(async (dir: string, flags: RefactorFlags) => {
      const options: RefactorOptions = {
        dir,
        all: flags.all === true,
        json: flags.json === true,
        ...(flags.diff !== undefined ? { diff: flags.diff } : {}),
        version,
        since: flags.since,
        sort: flags.sort,
        explain: flags.explain === true,
        includeBots: flags.includeBots === true,
        ...(flags.maxReread !== undefined ? { maxReread: flags.maxReread } : {}),
        top: flags.top,
        ...(flags.price !== undefined ? { price: flags.price } : {}),
        ...(flags.config !== undefined ? { config: flags.config } : {}),
      };
      onExit(await refactorRunner(options, io));
    });

  const couplingRunner = deps.couplingRunner ?? runCoupling;
  program
    .command("coupling")
    .alias("co")
    .description(
      "Find files that keep changing together, revealing hidden dependencies (needs git).",
    )
    .addHelpText(
      "after",
      "\nExamples:\n  $ clines coupling\n  $ clines coupling --min-revisions 3 --min-shared 3\n  $ clines coupling --since '6 months ago'\n",
    )
    .argument("[dir]", "directory to scan", ".")
    .option("--since <when>", "how far back to read git history", "2 years ago")
    .option("--top <n>", "rows to list, or `all`", parseRowCount, 20)
    .option(
      "--min-revisions <n>",
      "ignore files changed fewer than this many times",
      parsePositiveInt,
      10,
    )
    .option("--min-shared <n>", "ignore pairs with fewer shared commits", parsePositiveInt, 10)
    .option("--min-strength <pct>", "ignore pairs weaker than this", parsePercentage, 50)
    .option(
      "--max-commit-size <n>",
      "ignore commits touching more files than this, which couple everything to everything",
      parsePositiveInt,
      30,
    )
    .option("--include-bots", "count commits from bots and automation too")
    .option("--json", "print the report as JSON on stdout")
    .option("--config <path>", "path to a config file")
    .action(async (dir: string, flags: CouplingFlags) => {
      const options: CouplingOptions = {
        dir,
        since: flags.since,
        top: flags.top,
        minRevisions: flags.minRevisions,
        minShared: flags.minShared,
        minStrength: flags.minStrength,
        maxCommitSize: flags.maxCommitSize,
        includeBots: flags.includeBots === true,
        json: flags.json === true,
        version,
        ...(flags.config !== undefined ? { config: flags.config } : {}),
      };
      onExit(await couplingRunner(options, io));
    });

  const agentRunner = deps.agentRunner ?? runAgent;
  program
    .command("agent")
    .alias("ai")
    .description("Rate how safe each file is to hand to an AI coding agent.")
    .addHelpText(
      "after",
      "\nExamples:\n  $ clines agent\n  $ clines agent --json\n  $ clines agent --diff main\n",
    )
    .argument("[dir]", "directory to scan", ".")
    .option("--top <n>", "files to list, or `all`", parseRowCount, 20)
    .option("--min-lines <n>", "clone size used for the duplication signal", parsePositiveInt, 5)
    .option("--all", "include test, generated, vendored and docs files")
    .option("--json", "print the report as JSON on stdout")
    .option("--diff <ref>", "only report on files changed since this git ref")
    .option("--config <path>", "path to a config file")
    .action(async (dir: string, flags: AgentFlags) => {
      const options: AgentOptions = {
        dir,
        top: flags.top,
        minLines: flags.minLines,
        all: flags.all === true,
        json: flags.json === true,
        ...(flags.diff !== undefined ? { diff: flags.diff } : {}),
        version,
        ...(flags.config !== undefined ? { config: flags.config } : {}),
      };
      onExit(await agentRunner(options, io));
    });

  return program;
}

export async function runCli(argv: string[], io: IO, deps: ProgramDeps = {}): Promise<number> {
  const version = deps.version ?? "0.0.0";
  const paged = !argv.includes("--no-pager") && !argv.includes("--json");
  const stripped = paged ? argv : argv.filter((arg) => arg !== "--no-pager");
  const args = stripped.slice(2);
  if (args.length === 0) {
    io.out(renderBanner(version));
    return 0;
  }

  // Before the pager: an MCP client reads responses as they are written.
  if (args[0] === "mcp") {
    if (args.includes("--help") || args.includes("-h")) {
      io.out(MCP_HELP);
      return 0;
    }
    return serveStdio(io, version, deps.mcpInput);
  }

  let exitCode = 0;
  const collected = collect(io);
  const program = buildProgram(collected.io, deps, (code) => {
    exitCode = Math.max(exitCode, code);
  });
  program.exitOverride();
  // -v is what people type; commander reserves -V. Only the global position is rewritten,
  // so a literal "-v" passed as an option value is untouched.
  const normalized =
    args[0] === "-v" ? [...stripped.slice(0, 2), "--version", ...args.slice(1)] : stripped;

  try {
    await program.parseAsync(normalized);
  } finally {
    await flush(collected.text(), io, { paged, ...deps.flush });
  }
  return exitCode;
}
