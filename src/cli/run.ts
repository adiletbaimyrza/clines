import path from "node:path";
import { loadConfig, loadGitAttributes, loadGitignoreGlobs } from "../config/load.js";
import type { FileComplexity, Report } from "../core/model.js";
import {
  analyze,
  analyzeComplexity,
  analyzeContext,
  analyzeComments,
  analyzeCloneChurn,
  analyzeDuplication,
  analyzeAgent as analyzeAgentIn,
  analyzeCoupling as analyzeCouplingIn,
  analyzeRefactor,
  collectRoledFiles,
  partition,
  type AnalyzeOptions,
  type CommentOptions,
} from "../core/pipeline.js";
import {
  rankComplexity,
  renderComplexity,
  renderComplexityHtml,
} from "../report/format/complexity.js";
import { renderAgent } from "../report/format/agent.js";
import { renderComments } from "../report/format/comments.js";
import { renderCoupling } from "../report/format/coupling.js";
import { renderRefactor, type RefactorSort } from "../report/format/refactor.js";
import { renderContext, renderContextHtml } from "../report/format/context.js";
import { renderDuplication, renderDuplicationInsight } from "../report/format/duplication.js";
import { renderDuplicationHtml } from "../report/format/duplication-html.js";
import {
  renderAgentJson,
  renderCommentsJson,
  renderComplexityJson,
  renderContextJson,
  renderCountJson,
  renderCouplingJson,
  renderDuplicationJson,
  renderRefactorJson,
  type JsonMeta,
} from "../report/format/json.js";
import { consoleReporter } from "../report/reporters/console.js";
import { injectReadme } from "../report/reporters/readme.js";
import { ClinesError } from "../util/errors.js";
import {
  changedFiles,
  repoState,
  SHALLOW_WARNING,
  type ChangeReader,
  type DiffReader,
  type StateReader,
} from "../util/git.js";
import { pathExists, readText, writeText } from "../util/fs.js";
import { openInBrowser } from "../util/open.js";
import { serve } from "../mcp/server.js";
import type { IO } from "./io.js";

export type Opener = (target: string) => void;

export interface CommonOptions {
  dir: string;
  all?: boolean;
  json?: boolean;
  config?: string;
  version?: string;
  diff?: string;
  diffReader?: DiffReader;
  stateReader?: StateReader;
}

export interface RunOptions extends CommonOptions {
  distribution?: boolean;
  readme: boolean;
}

export interface DupOptions extends CommonOptions {
  crossFile?: boolean;
  maxDuplication?: number;
  renamed?: boolean;
  churn?: boolean;
  top: number;
  minLines: number;
  minCopies: number;
  open: boolean;
  html?: string;
}

export interface ComplexityOptions extends CommonOptions {
  sort: "raw" | "density";
  maxDensity?: number;
  minLines: number;
  explain?: boolean;
  top: number;
  open: boolean;
  html?: string;
}

export interface CommentsOptions extends CommonOptions {
  maxDrift?: number;
  top: number;
  scan: number;
  years: number;
}

export interface RefactorOptions extends CommonOptions {
  maxReread?: number;
  since: string;
  sort?: RefactorSort;
  explain?: boolean;
  includeBots?: boolean;
  top: number;
  price?: number;
}

export interface AgentOptions extends CommonOptions {
  top: number;
  minLines: number;
}

export interface CouplingOptions extends CommonOptions {
  since: string;
  top: number;
  minRevisions: number;
  minShared: number;
  minStrength: number;
  maxCommitSize: number;
  includeBots?: boolean;
}

export interface ContextOptions extends CommonOptions {
  window: number;
  budget: number;
  top: number;
  open: boolean;
  max?: number;
  html?: string;
}

// 2 = threshold breached, so a pipeline can tell it from an error.
export const GATE_EXIT = 2;

function breach(io: IO, message: string): number {
  io.err(message);
  return GATE_EXIT;
}

function count(value: number): string {
  return value.toLocaleString("en-US");
}

function percent(value: number): string {
  return `${value.toFixed(1)}%`;
}

function meta(rootDir: string, options: CommonOptions): JsonMeta {
  return { root: rootDir, ...(options.version !== undefined ? { version: options.version } : {}) };
}

const FULL_HISTORY_HINT =
  "In CI, check out the full history (actions/checkout with `fetch-depth: 0`).";

export async function prepare(flags: CommonOptions, io: IO) {
  const rootDir = path.resolve(flags.dir);
  if (!(await pathExists(rootDir))) {
    throw new ClinesError(`Directory not found: ${rootDir}`);
  }
  const config = await loadConfig(rootDir, flags.config);
  const globs = await loadGitignoreGlobs(rootDir, config.respectGitignore);
  const options: AnalyzeOptions = {
    attributes: await loadGitAttributes(rootDir),
    includeAll: flags.all === true,
  };

  if (flags.diff !== undefined) {
    const changed = await (flags.diffReader ?? changedFiles)(rootDir, flags.diff);
    if (changed === undefined) {
      throw new ClinesError(
        `Cannot diff against ${flags.diff}: git could not resolve it here. ${FULL_HISTORY_HINT}`,
      );
    }
    // git reports posix paths; the analysers key on path.relative.
    options.only = new Set(changed.map((name) => path.normalize(name)));
    io.err(`Diff vs ${flags.diff}: ${count(changed.length)} changed ${plural(changed.length)}`);
  }

  return { rootDir, config, globs, options };
}

