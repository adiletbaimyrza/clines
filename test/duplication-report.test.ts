import { describe, expect, it } from "vitest";
import type { DuplicationResult } from "../src/core/analyzers/duplication.js";
import { renderDuplication } from "../src/report/format/duplication.js";

function result(over: Partial<DuplicationResult> = {}): DuplicationResult {
  return {
    minLines: 5,
    totalLines: 1000,
    duplicatedLines: 120,
    percentage: 12,
    clones: [],
    ...over,
  };
}

describe("renderDuplication", () => {
  it("summarizes and lists clones with locations", () => {
    const output = renderDuplication(
      result({
        clones: [
          {
            lineCount: 42,
            fragments: [
              { path: "a.ts", startLine: 10, endLine: 51 },
              { path: "b.ts", startLine: 80, endLine: 121 },
            ],
          },
        ],
      }),
    );
    expect(output).toContain("Duplication: 12.0%");
    expect(output).toContain("120 of 1,000 code lines duplicated");
    expect(output).toContain("42 lines × 2");
    expect(output).toContain("a.ts:10-51");
    expect(output).toContain("b.ts:80-121");
  });

  it("reports a clean result when there is no duplication", () => {
    const output = renderDuplication(result({ minLines: 7 }));
    expect(output).toContain("Duplication: 12.0%");
    expect(output).toContain("No duplicate blocks of 7+ lines found.");
  });

  it("truncates to the top N clones", () => {
    const clones = Array.from({ length: 5 }, (_, i) => ({
      lineCount: 10 - i,
      fragments: [
        { path: `a${i}.ts`, startLine: 1, endLine: 10 },
        { path: `b${i}.ts`, startLine: 1, endLine: 10 },
      ],
    }));
    const output = renderDuplication(result({ clones }), 2);
    expect(output).toContain("a0.ts");
    expect(output).not.toContain("a3.ts");
    expect(output).toContain("… and 3 more clones.");
  });
});
