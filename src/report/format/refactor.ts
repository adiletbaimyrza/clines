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

export type RefactorSort = "cost" | "churn" | "recent";

export interface RefactorOptions {
  top?: number;
  price?: number;
  explain?: boolean;
  sort?: RefactorSort;
}

export function rankRefactor(
  candidates: RefactorCandidate[],
  sort: RefactorSort,
): RefactorCandidate[] {
  const active = candidates.filter((file) => file.changes > 0);
  if (sort === "churn") {
    return [...active].sort((a, b) => b.churn - a.churn || a.path.localeCompare(b.path));
  }
  if (sort === "recent") {
    return [...active].sort((a, b) => b.momentum - a.momentum || a.path.localeCompare(b.path));
  }
  return active;
}

const RANKING: Record<RefactorSort, string> = {
  cost: "Ranked by what re-reading them has cost, in tokens",
  churn: "Ranked by how many lines have changed",
  recent: "Ranked by how recently the changes arrived",
};

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
      `Judged against this repo: changed often means a recency-weighted ${busy.toFixed(1)}+ changes, dense means ${dense.toFixed(1)} cx per 100 lines, costly means ${formatNumber(costly)} tokens.`,
      "",
    ),
    "",
    ...verdictLines(report.verdicts, paint),
  );

  const sort = options.sort ?? "cost";
  const active = rankRefactor(report.candidates, sort);
  if (active.length === 0) {
    out.push("", `Nothing changed since ${report.since}.`);
    return out.join("\n");
  }

  const explain = options.explain === true;
  const shown = active.slice(0, top);
  const headers = ["File", "Verdict", "Changes", "Cx/100", "Tokens", "Re-read"];
  const extra = explain ? ["Churn", "Churn%", "Recent"] : [];
  const rows = shown.map((file) => [
    file.path,
    file.verdict,
    formatNumber(file.changes),
    file.density.toFixed(1),
    compact(file.tokens),
    compact(file.recurringTokens),
    ...(explain
      ? [compact(file.churn), `${Math.round(file.churnRatio)}%`, file.momentum.toFixed(1)]
      : []),
    ...(options.price === undefined ? [] : [money(file.recurringTokens, options.price)]),
  ]);

  const columns = [...headers, ...extra, ...(options.price === undefined ? [] : ["Cost"])];
  out.push(
    "",
    heading(RANKING[sort], paint),
    ...table(columns, rows, {
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

  pushHint(
    out,
    options.explain === true
      ? "Churn is lines changed; Recent weights each change by how long ago it landed."
      : "Run with `--explain` for churn and recency, or `--price <usd>` to cost the re-reads.",
  );
  return out.join("\n");
}

function verdictLines(verdicts: Record<Verdict, number>, paint: Painter): string[] {
  const width = Math.max(...VERDICT_ORDER.map((verdict) => verdict.length));
  return VERDICT_ORDER.map((verdict) => {
    const count = verdicts[verdict];
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
