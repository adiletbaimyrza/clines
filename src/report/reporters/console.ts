import type { Report } from "../../core/model.js";
import type { Reporter } from "../reporter.js";
import { getProjectSize } from "../format/size-label.js";
import { sortedLanguages } from "../format/table.js";
import { table, wrap } from "../format/text.js";

type Align = "left" | "right";

interface RowSource {
  label: string;
  files: number;
  total: number;
  code: number;
  comment: number;
  blank: number;
  complexity: number;
}

export const consoleReporter: Reporter = {
  name: "console",
  render(report: Report, verbose: boolean = false): string {
    if (report.totalFiles === 0) {
      return "No files found. Everything was ignored, or the directory has no source files.";
    }

    const columns: { header: string; align: Align; pick: (r: RowSource) => string }[] = [
      { header: "Language", align: "left", pick: (r) => r.label },
      { header: "Files", align: "right", pick: (r) => num(r.files) },
      { header: "Lines", align: "right", pick: (r) => num(r.total) },
      { header: "Code", align: "right", pick: (r) => num(r.code) },
      { header: "Comments", align: "right", pick: (r) => num(r.comment) },
      { header: "Blank", align: "right", pick: (r) => num(r.blank) },
      { header: "Complexity", align: "right", pick: (r) => num(r.complexity) },
      { header: "%", align: "right", pick: (r) => percent(r.code, report.totalCode) },
    ];

    const rows: RowSource[] = sortedLanguages(report).map((l) => ({
      label: l.language,
      files: l.files,
      total: l.total,
      code: l.code,
      comment: l.comment,
      blank: l.blank,
      complexity: l.complexity,
    }));

    const totalRow: RowSource = {
      label: "Total",
      files: report.totalFiles,
      total: report.totalLines,
      code: report.totalCode,
      comment: report.totalComment,
      blank: report.totalBlank,
      complexity: report.totalComplexity,
    };

    const sized = columns.map((col) => ({
      ...col,
      width: Math.max(col.header.length, ...[...rows, totalRow].map((r) => col.pick(r).length)),
    }));

    const renderCells = (cells: (col: (typeof sized)[number]) => string): string =>
      sized
        .map((col) => {
          const value = cells(col);
          return col.align === "left" ? value.padEnd(col.width) : value.padStart(col.width);
        })
        .join("  ");

    const divider = "─".repeat(sized.reduce((sum, c) => sum + c.width, 0) + 2 * (sized.length - 1));
    const size = getProjectSize(report.totalCode);

    return [
      renderCells((col) => col.header),
      divider,
      ...rows.map((row) => renderCells((col) => col.pick(row))),
      divider,
      renderCells((col) => col.pick(totalRow)),
      "",
      `Project size: ${size.text}`,
      ...roleLines(report),
      ...(verbose ? detailLines(report) : []),
    ].join("\n");
  },
};

const LARGEST_SHOWN = 15;

function detailLines(report: Report): string[] {
  const rows = sortedLanguages(report).map((l) => [
    l.language,
    num(l.medianCode),
    num(l.p90Code),
    num(l.maxCode),
    l.code === 0 ? "—" : ((l.complexity / l.code) * 100).toFixed(1),
    l.code + l.comment === 0 ? "—" : `${((l.comment / (l.code + l.comment)) * 100).toFixed(0)}%`,
  ]);

  const { concentration } = report;
  const largest = report.largestFiles.slice(0, LARGEST_SHOWN);
  const files = largest.map((f) => [
    f.path,
    num(f.code),
    num(f.comment),
    f.code === 0 ? "—" : ((f.complexity / f.code) * 100).toFixed(1),
  ]);

  return [
    "",
    "File size in code lines, and density per language",
    ...table(["Language", "Median", "p90", "Max", "Cx/100", "Comments"], rows),
    ...(files.length === 0
      ? []
      : ["", "Largest files", ...table(["File", "Code", "Comments", "Cx/100"], files)]),
    "",
    ...wrap(
      `Concentration: the largest ${num(concentration.largestFiles)} files (5%) hold ` +
        `${concentration.share.toFixed(0)}% of all code. Median file is ` +
        `${num(concentration.medianCode)} code lines, p90 is ${num(concentration.p90Code)}.`,
      "  ",
    ),
  ];
}

function roleLines(report: Report): string[] {
  if (report.roles.length < 2) {
    return [];
  }
  const parts = report.roles.map((r) => `${r.role} ${num(r.files)}`);
  const lines = wrap(`Files by role: ${parts.join("   ·   ")}`, "  ");

  const source = report.roles.find((r) => r.role === "source");
  const test = report.roles.find((r) => r.role === "test");
  if (source !== undefined && test !== undefined && source.code > 0) {
    lines.push(`Test-to-source: ${(test.code / source.code).toFixed(2)}:1 by code lines`);
  }
  return lines;
}

function num(value: number): string {
  return value.toLocaleString("en-US");
}

function percent(part: number, whole: number): string {
  return whole === 0 ? "0.0%" : `${((part / whole) * 100).toFixed(1)}%`;
}
