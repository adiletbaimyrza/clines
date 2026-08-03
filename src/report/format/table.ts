import type { LanguageStat, Report } from "../../core/model.js";
import { getProjectSize } from "./size-label.js";

export function sortedLanguages(report: Report): LanguageStat[] {
  return [...report.languages].sort(
    (a, b) => b.code - a.code || a.language.localeCompare(b.language),
  );
}

export function buildReadmeSection(report: Report): string {
  const size = getProjectSize(report.totalCode);
  const header = "| Language | Files | Code | Comments | Blank | Complexity | Total |";
  const divider = "|----------|------:|-----:|---------:|------:|-----------:|------:|";

  const rows = sortedLanguages(report).map(
    (l) =>
      `| ${l.language} | ${l.files} | ${l.code} | ${l.comment} | ${l.blank} | ${l.complexity} | ${l.total} |`,
  );

  const totalRow = `| **Total** | **${report.totalFiles}** | **${report.totalCode}** | ${sumField(
    report,
    "comment",
  )} | ${sumField(report, "blank")} | **${report.totalComplexity}** | **${report.totalLines}** |`;

  return [
    `**Lines of Code:** \`${report.totalCode}\`  `,
    `**Project Size:** ${size.html}`,
    "",
    header,
    divider,
    ...rows,
    totalRow,
  ].join("\n");
}

function sumField(report: Report, field: "comment" | "blank"): number {
  return report.languages.reduce((sum, l) => sum + l[field], 0);
}
