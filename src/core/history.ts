export interface Change {
  path: string;
  added: number;
  deleted: number;
}

export interface Commit {
  hash: string;
  time: number;
  email: string;
  name: string;
  bot: boolean;
  files: Change[];
}

export interface History {
  commits: Commit[];
}

const RECORD = "\x1e";
const UNIT = "\x1f";

const BOT_ACCOUNTS = new Set([
  "dependabot",
  "renovate",
  "github-actions",
  "greenkeeper",
  "snyk-bot",
  "imgbot",
  "allcontributors",
  "mergify",
  "codecov",
  "semantic-release-bot",
  "bot",
]);

export function isBot(name: string, email: string): boolean {
  if (name.trim().toLowerCase().endsWith("[bot]")) {
    return true;
  }
  const local = email
    .toLowerCase()
    .split("@", 1)
    .join("")
    .replace(/\[bot\]$/, "");
  return BOT_ACCOUNTS.has(local);
}

function cleanPath(path: string): string {
  return path.replace(/\/{2,}/g, "/").replace(/^\//, "");
}

const ARROW = " => ";

// git writes a rename three ways: `a => b`, `dir/{a => b}`, and `{dir => other}/f`.
// Scanned rather than matched: a regex for the braced form backtracks polynomially
// on a crafted filename, and these paths come from whatever repository we are given.
export function renamePair(field: string): { from: string; to: string } {
  const arrow = field.indexOf(ARROW);
  if (arrow === -1) {
    return { from: field, to: field };
  }
  const open = field.lastIndexOf("{", arrow);
  const close = field.indexOf("}", arrow);
  if (open === -1 || close === -1) {
    return {
      from: cleanPath(field.slice(0, arrow)),
      to: cleanPath(field.slice(arrow + ARROW.length)),
    };
  }
  const prefix = field.slice(0, open);
  const suffix = field.slice(close + 1);
  return {
    from: cleanPath(prefix + field.slice(open + 1, arrow) + suffix),
    to: cleanPath(prefix + field.slice(arrow + ARROW.length, close) + suffix),
  };
}

function follow(aliases: Map<string, string>, path: string): string {
  let current = path;
  const seen = new Set<string>();
  while (!seen.has(current)) {
    const next = aliases.get(current);
    if (next === undefined) {
      return current;
    }
    seen.add(current);
    current = next;
  }
  return current;
}

function count(value: string): number {
  // numstat writes "-" for binary files.
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

// Commits arrive newest first, so a rename tells us what older paths became.
export function parseHistory(output: string): History {
  const commits: Commit[] = [];
  const aliases = new Map<string, string>();

  for (const block of output.split(RECORD)) {
    if (block.trim() === "") {
      continue;
    }
    const [header = "", ...rest] = block.split("\n");
    const [hash = "", time = "", email = "", name = ""] = header.split(UNIT);

    const files: Change[] = [];
    for (const line of rest) {
      const parts = line.split("\t");
      if (parts.length < 3) {
        continue;
      }
      const [added = "", deleted = "", field = ""] = parts;
      const { from, to } = renamePair(field);
      const current = follow(aliases, to);
      if (from !== to) {
        aliases.set(from, current);
      }
      files.push({ path: current, added: count(added), deleted: count(deleted) });
    }

    commits.push({
      hash,
      time: count(time),
      email,
      name,
      bot: isBot(name, email),
      files,
    });
  }

  return { commits };
}

export interface HistoryOptions {
  includeBots?: boolean;
}

export function commitsOf(history: History, options: HistoryOptions = {}): Commit[] {
  return options.includeBots === true
    ? history.commits
    : history.commits.filter((commit) => !commit.bot);
}

export interface FileChanges {
  commits: number;
  churn: number;
  momentum: number;
  lastChange: number;
}

// Anchored on the newest commit, so the same history always scores the same.
export function halfLifeOf(commits: Commit[]): { now: number; halfLife: number } {
  const times = commits.map((commit) => commit.time).filter((time) => time > 0);
  if (times.length === 0) {
    return { now: 0, halfLife: 0 };
  }
  const now = Math.max(...times);
  return { now, halfLife: (now - Math.min(...times)) / 4 };
}

export function fileChanges(commits: Commit[]): Map<string, FileChanges> {
  const { now, halfLife } = halfLifeOf(commits);
  const changes = new Map<string, FileChanges>();

  for (const commit of commits) {
    const weight = halfLife === 0 ? 1 : 0.5 ** ((now - commit.time) / halfLife);
    for (const file of commit.files) {
      const entry = changes.get(file.path) ?? {
        commits: 0,
        churn: 0,
        momentum: 0,
        lastChange: 0,
      };
      entry.commits += 1;
      entry.churn += file.added + file.deleted;
      entry.momentum += weight;
      entry.lastChange = Math.max(entry.lastChange, commit.time);
      changes.set(file.path, entry);
    }
  }

  return changes;
}
