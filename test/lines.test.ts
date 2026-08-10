import { describe, expect, it } from "vitest";
import { concentrationOf, linesAnalyzer, quantile } from "../src/core/analyzers/lines.js";
import type { FileTokens } from "../src/core/model.js";

const files: FileTokens[] = [
  { path: "a.ts", ext: ".ts", lineKinds: ["code", "comment", "blank", "code"], complexity: 4 },
  { path: "b.mts", ext: ".mts", lineKinds: ["code"], complexity: 1 },
  { path: "c.py", ext: ".py", lineKinds: ["comment", "comment"], complexity: 0 },
];

describe("linesAnalyzer", () => {
  it("groups related extensions by language and aggregates totals", () => {
    const report = linesAnalyzer.analyze(files);

    expect(report.totalFiles).toBe(3);
    expect(report.totalCode).toBe(3);
    expect(report.totalLines).toBe(7);

    const ts = report.languages.find((l) => l.language === "TypeScript");
    expect(ts).toEqual({
      language: "TypeScript",
      files: 2,
      code: 3,
      comment: 1,
      blank: 1,
      total: 5,
      complexity: 5,
      medianCode: 2,
      p90Code: 2,
      maxCode: 2,
    });

    const py = report.languages.find((l) => l.language === "Python");
    expect(py).toEqual({
      language: "Python",
      files: 1,
      code: 0,
      comment: 2,
      blank: 0,
      total: 2,
      complexity: 0,
      medianCode: 0,
      p90Code: 0,
      maxCode: 0,
    });

    expect(report.totalComplexity).toBe(5);
  });

  it("returns an empty report for no files", () => {
    expect(linesAnalyzer.analyze([])).toEqual({
      totalCode: 0,
      totalComment: 0,
      totalBlank: 0,
      totalLines: 0,
      totalFiles: 0,
      totalComplexity: 0,
      languages: [],
      concentration: { largestFiles: 0, share: 0, medianCode: 0, p90Code: 0 },
      largestFiles: [],
      roles: [],
    });
  });

  it("accumulates comment and blank totals", () => {
    const report = linesAnalyzer.analyze(files);
    expect(report.totalComment).toBe(3);
    expect(report.totalBlank).toBe(1);
  });
});

describe("largest files", () => {
  it("ranks by code lines, breaking ties on path", () => {
    const report = linesAnalyzer.analyze([
      { path: "small.ts", ext: ".ts", lineKinds: ["code"], complexity: 0 },
      { path: "b.ts", ext: ".ts", lineKinds: ["code", "code"], complexity: 3 },
      { path: "a.ts", ext: ".ts", lineKinds: ["code", "code"], complexity: 1 },
    ]);

    expect(report.largestFiles.map((f) => f.path)).toEqual(["a.ts", "b.ts", "small.ts"]);
    expect(report.largestFiles[0]).toEqual({
      path: "a.ts",
      code: 2,
      comment: 0,
      complexity: 1,
    });
  });
});

describe("quantile", () => {
  it("returns zero for an empty set", () => {
    expect(quantile([], 0.5)).toBe(0);
  });

  it("picks a value at the requested position", () => {
    expect(quantile([1, 2, 3, 4], 0.5)).toBe(3);
    expect(quantile([1, 2, 3, 4], 0.9)).toBe(4);
  });
});

describe("concentrationOf", () => {
  it("reports nothing for an empty codebase", () => {
    expect(concentrationOf([])).toEqual({
      largestFiles: 0,
      share: 0,
      medianCode: 0,
      p90Code: 0,
    });
  });

  it("reports zero share when every file is empty", () => {
    expect(concentrationOf([0, 0, 0])).toMatchObject({ share: 0, largestFiles: 1 });
  });

  it("measures how much code the largest 5% of files hold", () => {
    const sizes = [
      ...Array.from({ length: 95 }, () => 10),
      ...Array.from({ length: 5 }, () => 190),
    ];

    const result = concentrationOf(sizes);

    expect(result.largestFiles).toBe(5);
    expect(Math.round(result.share)).toBe(50);
    expect(result.medianCode).toBe(10);
  });
});
