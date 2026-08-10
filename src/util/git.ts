import { execFile } from "node:child_process";

export type Blamer = (rootDir: string, relativePath: string) => Promise<number[] | undefined>;

const AUTHOR_TIME = "author-time ";
const MAX_BUFFER = 64 * 1024 * 1024;

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
  return new Promise((resolve) => {
    execFile(
      "git",
      ["blame", "--line-porcelain", "--", relativePath],
      { cwd: rootDir, maxBuffer: MAX_BUFFER },
      (error, stdout) => {
        resolve(error === null ? parseBlame(stdout) : undefined);
      },
    );
  });
}

export type ChangeReader = (rootDir: string, since: string) => Promise<string | undefined>;

const COMMIT = /^[0-9a-f]{40}$/;

export function parseChangeLog(output: string): Map<string, number> {
  const counts = new Map<string, number>();
  for (const line of output.split("\n")) {
    if (line === "" || COMMIT.test(line)) {
      continue;
    }
    counts.set(line, (counts.get(line) ?? 0) + 1);
  }
  return counts;
}

export function countCommits(output: string): number {
  return output.split("\n").filter((line) => COMMIT.test(line)).length;
}

export async function changeLog(rootDir: string, since: string): Promise<string | undefined> {
  return new Promise((resolve) => {
    execFile(
      "git",
      ["log", `--since=${since}`, "--name-only", "--pretty=format:%H", "--no-merges"],
      { cwd: rootDir, maxBuffer: MAX_BUFFER },
      (error, stdout) => {
        resolve(error === null ? stdout : undefined);
      },
    );
  });
}
