import path from "node:path";
import type { Config } from "../config/schema.js";
import { readText } from "../util/fs.js";
import { blameFile, type Blamer } from "../util/git.js";
import {
  measureDrift,
  summarizeDrift,
  type CommentOutcome,
  type FileDrift,
} from "./analyzers/comments.js";
import { linesAnalyzer } from "./analyzers/lines.js";
import {
  detectDuplication,
  normalizeRenamed,
  toDupFile,
  type DuplicationResult,
} from "./analyzers/duplication.js";
import { collectFiles } from "./files/collector.js";
import {
  classifyRole,
  emptyRoleAttributes,
  FILE_ROLES,
  HEAD_BYTES,
  type FileRole,
  type RoleAttributes,
} from "./files/roles.js";
import type {
  ComplexityResult,
  ContextResult,
  DirContext,
  Exclusions,
  FileContext,
  Navigability,
  LineKind,
  Report,
  RoleSummary,
} from "./model.js";
import { getComplexityChecks, getLanguageName, getLanguageSyntax } from "./tokenizer/languages.js";
import {
  classifyContent,
  measureComplexity,
  sanitizeCode,
  splitLines,
  tokenize,
} from "./tokenizer/tokenizer.js";
import { estimateTokens } from "./tokenizer/tokens.js";

export interface AnalyzeOptions {
  attributes?: RoleAttributes;
  includeAll?: boolean;
  crossFileOnly?: boolean;
  renamed?: boolean;
}

export interface CommentOptions {
  years?: number;
  maxFiles?: number;
  blamer?: Blamer;
}

const SECONDS_PER_YEAR = 365 * 24 * 60 * 60;
const DEFAULT_COMMENT_FILES = 50;

export interface RoledFile {
  path: string;
  content: string;
  role: FileRole;
  kinds: LineKind[];
  code: number;
  comments: number;
}

export async function collectRoledFiles(
  rootDir: string,
  config: Config,
  extraGlobs: string[],
  options: AnalyzeOptions,
): Promise<RoledFile[]> {
  const attributes = options.attributes ?? emptyRoleAttributes();
  const collected = await collectFiles(rootDir, config, extraGlobs);

  return Promise.all(
    collected.map(async (file) => {
      const relativePath = path.relative(rootDir, file);
      const content = await readText(file);
      const ext = path.extname(relativePath) || "no_ext";
      const kinds = classifyContent(content, getLanguageSyntax(ext));
      return {
        path: relativePath,
        content,
        role: classifyRole(relativePath, content.slice(0, HEAD_BYTES), config.roles, attributes),
        kinds,
        code: kinds.filter((kind) => kind === "code").length,
        comments: kinds.filter((kind) => kind === "comment").length,
      };
    }),
  );
}

export function summarizeRoles(files: RoledFile[]): RoleSummary[] {
  return FILE_ROLES.map((role) => {
    const matching = files.filter((file) => file.role === role);
    return { role, files: matching.length, code: matching.reduce((sum, f) => sum + f.code, 0) };
  }).filter((summary) => summary.files > 0);
}

export function partition(
  files: RoledFile[],
  includeAll: boolean,
): { included: RoledFile[]; excluded: Exclusions } {
  if (includeAll) {
    return { included: files, excluded: { files: 0, roles: [] } };
  }
  const included = files.filter((file) => file.role === "source");
  const rest = files.filter((file) => file.role !== "source");
  return { included, excluded: { files: rest.length, roles: summarizeRoles(rest) } };
}

export async function analyze(
  rootDir: string,
  config: Config,
  extraGlobs: string[] = [],
  options: AnalyzeOptions = {},
): Promise<Report> {
  const files = await collectRoledFiles(rootDir, config, extraGlobs, options);
  const { included } = partition(files, options.includeAll === true);
  const tokens = included.map((file) => tokenize(file.path, file.content, file.kinds));
  return { ...linesAnalyzer.analyze(tokens), roles: summarizeRoles(files) };
}

export async function analyzeComplexity(
  rootDir: string,
  config: Config,
  extraGlobs: string[] = [],
  options: AnalyzeOptions = {},
): Promise<ComplexityResult> {
  const files = await collectRoledFiles(rootDir, config, extraGlobs, options);
  const { included, excluded } = partition(files, options.includeAll === true);

  const result = included.map((file) => {
    const ext = path.extname(file.path) || "no_ext";
    const detail = measureComplexity(
      sanitizeCode(file.content, getLanguageSyntax(ext)),
      getComplexityChecks(ext),
    );
    return {
      path: file.path,
      complexity: detail.total,
      code: file.code,
      language: getLanguageName(ext),
      density: file.code === 0 ? 0 : (detail.total / file.code) * 100,
      concentration: detail.total === 0 ? 0 : (detail.densest / detail.total) * 100,
      branch: detail.branch,
      loop: detail.loop,
      bool: detail.bool,
    };
  });
  result.sort((a, b) => b.complexity - a.complexity || a.path.localeCompare(b.path));

  return { files: result, excluded };
}

