import path from "node:path";
import { loadConfig, loadGitAttributes, loadGitignoreGlobs } from "../config/load.js";
import type { Report } from "../core/model.js";
import {
  analyze,
  analyzeComplexity,
  analyzeContext,
  analyzeComments,
  analyzeDuplication,
  collectRoledFiles,
  partition,
  type AnalyzeOptions,
  type CommentOptions,
} from "../core/pipeline.js";
import { renderComplexity, renderComplexityHtml } from "../report/format/complexity.js";
import { renderComments } from "../report/format/comments.js";
import { renderContext, renderContextHtml } from "../report/format/context.js";
import { renderDuplication } from "../report/format/duplication.js";
import { renderDuplicationHtml } from "../report/format/duplication-html.js";
import { consoleReporter } from "../report/reporters/console.js";
import { injectReadme } from "../report/reporters/readme.js";
import { ClinesError } from "../util/errors.js";
import { pathExists, readText, writeText } from "../util/fs.js";
import { openInBrowser } from "../util/open.js";
import type { IO } from "./io.js";

export type Opener = (target: string) => void;

export interface RunOptions {
  dir: string;
  all?: boolean;
  readme: boolean;
  config?: string;
}

export interface DupOptions {
  dir: string;
  all?: boolean;
  top: number;
  minLines: number;
  minCopies: number;
  open: boolean;
  config?: string;
  html?: string;
}

export interface ComplexityOptions {
  dir: string;
  all?: boolean;
  sort: "raw" | "density";
  minLines: number;
  explain?: boolean;
  top: number;
  open: boolean;
  config?: string;
  html?: string;
}

export interface CommentsOptions {
  dir: string;
  all?: boolean;
  top: number;
  scan: number;
  years: number;
  config?: string;
}

export interface ContextOptions {
  dir: string;
  all?: boolean;
  window: number;
  budget: number;
  top: number;
  open: boolean;
  max?: number;
  config?: string;
  html?: string;
}

async function prepare(dir: string, configPath?: string, all?: boolean) {
  const rootDir = path.resolve(dir);
  if (!(await pathExists(rootDir))) {
    throw new ClinesError(`Directory not found: ${rootDir}`);
  }
  const config = await loadConfig(rootDir, configPath);
  const globs = await loadGitignoreGlobs(rootDir, config.respectGitignore);
  const options: AnalyzeOptions = {
    attributes: await loadGitAttributes(rootDir),
    includeAll: all === true,
  };
  return { rootDir, config, globs, options };
}

export async function run(options: RunOptions, io: IO): Promise<number> {
  const {
    rootDir,
    config,
    globs,
    options: opts,
  } = await prepare(options.dir, options.config, options.all);
  const report = await analyze(rootDir, config, globs, opts);

  io.out(consoleReporter.render(report));

  if (options.readme) {
    await updateReadme(rootDir, report, io);
  }

  return 0;
}

export async function runDup(
  options: DupOptions,
  io: IO,
  opener: Opener = openInBrowser,
): Promise<number> {
  const {
    rootDir,
    config,
    globs,
    options: opts,
  } = await prepare(options.dir, options.config, options.all);
  const result = await analyzeDuplication(
    rootDir,
    config,
    globs,
    options.minLines,
    options.minCopies,
    opts,
  );
  io.out(renderDuplication(result, options.top));

  if (options.html !== undefined) {
    const htmlPath = path.resolve(options.html);
    await writeText(htmlPath, renderDuplicationHtml(result));
    io.err(`Wrote duplication report to ${htmlPath}`);
    if (options.open) {
      opener(htmlPath);
    }
  }

  return 0;
}

export async function runComplexity(
  options: ComplexityOptions,
  io: IO,
  opener: Opener = openInBrowser,
): Promise<number> {
  const {
    rootDir,
    config,
    globs,
    options: opts,
  } = await prepare(options.dir, options.config, options.all);
  const result = await analyzeComplexity(rootDir, config, globs, opts);
  io.out(
    renderComplexity(result, {
      top: options.top,
      sort: options.sort,
      minLines: options.minLines,
      explain: options.explain === true,
    }),
  );

  if (options.html !== undefined) {
    const htmlPath = path.resolve(options.html);
    await writeText(htmlPath, renderComplexityHtml(result));
    io.err(`Wrote complexity report to ${htmlPath}`);
    if (options.open) {
      opener(htmlPath);
    }
  }

  return 0;
}

export async function runContext(
  options: ContextOptions,
  io: IO,
  opener: Opener = openInBrowser,
): Promise<number> {
  const {
    rootDir,
    config,
    globs,
    options: opts,
  } = await prepare(options.dir, options.config, options.all);
  const result = await analyzeContext(rootDir, config, globs, opts);
  io.out(renderContext(result, options.window, options.budget, options.top));

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
    throw new ClinesError(
      `Context budget exceeded: ${result.totalTokens.toLocaleString("en-US")} tokens > ${options.max.toLocaleString("en-US")}`,
    );
  }

  return 0;
}

export async function runComments(
  options: CommentsOptions,
  io: IO,
  commentOptions: CommentOptions = {},
): Promise<number> {
  const {
    rootDir,
    config,
    globs,
    options: opts,
  } = await prepare(options.dir, options.config, options.all);
  const collected = await collectRoledFiles(rootDir, config, globs, opts);
  const { included } = partition(collected, opts.includeAll === true);
  const candidates = Math.min(options.scan, included.filter((file) => file.comments > 0).length);
  if (candidates > 0) {
    io.err(`Blaming ${candidates.toLocaleString("en-US")} files with git…`);
  }
  const outcome = await analyzeComments(rootDir, included, {
    years: options.years,
    maxFiles: options.scan,
    ...commentOptions,
  });

  io.out(renderComments(outcome, options.top));
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
