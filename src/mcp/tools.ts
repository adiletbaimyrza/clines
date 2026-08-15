import { prepare, type CommonOptions } from "../cli/run.js";
import type { IO } from "../cli/io.js";
import {
  analyze,
  analyzeAgent,
  analyzeComments,
  analyzeCoupling,
  analyzeComplexity,
  analyzeContext,
  analyzeDuplication,
  analyzeRefactor,
  collectRoledFiles,
  partition,
} from "../core/pipeline.js";
import { budgetTiers, DEFAULT_BUDGET, DEFAULT_WINDOW } from "../report/format/context.js";

// An agent pays for every token it reads back; the CLI's --json stays complete.
export const DEFAULT_TOP = 20;

const DUP_MIN_LINES = 5;
const DUP_MIN_COPIES = 2;

export interface ToolArgs {
  dir?: string;
  all?: boolean;
  top?: number;
  diff?: string;
}

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

const SHARED_PROPERTIES = {
  dir: { type: "string", description: "Directory to analyse. Defaults to the working directory." },
  all: {
    type: "boolean",
    description: "Include test, generated, vendored and docs files. Defaults to false.",
  },
  top: {
    type: "number",
    description: `How many rows to return. Defaults to ${DEFAULT_TOP}.`,
  },
  diff: {
    type: "string",
    description: "Only report on files changed since this git ref, e.g. 'main'.",
  },
};

function schema(): Record<string, unknown> {
  return { type: "object", properties: SHARED_PROPERTIES };
}

export const TOOLS: ToolDefinition[] = [
  {
    name: "clines_count",
    description:
      "Count lines of code, comments and blanks per language, with the size distribution of the codebase.",
    inputSchema: schema(),
  },
  {
    name: "clines_ctx",
    description:
      "Estimate how many tokens this codebase costs a language model to read, per file and per top-level directory. Use this to judge whether a repository fits a context window.",
    inputSchema: schema(),
  },
  {
    name: "clines_cx",
    description:
      "Rank files by decision-point complexity, with complexity per 100 lines so size and difficulty are separable.",
    inputSchema: schema(),
  },
  {
    name: "clines_dup",
    description:
      "Find duplicated code blocks and rank them by how many lines deduplicating would remove.",
    inputSchema: schema(),
  },
  {
    name: "clines_refactor",
    description:
      "Decide which files are worth refactoring by weighing complexity against how often each file changes. Needs git history.",
    inputSchema: schema(),
  },
  {
    name: "clines_coupling",
    description:
      "Find files that keep changing together in git history, which reveals logical dependencies static analysis cannot see. Use this to explain why a file is expensive rather than merely busy. Needs git history.",
    inputSchema: schema(),
  },
  {
    name: "clines_agent",
    description:
      "Rate how safe each file is for an AI coding agent to modify unattended, from complexity density, size and duplication. Use this to decide where to read the diff carefully.",
    inputSchema: schema(),
  },
  {
    name: "clines_comments",
    description:
      "Find comments the code beneath them has drifted away from, using git blame. Needs git history.",
    inputSchema: schema(),
  },
];

function flagsFor(args: ToolArgs): CommonOptions {
  return {
    dir: args.dir ?? ".",
    all: args.all === true,
    ...(args.diff !== undefined ? { diff: args.diff } : {}),
  };
}

export async function callTool(name: string, args: ToolArgs, io: IO): Promise<unknown> {
  const flags = flagsFor(args);
  const top = Math.max(1, Math.trunc(args.top ?? DEFAULT_TOP));
  const { rootDir, config, globs, options } = await prepare(flags, io);

  if (name === "clines_count") {
    return analyze(rootDir, config, globs, options);
  }

  if (name === "clines_ctx") {
    const result = await analyzeContext(rootDir, config, globs, options);
    return {
      totalTokens: result.totalTokens,
      codeTokens: result.codeTokens,
      commentTokens: result.commentTokens,
      window: DEFAULT_WINDOW,
      tiers: budgetTiers(result, DEFAULT_BUDGET),
      dirs: result.dirs.slice(0, top),
      files: result.files.slice(0, top),
      totalFiles: result.files.length,
    };
  }

  if (name === "clines_cx") {
    const result = await analyzeComplexity(rootDir, config, globs, options);
    return { files: result.files.slice(0, top), totalFiles: result.files.length };
  }

  if (name === "clines_dup") {
    const result = await analyzeDuplication(
      rootDir,
      config,
      globs,
      DUP_MIN_LINES,
      DUP_MIN_COPIES,
      options,
    );
    return {
      percentage: result.percentage,
      duplicatedLines: result.duplicatedLines,
      totalLines: result.totalLines,
      shape: result.shape,
      ranked: result.ranked.slice(0, top),
      perFile: result.perFile.slice(0, top),
    };
  }

  if (name === "clines_refactor") {
    const report = await analyzeRefactor(rootDir, config, globs, options);
    if (report === undefined) {
      return { unavailable: "no-git" };
    }
    return {
      since: report.since,
      commits: report.commits,
      measured: report.measured,
      limits: report.limits,
      verdicts: report.verdicts,
      candidates: report.candidates.filter((file) => file.changes > 0).slice(0, top),
    };
  }

  if (name === "clines_coupling") {
    const result = await analyzeCoupling(rootDir);
    if (result === undefined) {
      return { unavailable: "no-git" };
    }
    return {
      commits: result.commits,
      skipped: result.skipped,
      limits: result.limits,
      pairs: result.pairs.slice(0, top),
      totalPairs: result.pairs.length,
      files: result.files.slice(0, top),
    };
  }

  if (name === "clines_agent") {
    const report = await analyzeAgent(rootDir, config, globs, options);
    return {
      measured: report.measured,
      limits: report.limits,
      verdicts: report.verdicts,
      candidates: report.candidates.filter((file) => file.risks.length > 0).slice(0, top),
    };
  }

  const collected = await collectRoledFiles(rootDir, config, globs, options);
  const { included } = partition(collected, options.includeAll === true, options.only);
  const outcome = await analyzeComments(rootDir, included, { maxFiles: top });
  return outcome.status === "ok" ? outcome.health : { unavailable: outcome.status };
}

export function isTool(name: string): boolean {
  return TOOLS.some((tool) => tool.name === name);
}
