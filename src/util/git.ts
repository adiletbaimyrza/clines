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
