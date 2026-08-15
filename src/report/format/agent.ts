import {
  RISK_REASON,
  VERDICT_REASON,
  type AgentReport,
  type AgentVerdict,
} from "../../core/analyzers/agent.js";
import { formatNumber } from "./html.js";
import { painter, type Ink, type Painter } from "./paint.js";
import { heading, pushHint, table, wrap } from "./text.js";

const VERDICT_ORDER: AgentVerdict[] = ["human", "review", "safe"];

const VERDICT_INK: Record<AgentVerdict, Ink> = {
  human: "red",
  review: "yellow",
  safe: "green",
};

function verdictInk(cell: string): Ink | undefined {
  return VERDICT_INK[cell as AgentVerdict];
}

export function renderAgent(report: AgentReport, topFiles: number = 20): string {
  const paint = painter();
  const out: string[] = [
    heading(`Agent risk: ${formatNumber(report.measured)} files rated`, paint),
  ];

  if (report.measured === 0) {
    out.push("", "No files found.");
    return out.join("\n");
  }

  out.push("", ...verdictLines(report, paint));

  const risky = report.candidates.filter((file) => file.risks.length > 0);
  if (risky.length === 0) {
    out.push("", "Nothing here carries a risk signal.");
    return out.join("\n");
  }

  const shown = risky.slice(0, topFiles);
  out.push(
    "",
    heading("Read the diff carefully on these", paint),
    ...table(
      ["File", "Verdict", "Cx/100", "Tokens", "Dup", "Why"],
      shown.map((file) => [
        file.path,
        file.verdict,
        file.density.toFixed(1),
        compact(file.tokens),
        `${Math.round(file.duplication)}%`,
        file.risks.join(", "),
      ]),
      { paint, ink: (cell, column) => (column === 1 ? verdictInk(cell) : undefined) },
    ),
  );

  const hidden = risky.length - shown.length;
  if (hidden > 0) {
    out.push(`  … and ${formatNumber(hidden)} more files.`);
  }

  out.push("", heading("What the signals mean", paint));
  for (const [risk, reason] of Object.entries(RISK_REASON)) {
    out.push(`  ${paint(risk.padEnd(11), "cyan")}${paint(reason, "dim")}`);
  }

  out.push(
    "",
    ...wrap(
      `Judged against this repo: dense means ${report.limits.dense.toFixed(1)} cx per 100 lines, large means ${formatNumber(report.limits.large)} tokens. This is a heuristic built from properties that correlate with unreliable AI edits, not a measured success rate — treat it as a reading order, not a permission system.`,
    ),
  );

  pushHint(out, "Run `clines cx --explain` to see what makes a dense file dense.");
  return out.join("\n");
}

function verdictLines(report: AgentReport, paint: Painter): string[] {
  const width = Math.max(...VERDICT_ORDER.map((verdict) => verdict.length));
  return VERDICT_ORDER.map((verdict) => {
    const count = report.verdicts[verdict];
    return count === 0
      ? undefined
      : `  ${paint(verdict.padEnd(width), VERDICT_INK[verdict])}   ${formatNumber(count).padStart(5)} files   ${paint(VERDICT_REASON[verdict], "dim")}`;
  }).filter((line): line is string => line !== undefined);
}

function compact(value: number): string {
  return value >= 1_000 ? `${Math.round(value / 1_000)}k` : String(value);
}
