import type { Commit } from "../history.js";

export interface CouplePair {
  a: string;
  b: string;
  shared: number;
  revisionsA: number;
  revisionsB: number;
  strength: number;
}

export interface CoupledFile {
  path: string;
  revisions: number;
  sumOfCoupling: number;
  partners: number;
}

export interface CouplingLimits {
  minRevisions: number;
  minShared: number;
  minStrength: number;
  maxCommitSize: number;
}

export interface CouplingResult {
  pairs: CouplePair[];
  files: CoupledFile[];
  commits: number;
  skipped: number;
  limits: CouplingLimits;
}

// CodeScene's documented defaults.
export const DEFAULT_LIMITS: CouplingLimits = {
  minRevisions: 10,
  minShared: 10,
  minStrength: 50,
  maxCommitSize: 30,
};

const KEY = "\x00";

export function analyzeCoupling(
  commits: Commit[],
  limits: Partial<CouplingLimits> = {},
): CouplingResult {
  const bounds = { ...DEFAULT_LIMITS, ...limits };
  const revisions = new Map<string, number>();
  const shared = new Map<string, number>();
  let considered = 0;
  let skipped = 0;

  for (const commit of commits) {
    const paths = [...new Set(commit.files.map((file) => file.path))].sort();
    if (paths.length === 0) {
      continue;
    }
    if (paths.length > bounds.maxCommitSize) {
      skipped += 1;
      continue;
    }
    considered += 1;

    for (const path of paths) {
      revisions.set(path, (revisions.get(path) ?? 0) + 1);
    }
    for (let i = 0; i < paths.length; i++) {
      for (let j = i + 1; j < paths.length; j++) {
        const key = `${paths[i] as string}${KEY}${paths[j] as string}`;
        shared.set(key, (shared.get(key) ?? 0) + 1);
      }
    }
  }

  const pairs: CouplePair[] = [];
  for (const [key, count] of shared) {
    const [a = "", b = ""] = key.split(KEY);
    const revisionsA = revisions.get(a) as number;
    const revisionsB = revisions.get(b) as number;
    if (
      revisionsA < bounds.minRevisions ||
      revisionsB < bounds.minRevisions ||
      count < bounds.minShared
    ) {
      continue;
    }
    // Never above 100%: shared cannot exceed the smaller revision count.
    const strength = (count / ((revisionsA + revisionsB) / 2)) * 100;
    if (strength < bounds.minStrength) {
      continue;
    }
    pairs.push({ a, b, shared: count, revisionsA, revisionsB, strength });
  }

  pairs.sort(
    (x, y) =>
      y.strength - x.strength ||
      y.shared - x.shared ||
      x.a.localeCompare(y.a) ||
      x.b.localeCompare(y.b),
  );

  return {
    pairs,
    files: summarize(pairs, revisions),
    commits: considered,
    skipped,
    limits: bounds,
  };
}

function summarize(pairs: CouplePair[], revisions: Map<string, number>): CoupledFile[] {
  const totals = new Map<string, { sumOfCoupling: number; partners: number }>();
  for (const pair of pairs) {
    for (const path of [pair.a, pair.b]) {
      const entry = totals.get(path) ?? { sumOfCoupling: 0, partners: 0 };
      entry.sumOfCoupling += pair.shared;
      entry.partners += 1;
      totals.set(path, entry);
    }
  }

  return [...totals.entries()]
    .map(([path, entry]) => ({ path, revisions: revisions.get(path) as number, ...entry }))
    .sort((a, b) => b.sumOfCoupling - a.sumOfCoupling || a.path.localeCompare(b.path));
}
