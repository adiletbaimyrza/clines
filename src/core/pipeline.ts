import type { Config } from "../config/schema.js";
import { readText } from "../util/fs.js";
import { linesAnalyzer } from "./analyzers/lines.js";
import { collectFiles } from "./files/collector.js";
import type { Report } from "./model.js";
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