function measureContext(file: RoledFile): FileContext {
  const ext = path.extname(file.path) || "no_ext";
  const lines = splitLines(file.content);
  const kinds = file.kinds;

  let codeTokens = 0;
  let commentTokens = 0;
  for (let i = 0; i < lines.length; i++) {
    const tokens = estimateTokens(lines[i] as string) + 1;
    if (kinds[i] === "comment") {
      commentTokens += tokens;
    } else {
      codeTokens += tokens;
    }
  }

  return {
    path: file.path,
    language: getLanguageName(ext),
    tokens: codeTokens + commentTokens,
    codeTokens,
    commentTokens,
    lines: lines.length,
  };
}

function rollUpDirs(files: FileContext[]): DirContext[] {
  const totals = new Map<string, DirContext>();
  for (const file of files) {
    const segments = file.path.split(path.sep);
    const dir = segments.length > 1 ? (segments[0] as string) : ".";
    const entry = totals.get(dir);
    if (entry) {
      entry.tokens += file.tokens;
      entry.files += 1;
    } else {
      totals.set(dir, { dir, tokens: file.tokens, files: 1 });
    }
  }
  return [...totals.values()].sort((a, b) => b.tokens - a.tokens || a.dir.localeCompare(b.dir));
}

function measureNavigability(files: FileContext[]): Navigability {
  const counts = new Map<string, number>();
  const depths: number[] = [];

  for (const file of files) {
    const segments = file.path.split(path.sep);
    depths.push(segments.length);
    const base = segments[segments.length - 1] as string;
    counts.set(base, (counts.get(base) ?? 0) + 1);
  }

  const repeated = [...counts.entries()].filter(([, count]) => count > 1);
  const worstNames = repeated
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, 3);

  depths.sort((a, b) => a - b);

  return {
    files: files.length,
    ambiguousFiles: repeated.reduce((sum, [, count]) => sum + count, 0),
    worstNames,
    medianDepth: depths.length === 0 ? 0 : (depths[Math.floor(depths.length / 2)] as number),
    maxDepth: depths.length === 0 ? 0 : (depths[depths.length - 1] as number),
  };
}

export async function analyzeContext(
  rootDir: string,
  config: Config,
  extraGlobs: string[] = [],
  options: AnalyzeOptions = {},
): Promise<ContextResult> {
  const collected = await collectRoledFiles(rootDir, config, extraGlobs, options);
  const { included, excluded } = partition(collected, options.includeAll === true);

  const files = included.map(measureContext);
  files.sort((a, b) => b.tokens - a.tokens || a.path.localeCompare(b.path));

  return {
    files,
    dirs: rollUpDirs(files),
    totalTokens: files.reduce((sum, file) => sum + file.tokens, 0),
    codeTokens: files.reduce((sum, file) => sum + file.codeTokens, 0),
    commentTokens: files.reduce((sum, file) => sum + file.commentTokens, 0),
    navigability: measureNavigability(files),
    excluded,
  };
}

export interface CloneChurn {
  path: string;
  lastChange: number;
}

export async function analyzeCloneChurn(
  rootDir: string,
  files: string[],
  blamer: Blamer = blameFile,
): Promise<Map<string, number>> {
  const ages = new Map<string, number>();
  for (const file of files) {
    const times = await blamer(rootDir, file);
    if (times !== undefined && times.length > 0) {
      ages.set(file, Math.max(...times));
    }
  }
  return ages;
}

export async function analyzeComments(
  rootDir: string,
  files: RoledFile[],
  options: CommentOptions = {},
): Promise<CommentOutcome> {
  const years = options.years ?? 3;
  const blamer = options.blamer ?? blameFile;
  const candidates = [...files]
    .filter((file) => file.comments > 0)
    .sort((a, b) => b.comments - a.comments || a.path.localeCompare(b.path))
    .slice(0, options.maxFiles ?? DEFAULT_COMMENT_FILES);

  const drifts: FileDrift[] = [];
  for (const file of candidates) {
    const times = await blamer(rootDir, file.path);
    if (times === undefined) {
      continue;
    }
    const { blocks, drifted } = measureDrift(file.kinds, times, years * SECONDS_PER_YEAR);
    drifts.push({ path: file.path, blocks, drifted });
  }

  if (candidates.length === 0) {
    return { status: "no-comments" };
  }
  if (drifts.length === 0) {
    return { status: "unavailable" };
  }
  return { status: "ok", health: summarizeDrift(drifts, years) };
}

export async function analyzeDuplication(
  rootDir: string,
  config: Config,
  extraGlobs: string[],
  minLines: number,
  minCopies: number,
  options: AnalyzeOptions = {},
): Promise<DuplicationResult> {
  const collected = await collectRoledFiles(rootDir, config, extraGlobs, options);
  const { included, excluded } = partition(collected, options.includeAll === true);
  const dupFiles = included.map((file) => toDupFile(file.path, file.content, file.kinds));
  const exact = detectDuplication(dupFiles, minLines, minCopies, {
    ...(options.crossFileOnly === true ? { crossFileOnly: true } : {}),
  });

  const renamed =
    options.renamed === true
      ? detectDuplication(dupFiles, minLines, minCopies, {
          normalizer: normalizeRenamed,
          ...(options.crossFileOnly === true ? { crossFileOnly: true } : {}),
        }).clones.length
      : 0;

  return { ...exact, renamedGroups: Math.max(0, renamed - exact.clones.length), excluded };
}
