import path from "node:path";
import type { Config } from "../config/schema.js";
import { readText } from "../util/fs.js";
import { linesAnalyzer } from "./analyzers/lines.js";
import { detectDuplication, toDupFile, type DuplicationResult } from "./analyzers/duplication.js";
import { collectFiles } from "./files/collector.js";
import type { FileComplexity, Report } from "./model.js";
import { getLanguageName } from "./tokenizer/languages.js";
import { tokenize } from "./tokenizer/tokenizer.js";

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
