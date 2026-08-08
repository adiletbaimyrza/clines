import path from "node:path";
import type { Config } from "../config/schema.js";
import { readText } from "../util/fs.js";
import { linesAnalyzer } from "./analyzers/lines.js";
import { detectDuplication, toDupFile, type DuplicationResult } from "./analyzers/duplication.js";
import { collectFiles } from "./files/collector.js";
import type { ContextResult, DirContext, FileComplexity, FileContext, Report } from "./model.js";
import { getLanguageName, getLanguageSyntax } from "./tokenizer/languages.js";
import { classifyContent, splitLines, tokenize } from "./tokenizer/tokenizer.js";
import { estimateTokens } from "./tokenizer/tokens.js";

export async function analyze(
  rootDir: string,
  config: Config,
  extraGlobs: string[] = [],
): Promise<Report> {
  const files = await collectFiles(rootDir, config, extraGlobs);
  const tokens = await Promise.all(files.map(async (file) => tokenize(file, await readText(file))));
  return linesAnalyzer.analyze(tokens);
}

export async function analyzeComplexity(
  rootDir: string,
  config: Config,
  extraGlobs: string[] = [],
): Promise<FileComplexity[]> {
  const files = await collectFiles(rootDir, config, extraGlobs);
  const result = await Promise.all(
    files.map(async (file) => {
      const tokens = tokenize(path.relative(rootDir, file), await readText(file));
      return {
        path: tokens.path,
        complexity: tokens.complexity,
        code: tokens.lineKinds.filter((kind) => kind === "code").length,
        language: getLanguageName(tokens.ext),
      };
    }),
  );
  result.sort((a, b) => b.complexity - a.complexity || a.path.localeCompare(b.path));
  return result;
}

function measureContext(relativePath: string, content: string): FileContext {
  const ext = path.extname(relativePath) || "no_ext";
  const lines = splitLines(content);
  const kinds = classifyContent(content, getLanguageSyntax(ext));

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
    path: relativePath,
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
): Promise<ContextResult> {
  const collected = await collectFiles(rootDir, config, extraGlobs);
  const files = await Promise.all(
    collected.map(async (file) =>
      measureContext(path.relative(rootDir, file), await readText(file)),
    ),
  );
  files.sort((a, b) => b.tokens - a.tokens || a.path.localeCompare(b.path));

  return {
    files,
    dirs: rollUpDirs(files),
    totalTokens: files.reduce((sum, file) => sum + file.tokens, 0),
    codeTokens: files.reduce((sum, file) => sum + file.codeTokens, 0),
    commentTokens: files.reduce((sum, file) => sum + file.commentTokens, 0),
  };
}

export async function analyzeDuplication(
  rootDir: string,
  config: Config,
  extraGlobs: string[],
  minLines: number,
  minCopies: number,
): Promise<DuplicationResult> {
  const files = await collectFiles(rootDir, config, extraGlobs);
  const dupFiles = await Promise.all(
    files.map(async (file) => toDupFile(path.relative(rootDir, file), await readText(file))),
  );
  return detectDuplication(dupFiles, minLines, minCopies);
}
