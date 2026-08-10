import path from "node:path";
import { emptyRoleAttributes, type RoleAttributes } from "../core/files/roles.js";
import { ClinesError, errorMessage } from "../util/errors.js";
import { pathExists, readText } from "../util/fs.js";
import { type Config, defaultConfig, parseConfig } from "./schema.js";
import { ConfigError, TOP_LEVEL_KEYS } from "./validate.js";

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
    throw new ClinesError(`Invalid config in ${configPath}:\n${describeIssues(error)}`);
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

export function describeIssues(error: unknown): string {
  if (!(error instanceof ConfigError)) {
    return `  ${errorMessage(error)}`;
  }
  return error.issues
    .map((issue) => {
      const where = issue.path.length === 0 ? "" : `${issue.path.join(".")}: `;
      if (issue.keys !== undefined) {
        return issue.keys.map((key) => `  Unknown key "${where}${key}"${suggest(key)}`).join("\n");
      }
      return `  ${where}${issue.message.toLowerCase()}`;
    })
    .join("\n");
}

function suggest(key: string): string {
  const match = TOP_LEVEL_KEYS.find(
    (known) => known.startsWith(key.slice(0, 3)) || key.startsWith(known.slice(0, 3)),
  );
  return match === undefined ? "" : ` — did you mean "${match}"?`;
}

export async function loadGitAttributes(rootDir: string): Promise<RoleAttributes> {
  const attributesPath = path.join(rootDir, ".gitattributes");
  if (!(await pathExists(attributesPath))) {
    return emptyRoleAttributes();
  }
  return parseGitAttributes(await readText(attributesPath));
}

const LINGUIST: Record<string, keyof RoleAttributes> = {
  "linguist-generated": "generated",
  "linguist-vendored": "vendored",
  "linguist-documentation": "docs",
};

export function parseGitAttributes(content: string): RoleAttributes {
  const result = emptyRoleAttributes();

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed === "" || trimmed.startsWith("#")) {
      continue;
    }
    const [pattern, ...tokens] = trimmed.split(/\s+/);
    for (const token of tokens) {
      const negated = token.startsWith("-");
      const [name, value] = (negated ? token.slice(1) : token).split("=");
      const bucket = LINGUIST[name as string];
      if (bucket !== undefined && !negated && value !== "false") {
        result[bucket].push(normalizePattern(pattern as string));
      }
    }
  }

  return result;
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
