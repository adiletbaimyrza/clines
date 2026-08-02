import path from "node:path";
import { ClinesError, errorMessage } from "../util/errors.js";
import { pathExists, readText } from "../util/fs.js";
import { type Config, defaultConfig, parseConfig } from "./schema.js";

export async function loadConfig(rootDir: string, explicitPath?: string): Promise<Config> {
  const configPath = explicitPath ? path.resolve(explicitPath) : path.join(rootDir, "clines.json");

  if (await pathExists(configPath)) {
    return readAndParse(await readText(configPath), configPath);
  }

  if (explicitPath) {
    throw new ClinesError(`Config file not found: ${configPath}`);
  }

  return defaultConfig();
}

function readAndParse(raw: string, configPath: string): Config {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new ClinesError(`Invalid JSON in config file: ${configPath}`);
  }
  try {
    return parseConfig(data);
  } catch (error) {
    throw new ClinesError(`Invalid config in ${configPath}: ${errorMessage(error)}`);
  }
}

export async function loadGitignoreGlobs(rootDir: string, respect: boolean): Promise<string[]> {
  if (!respect) {
    return [];
  }
  const gitignorePath = path.join(rootDir, ".gitignore");
  if (!(await pathExists(gitignorePath))) {
    return [];
  }
  return parseGitignore(await readText(gitignorePath));
}

export function parseGitignore(content: string): string[] {
  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== "" && !line.startsWith("#") && !line.startsWith("!"))
    .map(normalizePattern);
}

function normalizePattern(pattern: string): string {
  let result = pattern;
  if (result.startsWith("/")) {
    result = result.slice(1);
  }
  if (result.endsWith("/")) {
    result = `${result.slice(0, -1)}/**`;
  }
  return result;
}
