import path from "node:path";
import type { Config } from "../config/schema.js";
import { readText } from "../util/fs.js";
import { linesAnalyzer } from "./analyzers/lines.js";
import { detectDuplication, toDupFile, type DuplicationResult } from "./analyzers/duplication.js";
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
  Report,
  RoleSummary,
} from "./model.js";
import { getLanguageName, getLanguageSyntax } from "./tokenizer/languages.js";
import { classifyContent, splitLines, tokenize } from "./tokenizer/tokenizer.js";
import { estimateTokens } from "./tokenizer/tokens.js";

export interface AnalyzeOptions {
  attributes?: RoleAttributes;
  includeAll?: boolean;
}

export interface RoledFile {
  path: string;
  content: string;
  role: FileRole;
  code: number;
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
        code: kinds.filter((kind) => kind === "code").length,
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

function partition(
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
  const tokens = included.map((file) => tokenize(file.path, file.content));
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
    const tokens = tokenize(file.path, file.content);
    return {
      path: tokens.path,
      complexity: tokens.complexity,
      code: file.code,
      language: getLanguageName(tokens.ext),
    };
  });
  result.sort((a, b) => b.complexity - a.complexity || a.path.localeCompare(b.path));

  return { files: result, excluded };
}

function measureContext(file: RoledFile): FileContext {
  const ext = path.extname(file.path) || "no_ext";
  const lines = splitLines(file.content);
  const kinds = classifyContent(file.content, getLanguageSyntax(ext));

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
    excluded,
  };
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
  const dupFiles = included.map((file) => toDupFile(file.path, file.content));
  return { ...detectDuplication(dupFiles, minLines, minCopies), excluded };
}