function plural(files: number): string {
  return files === 1 ? "file" : "files";
}

async function warnIfShallow(rootDir: string, flags: CommonOptions, io: IO): Promise<void> {
  if ((await (flags.stateReader ?? repoState)(rootDir)) === "shallow") {
    io.err(SHALLOW_WARNING);
  }
}

export async function run(options: RunOptions, io: IO): Promise<number> {
  if (options.readme && options.diff !== undefined) {
    throw new ClinesError(
      "--readme writes a project-wide summary, so it cannot be combined with --diff.",
    );
  }
  const { rootDir, config, globs, options: opts } = await prepare(options, io);
  const report = await analyze(rootDir, config, globs, opts);

  if (options.json === true) {
    io.out(renderCountJson(report, meta(rootDir, options)));
  } else {
    io.out(consoleReporter.render(report, options.distribution === true));
  }

  if (options.readme) {
    await updateReadme(rootDir, report, io);
  }

  return 0;
}

export async function runDup(
  options: DupOptions,
  io: IO,
  opener: Opener = openInBrowser,
  commentOptions: CommentOptions = {},
): Promise<number> {
  const { rootDir, config, globs, options: opts } = await prepare(options, io);
  const result = await analyzeDuplication(
    rootDir,
    config,
    globs,
    options.minLines,
    options.minCopies,
    {
      ...opts,
      ...(options.crossFile === true ? { crossFileOnly: true } : {}),
      ...(options.renamed === true ? { renamed: true } : {}),
    },
  );

  let churn: Map<string, number> | undefined;
  if (options.churn === true) {
    const files = [...new Set(result.ranked.slice(0, options.top).flatMap((c) => c.files))];
    io.err(`Blaming ${files.length.toLocaleString("en-US")} files with git…`);
    churn = await analyzeCloneChurn(rootDir, files, commentOptions.blamer);
  }

  if (options.json === true) {
    io.out(renderDuplicationJson(result, meta(rootDir, options), churn));
  } else {
    const insight = renderDuplicationInsight(result, options.top, churn);
    if (insight.length > 0) {
      io.out(insight.join("\n"));
      io.out("");
    }
    io.out(renderDuplication(result, options.top));
  }

  if (options.html !== undefined) {
    const htmlPath = path.resolve(options.html);
    await writeText(htmlPath, renderDuplicationHtml(result));
    io.err(`Wrote duplication report to ${htmlPath}`);
    if (options.open) {
      opener(htmlPath);
    }
  }

  if (options.maxDuplication !== undefined && result.percentage > options.maxDuplication) {
    return breach(
      io,
      `Duplication exceeded: ${percent(result.percentage)} > ${percent(options.maxDuplication)} (--max-duplication)`,
    );
  }

  return 0;
}

export async function runComplexity(
  options: ComplexityOptions,
  io: IO,
  opener: Opener = openInBrowser,
): Promise<number> {
  const { rootDir, config, globs, options: opts } = await prepare(options, io);
  const result = await analyzeComplexity(rootDir, config, globs, opts);
  if (options.json === true) {
    io.out(
      renderComplexityJson(result, meta(rootDir, options), {
        sort: options.sort,
        minLines: options.minLines,
      }),
    );
  } else {
    io.out(
      renderComplexity(result, {
        top: options.top,
        sort: options.sort,
        minLines: options.minLines,
        explain: options.explain === true,
      }),
    );
  }

  if (options.html !== undefined) {
    const htmlPath = path.resolve(options.html);
    await writeText(htmlPath, renderComplexityHtml(result));
    io.err(`Wrote complexity report to ${htmlPath}`);
    if (options.open) {
      opener(htmlPath);
    }
  }

  if (options.maxDensity !== undefined) {
    const worst = rankComplexity(result.files, options.sort, options.minLines).reduce<
      FileComplexity | undefined
    >((top, file) => (top === undefined || file.density > top.density ? file : top), undefined);
    if (worst !== undefined && worst.density > options.maxDensity) {
      return breach(
        io,
        `Complexity density exceeded: ${worst.density.toFixed(1)} > ${options.maxDensity.toFixed(1)} in ${worst.path} (--max-density)`,
      );
    }
  }

  return 0;
}

export async function runContext(
  options: ContextOptions,
  io: IO,
  opener: Opener = openInBrowser,
): Promise<number> {
  const { rootDir, config, globs, options: opts } = await prepare(options, io);
  const result = await analyzeContext(rootDir, config, globs, opts);
  if (options.json === true) {
    io.out(
      renderContextJson(result, meta(rootDir, options), {
        window: options.window,
        budget: options.budget,
      }),
    );
  } else {
    io.out(renderContext(result, options.window, options.budget, options.top));
  }

  if (options.html !== undefined) {
    const htmlPath = path.resolve(options.html);
    await writeText(
      htmlPath,
      renderContextHtml(result, { window: options.window, budget: options.budget }),
    );
    io.err(`Wrote context report to ${htmlPath}`);
    if (options.open) {
      opener(htmlPath);
    }
  }

  if (options.max !== undefined && result.totalTokens > options.max) {
    return breach(
      io,
      `Context budget exceeded: ${count(result.totalTokens)} tokens > ${count(options.max)} (--max)`,
    );
  }

  return 0;
}

