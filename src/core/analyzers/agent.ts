export type AgentVerdict = "safe" | "review" | "human";

export type AgentRisk = "dense" | "large" | "duplicated" | "diffuse";

export interface AgentInput {
  path: string;
  code: number;
  density: number;
  concentration: number;
  tokens: number;
  duplication: number;
}

export interface AgentCandidate extends AgentInput {
  verdict: AgentVerdict;
  risks: AgentRisk[];
}

export interface AgentLimits {
  dense: number;
  large: number;
  duplicated: number;
  diffuse: number;
}

export interface AgentReport {
  candidates: AgentCandidate[];
  limits: AgentLimits;
  verdicts: Record<AgentVerdict, number>;
  measured: number;
}

export const RISK_REASON: Record<AgentRisk, string> = {
  dense: "branchy logic — this is where an edit changes behaviour by accident",
  large: "large to read — the file may not fit a focused edit",
  duplicated: "duplicated — fixing one copy silently leaves the others",
  diffuse: "complexity is spread throughout, so there is no safe local edit",
};

export const VERDICT_REASON: Record<AgentVerdict, string> = {
  safe: "no risk signals — reasonable to hand over unattended",
  review: "one risk signal — let an agent try, then read the diff",
  human: "several risk signals — decide the design yourself first",
};

const DIFFUSE_CONCENTRATION = 15;
const DUPLICATED_SHARE = 20;

// Quantiles alone would flag a quarter of any repository.
const MIN_DENSE = 10;
const MIN_LARGE = 2000;

function quantile(sorted: number[], fraction: number): number {
  if (sorted.length === 0) {
    return 0;
  }
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * fraction))] as number;
}

export function judgeAgentRisk(all: AgentInput[]): AgentReport {
  const files = all.filter((file) => file.code > 0);
  const limits: AgentLimits = {
    dense: Math.max(
      MIN_DENSE,
      quantile(
        files.map((file) => file.density).sort((a, b) => a - b),
        0.75,
      ),
    ),
    large: Math.max(
      MIN_LARGE,
      quantile(
        files.map((file) => file.tokens).sort((a, b) => a - b),
        0.75,
      ),
    ),
    duplicated: DUPLICATED_SHARE,
    diffuse: DIFFUSE_CONCENTRATION,
  };

  const candidates = files
    .map((file) => {
      const risks = risksFor(file, limits);
      return { ...file, risks, verdict: verdictFor(risks) };
    })
    .sort(
      (a, b) =>
        b.risks.length - a.risks.length || b.density - a.density || a.path.localeCompare(b.path),
    );

  return {
    candidates,
    limits,
    measured: files.length,
    verdicts: countVerdicts(candidates),
  };
}

function risksFor(file: AgentInput, limits: AgentLimits): AgentRisk[] {
  const risks: AgentRisk[] = [];
  const dense = file.density >= limits.dense && file.density > 0;
  if (dense) {
    risks.push("dense");
  }
  if (file.tokens >= limits.large && file.tokens > 0) {
    risks.push("large");
  }
  if (file.duplication >= limits.duplicated) {
    risks.push("duplicated");
  }
  if (dense && file.concentration > 0 && file.concentration < limits.diffuse) {
    risks.push("diffuse");
  }
  return risks;
}

function verdictFor(risks: AgentRisk[]): AgentVerdict {
  if (risks.length === 0) {
    return "safe";
  }
  return risks.length === 1 ? "review" : "human";
}

function countVerdicts(candidates: AgentCandidate[]): Record<AgentVerdict, number> {
  const counts: Record<AgentVerdict, number> = { safe: 0, review: 0, human: 0 };
  for (const candidate of candidates) {
    counts[candidate.verdict] += 1;
  }
  return counts;
}
