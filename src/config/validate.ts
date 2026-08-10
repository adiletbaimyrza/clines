import { FILE_ROLES, type RolePatterns } from "../core/files/roles.js";

export interface ConfigIssue {
  path: string[];
  message: string;
  keys?: string[];
}

export class ConfigError extends Error {
  readonly issues: ConfigIssue[];

  constructor(issues: ConfigIssue[]) {
    super("Invalid config");
    this.name = "ConfigError";
    this.issues = issues;
  }
}

export interface UserConfig {
  ignore: { dirs: string[]; files: string[]; extensions: string[]; globs: string[] };
  unignore: { dirs: string[]; files: string[]; extensions: string[] };
  roles: RolePatterns;
  respectGitignore: boolean;
}

const IGNORE_KEYS = ["dirs", "files", "extensions", "globs"] as const;
const UNIGNORE_KEYS = ["dirs", "files", "extensions"] as const;
export const TOP_LEVEL_KEYS = ["ignore", "unignore", "roles", "respectGitignore"];

function typeName(value: unknown): string {
  if (value === null) {
    return "null";
  }
  return Array.isArray(value) ? "array" : typeof value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeName(value) === "object";
}

function enumerableKeys(value: Record<string, unknown>): string[] {
  const keys: string[] = [];
  for (const key in value) {
    keys.push(key);
  }
  return keys;
}

function pushUnknown(
  record: Record<string, unknown>,
  known: readonly string[],
  path: string[],
  issues: ConfigIssue[],
): void {
  const unknown = enumerableKeys(record).filter((key) => !known.includes(key));
  if (unknown.length > 0) {
    issues.push({ path, keys: unknown, message: "unrecognized keys" });
  }
}

function stringArray(value: unknown, path: string[], issues: ConfigIssue[]): string[] {
  if (value === undefined) {
    return [];
  }
  if (!Array.isArray(value)) {
    issues.push({ path, message: `expected array, received ${typeName(value)}` });
    return [];
  }
  const result: string[] = [];
  value.forEach((item: unknown, index) => {
    if (typeof item === "string") {
      result.push(item);
      return;
    }
    issues.push({
      path: [...path, String(index)],
      message: item === undefined ? "required" : `expected string, received ${typeName(item)}`,
    });
  });
  return result;
}

function section<K extends string>(
  value: unknown,
  known: readonly K[],
  path: string[],
  issues: ConfigIssue[],
): Record<K, string[]> {
  const record = isRecord(value) ? value : undefined;
  if (record === undefined && value !== undefined) {
    issues.push({ path, message: `expected object, received ${typeName(value)}` });
  }

  const result = {} as Record<K, string[]>;
  for (const key of known) {
    result[key] = stringArray(record?.[key], [...path, key], issues);
  }
  if (record !== undefined) {
    pushUnknown(record, known, path, issues);
  }
  return result;
}

export function parseUserConfig(input: unknown): UserConfig {
  if (input === undefined) {
    throw new ConfigError([{ path: [], message: "required" }]);
  }
  if (!isRecord(input)) {
    throw new ConfigError([{ path: [], message: `expected object, received ${typeName(input)}` }]);
  }

  const issues: ConfigIssue[] = [];
  const config: UserConfig = {
    ignore: section(input.ignore, IGNORE_KEYS, ["ignore"], issues),
    unignore: section(input.unignore, UNIGNORE_KEYS, ["unignore"], issues),
    roles: section(input.roles, FILE_ROLES, ["roles"], issues),
    respectGitignore: input.respectGitignore !== false,
  };

  const flag = input.respectGitignore;
  if (flag !== undefined && typeof flag !== "boolean") {
    issues.push({
      path: ["respectGitignore"],
      message: `expected boolean, received ${typeName(flag)}`,
    });
  }
  pushUnknown(input, TOP_LEVEL_KEYS, [], issues);

  if (issues.length > 0) {
    throw new ConfigError(issues);
  }
  return config;
}
