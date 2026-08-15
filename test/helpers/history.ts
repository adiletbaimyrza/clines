export interface FakeCommit {
  files: (string | [string, number, number])[];
  time?: number;
  email?: string;
  name?: string;
  hash?: string;
}

export const DAY = 24 * 60 * 60;
export const BASE_TIME = 1_700_000_000;

// Builds the shape `git log --numstat --pretty=format:%x1e%H%x1f%ct%x1f%ae%x1f%an`
// produces, so tests exercise the real parser rather than a stand-in.
export function fakeLog(...commits: FakeCommit[]): string {
  return commits
    .map((commit, index) => {
      const hash = commit.hash ?? String(index).padStart(40, "0");
      const time = commit.time ?? BASE_TIME;
      const email = commit.email ?? "dev@example.com";
      const name = commit.name ?? "A Developer";
      const rows = commit.files.map((file) =>
        typeof file === "string" ? `1\t1\t${file}` : `${file[1]}\t${file[2]}\t${file[0]}`,
      );
      return `\x1e${hash}\x1f${time}\x1f${email}\x1f${name}\n${rows.join("\n")}\n`;
    })
    .join("");
}

export function botLog(...commits: FakeCommit[]): string {
  return fakeLog(
    ...commits.map((commit) => ({
      ...commit,
      email: commit.email ?? "dependabot[bot]@users.noreply.github.com",
      name: commit.name ?? "dependabot[bot]",
    })),
  );
}
