import type { CloneLocation, DuplicationResult } from "../../core/analyzers/duplication.js";
import { excludedNotice } from "./html.js";
import { painter } from "./paint.js";
import { heading, pushHint, table, wrap } from "./text.js";

const LOCATION_LABEL: Record<CloneLocation, string> = {
  "within-file": "within one file",
  "same-directory": "same directory",
  "same-package": "same package",
  "cross-package": "across packages",
};

export function renderDuplicationInsight(
  result: DuplicationResult,
  topGroups: number = 10,
  churn?: Map<string, number>,
): string[] {
  const { shape, ranked } = result;
  if (shape.groups === 0) {
    return [];
  }

  const paint = painter();
  const out: string[] = [
    heading("Duplication shape", paint),
    `  ${num(shape.groups)} clone groups   ·   ${num(shape.removable)} lines removable if each were deduped once`,
    `  Size       ${shape.underTen.toFixed(0)}% under 10 lines   ·   median ${num(shape.medianLines)}   ·   largest ${num(shape.maxLines)}`,
    `  Location   ${locationSummary(shape.byLocation, shape.groups)}`,
    `  Spread     top 10 groups hold ${shape.topTenShare.toFixed(0)}% of what is removable${shape.topTenShare < 20 ? " — duplication is diffuse" : ""}`,
  ];

  if (result.renamedGroups > 0) {
    out.push(
      `  Renamed    ${num(result.renamedGroups)} further groups match only once identifiers are ignored`,
    );
  }

  const rows = ranked
    .slice(0, topGroups)
    .map((clone) => [
      clone.files.length === 1
        ? (clone.files[0] as string)
        : `${clone.files[0] as string}  +${num(clone.files.length - 1)}`,
      num(clone.lineCount),
      num(clone.copies),
      num(clone.removable),
      ...(churn === undefined ? [] : [ageLabel(churn, clone.files)]),
    ]);

  const headers = ["Where", "Lines", "Copies", "Removable"];
  out.push(
    "",
    heading("Biggest refactor opportunities", paint),
    ...table(churn === undefined ? headers : [...headers, "Last touched"], rows, { paint }),
  );

  return out;
}

function locationSummary(byLocation: Record<CloneLocation, number>, groups: number): string {
  return (Object.entries(byLocation) as [CloneLocation, number][])
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([key, count]) => `${((count / groups) * 100).toFixed(0)}% ${LOCATION_LABEL[key]}`)
    .join("   ·   ");
}

function ageLabel(churn: Map<string, number>, files: string[]): string {
  const times = files.map((file) => churn.get(file)).filter((t): t is number => t !== undefined);
  if (times.length === 0) {
    return "—";
  }
  const years = (Date.now() / 1000 - Math.max(...times)) / (365 * 24 * 60 * 60);
  return years < 1 ? `${Math.max(1, Math.round(years * 12))}mo` : `${years.toFixed(1)}y`;
}

export function renderDuplication(result: DuplicationResult, topFiles: number = 10): string {
  const paint = painter();
  const out: string[] = [
    heading(
      `Duplication: ${result.percentage.toFixed(1)}%   ${num(result.duplicatedLines)} duplicated lines   ·   ${num(result.clones.length)} clones`,
      paint,
    ),
  ];

  if (result.clones.length === 0) {
    out.push("", `No duplicate blocks of ${result.minLines}+ lines found.`);
    pushNotice(out, result);
    return out.join("\n");
  }

  const files = result.perFile.slice(0, topFiles);
  const rows = files.map((f) => [f.path, num(f.duplicatedLines), `${f.percentage.toFixed(0)}%`]);

  out.push(
    "",
    heading("Most duplicated files", paint),
    ...table(["File", "Dup lines", "% of file"], rows, { paint }),
  );

  const hidden = result.perFile.length - files.length;
  if (hidden > 0) {
    out.push(`  … and ${num(hidden)} more files.`);
  }

  pushNotice(out, result);

  pushHint(out, "Run with `--html <file>` for a full browsable report with code snippets.");
  return out.join("\n");
}

function pushNotice(out: string[], result: DuplicationResult): void {
  const notice = excludedNotice(result.excluded);
  if (notice !== "") {
    out.push("", ...wrap(notice));
  }
}

function num(value: number): string {
  return value.toLocaleString("en-US");
}
