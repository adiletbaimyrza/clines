export type Verdict = "refactor" | "split" | "inert" | "watch" | "quiet";

export interface RefactorInput {
  path: string;
  complexity: number;
  code: number;
  density: number;
  tokens: number;
  changes: number;
}

export interface RefactorCandidate extends RefactorInput {
  verdict: Verdict;
  recurringTokens: number;
}

export interface Limits {
  busy: number;
  dense: number;
  costly: number;
}

export interface RefactorReport {
  candidates: RefactorCandidate[];
  since: string;
  commits: number;
  inert: number;
  measured: number;
  limits: Limits;
}

const MIN_BUSY = 2;

export const VERDICT_REASON: Record<Verdict, string> = {
  refactor: "complex and changed often — you pay for this repeatedly",
  split: "expensive to read and changed often, though the logic is simple",
  inert: "untouched in this window — leave it alone",
  watch: "changed often but cheap to read",
  quiet: "rarely touched",
};

function quantile(sorted: number[], fraction: number): number {
  if (sorted.length === 0) {
    return 0;
  }
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * fraction))] as number;
}

export function judge(all: RefactorInput[], since: string, commits: number): RefactorReport {
  const files = all.filter((file) => file.complexity > 0);
  const changed = files.filter((file) => file.changes > 0);
  const busy = Math.max(
    MIN_BUSY,
    quantile(
      changed.map((f) => f.changes).sort((a, b) => a - b),
      0.5,
    ),
  );
  const dense = quantile(
    files.map((f) => f.density).sort((a, b) => a - b),
    0.75,
  );
  const costly = quantile(
    files.map((f) => f.tokens).sort((a, b) => a - b),
    0.75,
  );

  const limits = { busy, dense, costly };
  const candidates = files
    .map((file) => ({
      ...file,
      recurringTokens: file.tokens * file.changes,
      verdict: verdictFor(file, limits),
    }))
    .sort((a, b) => b.recurringTokens - a.recurringTokens || a.path.localeCompare(b.path));

  return {
    candidates,
    since,
    commits,
    inert: files.length - changed.length,
    measured: files.length,
    limits,
  };
}

function verdictFor(file: RefactorInput, limits: Limits): Verdict {
  if (file.changes === 0) {
    return "inert";
  }
  const hot = file.changes >= limits.busy;
  if (!hot) {
    return "quiet";
  }
  if (file.density >= limits.dense) {
    return "refactor";
  }
  return file.tokens >= limits.costly ? "split" : "watch";
}
