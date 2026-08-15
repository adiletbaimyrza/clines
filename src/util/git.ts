import { execFile } from "node:child_process";

export type Blamer = (rootDir: string, relativePath: string) => Promise<number[] | undefined>;

const AUTHOR_TIME = "author-time ";
// --numstat roughly triples the size of a log.
const MAX_BUFFER = 256 * 1024 * 1024;

async function git(rootDir: string, args: string[]): Promise<string | undefined> {
  return new Promise((resolve) => {
    execFile("git", args, { cwd: rootDir, maxBuffer: MAX_BUFFER }, (error, stdout) => {
      resolve(error === null ? stdout : undefined);
    });
  });
}

export type RepoState = "ok" | "shallow" | "none";

export type StateReader = (rootDir: string) => Promise<RepoState>;

// A shallow clone answers without complaint and returns truncated history.
export async function repoState(rootDir: string): Promise<RepoState> {
  if ((await gitLine(rootDir, ["rev-parse", "--is-inside-work-tree"])) !== "true") {
    return "none";
  }
  const shallow = await gitLine(rootDir, ["rev-parse", "--is-shallow-repository"]);
  return shallow === "true" ? "shallow" : "ok";
}

async function gitLine(rootDir: string, args: string[]): Promise<string> {
  return ((await git(rootDir, args)) ?? "").trim();
}

export const SHALLOW_WARNING =
  "Shallow clone: git history is truncated here, so these numbers are too low. " +
  "Fetch the full history (actions/checkout with `fetch-depth: 0`) for a real answer.";

export type DiffReader = (rootDir: string, ref: string) => Promise<string[] | undefined>;

export async function changedFiles(rootDir: string, ref: string): Promise<string[] | undefined> {
  const stdout = await git(rootDir, [
    "-c",
    "core.quotepath=false",
    "diff",
    "--name-only",
    "--relative",
    "--diff-filter=ACMR",
    "-z",
    `${ref}...HEAD`,
  ]);
  return stdout === undefined ? undefined : stdout.split("\0").filter((name) => name !== "");
}

export function parseBlame(output: string): number[] {
  const times: number[] = [];
  let current = 0;
  for (const line of output.split("\n")) {
    if (line.startsWith(AUTHOR_TIME)) {
      current = Number(line.slice(AUTHOR_TIME.length).trim());
    } else if (line.startsWith("\t")) {
      times.push(current);
    }
  }
  return times;
}

export async function blameFile(
  rootDir: string,
  relativePath: string,
): Promise<number[] | undefined> {
  const stdout = await git(rootDir, ["blame", "--line-porcelain", "--", relativePath]);
  return stdout === undefined ? undefined : parseBlame(stdout);
}

export type ChangeReader = (rootDir: string, since: string) => Promise<string | undefined>;

export async function changeLog(rootDir: string, since: string): Promise<string | undefined> {
  return git(rootDir, [
    "-c",
    "core.quotepath=false",
    "log",
    `--since=${since}`,
    "--no-merges",
    "-M",
    "--numstat",
    "--pretty=format:%x1e%H%x1f%ct%x1f%ae%x1f%an",
  ]);
}
