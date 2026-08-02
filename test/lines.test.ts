import { describe, expect, it } from "vitest";
import { linesAnalyzer } from "../src/core/analyzers/lines.js";
import type { FileTokens } from "../src/core/model.js";

const files: FileTokens[] = [
  { path: "a.ts", ext: ".ts", lineKinds: ["code", "comment", "blank", "code"] },
  { path: "b.mts", ext: ".mts", lineKinds: ["code"] },
  { path: "c.py", ext: ".py", lineKinds: ["comment", "comment"] },
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
    });

    const py = report.languages.find((l) => l.language === "Python");
    expect(py).toEqual({
      language: "Python",
      files: 1,
      code: 0,
      comment: 2,
      blank: 0,
      total: 2,
    });
  });

  it("returns an empty report for no files", () => {
    expect(linesAnalyzer.analyze([])).toEqual({
      totalCode: 0,
      totalComment: 0,
      totalBlank: 0,
      totalLines: 0,
      totalFiles: 0,
      languages: [],
    });
  });

  it("accumulates comment and blank totals", () => {
    const report = linesAnalyzer.analyze(files);
    expect(report.totalComment).toBe(3);
    expect(report.totalBlank).toBe(1);
  });
});
