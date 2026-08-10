import {
  VERDICT_REASON,
  type RefactorCandidate,
  type RefactorReport,
  type Verdict,
} from "../../core/analyzers/refactor.js";
import { formatNumber } from "./html.js";
import { painter, type Ink, type Painter } from "./paint.js";
import { heading, pushHint, table, wrap } from "./text.js";

const VERDICT_ORDER: Verdict[] = ["refactor", "split", "watch", "quiet", "inert"];

const VERDICT_INK: Record<Verdict, Ink> = {
  refactor: "red",
  split: "yellow",
  watch: "cyan",
  quiet: "dim",
  inert: "dim",
};

function verdictInk(cell: string): Ink | undefined {
  return VERDICT_INK[cell as Verdict];
}

export interface RefactorOptions {
  top?: number;
  price?: number;
}

export function renderRefactor(
  report: RefactorReport | undefined,
  options: RefactorOptions = {},
): string {
  if (report === undefined) {
    return "Refactor verdicts need git history, and none is available here.";
  }

  const top = options.top ?? 20;
  const paint = painter();
  const out: string[] = [
    heading(
      `Refactor: ${formatNumber(report.measured)} files weighed against ${formatNumber(report.commits)} commits since ${report.since}`,
      paint,
    ),
  ];

  if (report.measured === 0) {
    out.push("", "No files found.");
    return out.join("\n");
  }

  const { busy, dense, costly } = report.limits;
  out.push(
    "",
    ...wrap(
      `Judged against this repo: changed often means ${formatNumber(busy)}+ changes, dense means ${dense.toFixed(1)} cx per 100 lines, costly means ${formatNumber(costly)} tokens.`,
      "",
    ),
    "",
    ...verdictLines(report.candidates, paint),
  );

  const active = report.candidates.filter((file) => file.changes > 0);
  if (active.length === 0) {
    out.push("", `Nothing changed since ${report.since}.`);
    return out.join("\n");
  }

  const shown = active.slice(0, top);
  const headers = ["File", "Verdict", "Changes", "Cx/100", "Tokens", "Re-read"];
  const rows = shown.map((file) => [
    file.path,
    file.verdict,
    formatNumber(file.changes),
    file.density.toFixed(1),
    compact(file.tokens),
    compact(file.recurringTokens),
    ...(options.price === undefined ? [] : [money(file.recurringTokens, options.price)]),
  ]);

  out.push(
    "",
    heading("Ranked by what re-reading them has cost, in tokens", paint),
    ...table(options.price === undefined ? headers : [...headers, "Cost"], rows, {
      paint,
      ink: (cell, column) => (column === 1 ? verdictInk(cell) : undefined),
    }),
  );

  const hidden = active.length - shown.length;
  if (hidden > 0) {
    out.push(`  … and ${formatNumber(hidden)} more files.`);
  }

  if (report.inert > 0) {
    out.push(
      "",
      ...wrap(
        `${formatNumber(report.inert)} of ${formatNumber(report.measured)} files did not change since ${report.since}. Complex or not, they cost you nothing — leave them alone.`,
      ),
    );
  }

  pushHint(out, "Run with `--price <usd>` to price the re-reads per million tokens.");
  return out.join("\n");
}

function verdictLines(candidates: RefactorCandidate[], paint: Painter): string[] {
  const width = Math.max(...VERDICT_ORDER.map((verdict) => verdict.length));
  return VERDICT_ORDER.map((verdict) => {
    const count = candidates.filter((file) => file.verdict === verdict).length;
    return count === 0
      ? undefined
      : `  ${paint(verdict.padEnd(width), VERDICT_INK[verdict])}   ${formatNumber(count).padStart(5)} files   ${paint(VERDICT_REASON[verdict], "dim")}`;
  }).filter((line): line is string => line !== undefined);
}

function compact(value: number): string {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }
  return value >= 1_000 ? `${Math.round(value / 1_000)}k` : String(value);
}

function money(tokens: number, price: number): string {
  const dollars = (tokens / 1_000_000) * price;
  return dollars >= 100 ? `$${formatNumber(Math.round(dollars))}` : `$${dollars.toFixed(2)}`;
}
