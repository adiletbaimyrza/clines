import type { CouplingResult } from "../../core/analyzers/coupling.js";
import { formatNumber } from "./html.js";
import { painter } from "./paint.js";
import { heading, pushHint, table, wrap } from "./text.js";

export function renderCoupling(result: CouplingResult, topRows: number = 20): string {
  const paint = painter();
  const { minRevisions, minShared, minStrength, maxCommitSize } = result.limits;

  const out: string[] = [
    heading(
      `Change coupling: ${formatNumber(result.pairs.length)} coupled pairs across ${formatNumber(result.commits)} commits`,
      paint,
    ),
  ];

  if (result.skipped > 0) {
    out.push(
      `  Skipped ${formatNumber(result.skipped)} commits touching more than ${maxCommitSize} files (--max-commit-size)`,
    );
  }

  if (result.pairs.length === 0) {
    out.push(
      "",
      ...wrap(
        `Nothing met the thresholds: ${minRevisions}+ revisions each, ${minShared}+ shared commits, ${minStrength}%+ strength. Small or young repositories usually need lower ones — try \`--min-revisions 3 --min-shared 3\`.`,
      ),
    );
    return out.join("\n");
  }

  const shown = result.pairs.slice(0, topRows);
  out.push(
    "",
    heading("Files that keep changing together", paint),
    ...table(
      ["File", "Changes with", "Shared", "Strength"],
      shown.map((pair) => [
        pair.a,
        pair.b,
        formatNumber(pair.shared),
        `${pair.strength.toFixed(0)}%`,
      ]),
      { paint },
    ),
  );

  const hidden = result.pairs.length - shown.length;
  if (hidden > 0) {
    out.push(`  … and ${formatNumber(hidden)} more pairs.`);
  }

  const files = result.files.slice(0, topRows);
  out.push(
    "",
    heading("Where to start", paint),
    ...table(
      ["File", "Partners", "Shared", "Revisions"],
      files.map((file) => [
        file.path,
        formatNumber(file.partners),
        formatNumber(file.sumOfCoupling),
        formatNumber(file.revisions),
      ]),
      { paint },
    ),
  );

  out.push(
    "",
    ...wrap(
      "Strength is shared commits against the average revision count of the pair. High coupling between a file and its test is expected. High coupling across module boundaries is a missing abstraction, and it is the reason a hotspot is expensive rather than merely busy.",
    ),
  );

  pushHint(out, "Run `clines refactor` to see which of these files also cost the most to read.");
  return out.join("\n");
}
