import type { RolePatterns } from "../core/files/roles.js";
import { parseUserConfig, type UserConfig } from "./validate.js";

export const DEFAULT_IGNORE_DIRS = [
  "node_modules",
  "dist",
  "build",
  "coverage",
  "logs",
  ".git",
  ".idea",
  ".vscode",
  "tmp",
  "out",
  "public",
  "static",
];

export const DEFAULT_IGNORE_FILES = [
  "clines.json",
  "tsconfig.json",
  "package.json",
  "package-lock.json",
  "pnpm-lock.yaml",
  "LICENSE",
  ".gitignore",
  ".gitmodules",
];

export const DEFAULT_IGNORE_EXTENSIONS = [
  ".log",
  ".csv",
  ".ini",
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".mp3",
  ".mp4",
  ".avi",
  ".mpg",
  ".mov",
  ".svg",
  ".webp",
  ".ico",
  ".lock",
  ".lockb",
  ".map",
  ".snap",
  ".snapshot",
  ".tsbuildinfo",
  ".code-workspace",
];

export const userConfigSchema = { parse: parseUserConfig };

export type { UserConfig };

export interface Config {
  ignoreDirs: string[];
  ignoreFiles: string[];
  ignoreExtensions: string[];
  ignoreGlobs: string[];
  roles: RolePatterns;
  respectGitignore: boolean;
}

function applyAddRemove(defaults: string[], add: string[], remove: string[]): string[] {
  const set = new Set([...defaults, ...add]);
  for (const item of remove) {
    set.delete(item);
  }
  return [...set];
}

export function resolveConfig(user: UserConfig): Config {
  return {
    ignoreDirs: applyAddRemove(DEFAULT_IGNORE_DIRS, user.ignore.dirs, user.unignore.dirs),
    ignoreFiles: applyAddRemove(DEFAULT_IGNORE_FILES, user.ignore.files, user.unignore.files),
    ignoreExtensions: applyAddRemove(
      DEFAULT_IGNORE_EXTENSIONS,
      user.ignore.extensions,
      user.unignore.extensions,
    ),
    ignoreGlobs: [...user.ignore.globs],
    roles: { ...user.roles },
    respectGitignore: user.respectGitignore,
  };
}

export function parseConfig(input: unknown): Config {
  return resolveConfig(parseUserConfig(input));
}

export function defaultConfig(): Config {
  return parseConfig({});
}