export async function runRefactor(
  options: RefactorOptions,
  io: IO,
  reader?: ChangeReader,
): Promise<number> {
  const { rootDir, config, globs, options: opts } = await prepare(options, io);
  await warnIfShallow(rootDir, options, io);
  io.err(`Reading git history since ${options.since}…`);
  const report = await analyzeRefactor(rootDir, config, globs, {
    ...opts,
    since: options.since,
    ...(options.includeBots === true ? { includeBots: true } : {}),
    ...(reader !== undefined ? { reader } : {}),
  });

  if (options.json === true) {
    io.out(renderRefactorJson(report, meta(rootDir, options)));
  } else {
    io.out(
      renderRefactor(report, {
        top: options.top,
        sort: options.sort ?? "cost",
        explain: options.explain === true,
        ...(options.price !== undefined ? { price: options.price } : {}),
      }),
    );
  }

  const worst = report?.candidates[0];
  if (
    options.maxReread !== undefined &&
    worst !== undefined &&
    worst.recurringTokens > options.maxReread
  ) {
    return breach(
      io,
      `Re-read cost exceeded: ${count(worst.recurringTokens)} tokens > ${count(options.maxReread)} in ${worst.path} (--max-reread)`,
    );
  }
  return 0;
}

export async function runComments(
  options: CommentsOptions,
  io: IO,
  commentOptions: CommentOptions = {},
): Promise<number> {
  const { rootDir, config, globs, options: opts } = await prepare(options, io);
  await warnIfShallow(rootDir, options, io);
  const collected = await collectRoledFiles(rootDir, config, globs, opts);
  const { included } = partition(collected, opts.includeAll === true, opts.only);
  const candidates = Math.min(options.scan, included.filter((file) => file.comments > 0).length);
  if (candidates > 0) {
    io.err(`Blaming ${candidates.toLocaleString("en-US")} files with git…`);
  }
  const outcome = await analyzeComments(rootDir, included, {
    years: options.years,
    maxFiles: options.scan,
    ...commentOptions,
  });

  if (options.json === true) {
    io.out(renderCommentsJson(outcome, meta(rootDir, options)));
  } else {
    io.out(renderComments(outcome, options.top));
  }

  if (options.maxDrift !== undefined && outcome.status === "ok" && outcome.health.blocks > 0) {
    const drift = (outcome.health.drifted / outcome.health.blocks) * 100;
    if (drift > options.maxDrift) {
      return breach(
        io,
        `Comment drift exceeded: ${percent(drift)} > ${percent(options.maxDrift)} (--max-drift)`,
      );
    }
  }
  return 0;
}

// stdout belongs to the protocol.
export async function runMcp(
  io: IO,
  version: string,
  lines: AsyncIterable<string>,
): Promise<number> {
  const quiet: IO = { out: io.err, err: io.err };
  await serve(lines, (line) => io.out(line), { version, io: quiet });
  return 0;
}

export async function runAgent(options: AgentOptions, io: IO): Promise<number> {
  const { rootDir, config, globs, options: opts } = await prepare(options, io);
  const report = await analyzeAgentIn(rootDir, config, globs, opts, options.minLines);

  if (options.json === true) {
    io.out(renderAgentJson(report, meta(rootDir, options)));
  } else {
    io.out(renderAgent(report, options.top));
  }
  return 0;
}

export async function runCoupling(
  options: CouplingOptions,
  io: IO,
  reader?: ChangeReader,
): Promise<number> {
  const { rootDir } = await prepare(options, io);
  await warnIfShallow(rootDir, options, io);
  io.err(`Reading git history since ${options.since}…`);
  const result = await analyzeCouplingIn(rootDir, {
    since: options.since,
    ...(options.includeBots === true ? { includeBots: true } : {}),
    ...(reader !== undefined ? { reader } : {}),
    limits: {
      minRevisions: options.minRevisions,
      minShared: options.minShared,
      minStrength: options.minStrength,
      maxCommitSize: options.maxCommitSize,
    },
  });

  if (options.json === true) {
    io.out(renderCouplingJson(result, meta(rootDir, options)));
  } else {
    io.out(
      result === undefined
        ? "Change coupling needs git history, and none is available here."
        : renderCoupling(result, options.top),
    );
  }
  return 0;
}

async function updateReadme(rootDir: string, report: Report, io: IO): Promise<void> {
  const readmePath = path.join(rootDir, "README.md");
  if (!(await pathExists(readmePath))) {
    io.err(`README.md not found in ${rootDir}, skipping update`);
    return;
  }
  const content = await readText(readmePath);
  await writeText(readmePath, injectReadme(content, report));
  io.err(`Updated ${readmePath}`);
}
