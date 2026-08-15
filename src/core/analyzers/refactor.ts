export type Verdict = "refactor" | "split" | "inert" | "watch" | "quiet";

export interface RefactorInput {
  path: string;
  complexity: number;
  code: number;
  density: number;
  tokens: number;
  changes: number;
  churn: number;
  momentum: number;
  lastChange: number;
}

export interface RefactorCandidate extends RefactorInput {
  verdict: Verdict;
  recurringTokens: number;
  churnRatio: number;
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
  verdicts: Record<Verdict, number>;
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
  const busy = quantile(
    changed.map((f) => f.momentum).sort((a, b) => a - b),
    0.5,
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
      churnRatio: file.code === 0 ? 0 : (file.churn / file.code) * 100,
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
    verdicts: countVerdicts(candidates),
  };
}

function countVerdicts(candidates: RefactorCandidate[]): Record<Verdict, number> {
  const counts: Record<Verdict, number> = {
    refactor: 0,
    split: 0,
    watch: 0,
    quiet: 0,
    inert: 0,
  };
  for (const candidate of candidates) {
    counts[candidate.verdict] += 1;
  }
  return counts;
}

function verdictFor(file: RefactorInput, limits: Limits): Verdict {
  if (file.changes === 0) {
    return "inert";
  }
  const hot = file.momentum >= limits.busy && file.changes >= MIN_BUSY;
  if (!hot) {
    return "quiet";
  }
  if (file.density >= limits.dense) {
    return "refactor";
  }
  return file.tokens >= limits.costly ? "split" : "watch";
}
