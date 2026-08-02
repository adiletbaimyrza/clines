import path from "node:path";
import type { Config } from "../../config/schema.js";
import { readEntries } from "../../util/fs.js";
import { isIgnoredDir, isIgnoredFile } from "./matcher.js";

export async function collectFiles(
  rootDir: string,
  config: Config,
  extraGlobs: string[] = [],
): Promise<string[]> {
  const results: string[] = [];

  async function walk(absoluteDir: string): Promise<void> {
    const entries = await readEntries(absoluteDir);
    for (const entry of entries) {
      const absolute = path.join(absoluteDir, entry.name);
      if (entry.isDirectory()) {
        if (!isIgnoredDir(entry.name, config)) {
          await walk(absolute);
        }
      } else if (entry.isFile()) {
        const relative = path.relative(rootDir, absolute);
        if (!isIgnoredFile(relative, config, extraGlobs)) {
          results.push(absolute);
        }
      }
    }
  }

  await walk(rootDir);
  return results.sort();
}
