import path from "node:path";
import { loadConfig, loadGitignoreGlobs } from "../config/load.js";
import type { Report } from "../core/model.js";
import { analyze } from "../core/pipeline.js";
import { consoleReporter } from "../report/reporters/console.js";
import { injectReadme } from "../report/reporters/readme.js";
import { ClinesError } from "../util/errors.js";
import { pathExists, readText, writeText } from "../util/fs.js";
import type { IO } from "./io.js";

export interface RunOptions {
  dir: string;
  readme: boolean;
  config?: string;
}

export async function run(options: RunOptions, io: IO): Promise<number> {
  const rootDir = path.resolve(options.dir);
  if (!(await pathExists(rootDir))) {
    throw new ClinesError(`Directory not found: ${rootDir}`);
  }

  const config = await loadConfig(rootDir, options.config);
  const gitignoreGlobs = await loadGitignoreGlobs(rootDir, config.respectGitignore);
  const report = await analyze(rootDir, config, gitignoreGlobs);

  io.out(consoleReporter.render(report));

  if (options.readme) {
    await updateReadme(rootDir, report, io);
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
