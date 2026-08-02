import { z } from "zod";

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
];

const patterns = z.array(z.string());

const ignoreSection = z
  .object({
    dirs: patterns.default([]),
    files: patterns.default([]),
    extensions: patterns.default([]),
    globs: patterns.default([]),
  })
  .strict();

const unignoreSection = z
  .object({
    dirs: patterns.default([]),
    files: patterns.default([]),
    extensions: patterns.default([]),
  })
  .strict();

export const userConfigSchema = z
  .object({
    ignore: ignoreSection.default({}),
    unignore: unignoreSection.default({}),
    respectGitignore: z.boolean().default(true),
  })
  .strict();

export type UserConfig = z.infer<typeof userConfigSchema>;

export interface Config {
  ignoreDirs: string[];
  ignoreFiles: string[];
  ignoreExtensions: string[];
  ignoreGlobs: string[];
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
    respectGitignore: user.respectGitignore,
  };
}

export function parseConfig(input: unknown): Config {
  return resolveConfig(userConfigSchema.parse(input));
}

export function defaultConfig(): Config {
  return parseConfig({});
}
