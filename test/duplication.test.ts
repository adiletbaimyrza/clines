import { describe, expect, it } from "vitest";
import {
  type DupFile,
  detectDuplication,
  normalizeLine,
  toDupFile,
} from "../src/core/analyzers/duplication.js";

function file(name: string, texts: string[]): DupFile {
  return { path: name, lines: texts, codeLines: texts.map((text, i) => ({ line: i + 1, text })) };
}

describe("normalizeLine", () => {
  it("trims and collapses whitespace", () => {
    expect(normalizeLine("   a   b\t c  ")).toBe("a b c");
  });
});

describe("toDupFile", () => {
  it("keeps only code lines with their physical line numbers", () => {
    const dup = toDupFile("a.js", "const a = 1;\n// note\n\nconst b = 2;\n");
    expect(dup.codeLines).toEqual([
      { line: 1, text: "const a = 1;" },
      { line: 4, text: "const b = 2;" },
    ]);
  });

  it("handles files without an extension", () => {
    const dup = toDupFile("Makefile", "all:\n\tbuild\n");
    expect(dup.codeLines).toHaveLength(2);
  });

  it("keeps blank lines inside a duplicated block in the snippet", () => {
    const content = "x1();\nx2();\n\nx3();\nx4();\nx5();\n";
    const result = detectDuplication([toDupFile("a.js", content), toDupFile("b.js", content)], 5);
    expect(result.clones).toHaveLength(1);
    expect(result.clones[0]!.code).toEqual(["x1();", "x2();", "", "x3();", "x4();", "x5();"]);
  });
});

describe("detectDuplication", () => {
  it("returns an empty result for no files", () => {
    expect(detectDuplication([], 5)).toEqual({
      minLines: 5,
      totalLines: 0,
      duplicatedLines: 0,
      percentage: 0,
      clones: [],
      perFile: [],
    });
  });

  it("finds no clones when nothing repeats", () => {
    const result = detectDuplication(
      [file("a.ts", ["a", "b", "c", "d", "e"]), file("b.ts", ["f", "g", "h", "i", "j"])],
      5,
    );
    expect(result.clones).toEqual([]);
    expect(result.duplicatedLines).toBe(0);
    expect(result.percentage).toBe(0);
  });

  it("detects an exact duplicated block across two files and reports it once", () => {
    const block = ["l1", "l2", "l3", "l4", "l5", "l6"];
    const result = detectDuplication([file("a.ts", block), file("b.ts", block)], 5);

    expect(result.totalLines).toBe(12);
    expect(result.duplicatedLines).toBe(12);
    expect(result.percentage).toBe(100);
    expect(result.clones).toHaveLength(1);
    expect(result.clones[0]).toMatchObject({
      lineCount: 6,
      fragments: [
        { path: "a.ts", startLine: 1, endLine: 6 },
        { path: "b.ts", startLine: 1, endLine: 6 },
      ],
      code: ["l1", "l2", "l3", "l4", "l5", "l6"],
    });
    expect(result.perFile).toEqual([
      { path: "a.ts", totalLines: 6, duplicatedLines: 6, percentage: 100 },
      { path: "b.ts", totalLines: 6, duplicatedLines: 6, percentage: 100 },
    ]);
  });

  it("does not detect blocks shorter than minLines", () => {
    const result = detectDuplication(
      [file("a.ts", ["x", "y", "z"]), file("b.ts", ["x", "y", "z"])],
      5,
    );
    expect(result.clones).toEqual([]);
    expect(result.duplicatedLines).toBe(0);
  });

  it("detects duplication within a single file", () => {
    const block = ["p", "q", "r", "s", "t"];
    const lines = [...block, "unique1", "unique2", ...block];
    const result = detectDuplication([file("a.ts", lines)], 5);

    expect(result.clones).toHaveLength(1);
    const clone = result.clones[0]!;
    expect(clone.lineCount).toBe(5);
    expect(clone.fragments).toEqual([
      { path: "a.ts", startLine: 1, endLine: 5 },
      { path: "a.ts", startLine: 8, endLine: 12 },
    ]);
  });

  it("handles three copies of a block", () => {
    const block = ["m1", "m2", "m3", "m4", "m5"];
    const result = detectDuplication(
      [file("a.ts", block), file("b.ts", block), file("c.ts", block)],
      5,
    );
    expect(result.clones).toHaveLength(1);
    expect(result.clones[0]!.fragments).toHaveLength(3);
  });

  it("extends a clone beyond minLines to its maximal length", () => {
    const block = ["e1", "e2", "e3", "e4", "e5", "e6", "e7", "e8"];
    const result = detectDuplication([file("a.ts", block), file("b.ts", block)], 5);
    expect(result.clones).toHaveLength(1);
    expect(result.clones[0]!.lineCount).toBe(8);
  });

  it("orders equal-weight clones by size then path", () => {
    const block1 = ["c1", "c2", "c3", "c4", "c5"];
    const block2 = ["d1", "d2", "d3", "d4", "d5"];
    const result = detectDuplication(
      [file("a.ts", [...block1, "ma", ...block2]), file("b.ts", [...block1, "mb", ...block2])],
      5,
    );
    expect(result.clones).toHaveLength(2);
    expect(result.clones.every((c) => c.lineCount === 5)).toBe(true);
  });

  it("orders clones of equal weight by line count", () => {
    const big = ["g1", "g2", "g3", "g4", "g5", "g6"];
    const small = ["s1", "s2", "s3", "s4"];
    const result = detectDuplication(
      [
        file("a.ts", [...big, "xa", ...small]),
        file("b.ts", [...big, "xb", ...small]),
        file("c.ts", small),
      ],
      4,
    );
    expect(result.clones).toHaveLength(2);
    expect(result.clones[0]!.lineCount).toBe(6);
    expect(result.clones[1]!.lineCount).toBe(4);
  });

  it("merges overlapping shifted fragments in the same file into one span", () => {
    // Seven identical lines per file: each 5-line window matches shifted
    // copies of itself, producing many overlapping fragments per file.
    const repeated = Array(7).fill("same");
    const result = detectDuplication([file("a.ts", repeated), file("b.ts", repeated)], 5);

    expect(result.clones).toHaveLength(1);
    // Each file collapses to a single merged span, not three overlapping shifts.
    expect(result.clones[0]!.fragments).toEqual([
      { path: "a.ts", startLine: 1, endLine: 7 },
      { path: "b.ts", startLine: 1, endLine: 7 },
    ]);
  });

  it("drops clones that collapse to a single self-overlapping region", () => {
    // 12 identical lines in one file: every 5-line window matches shifted
    // copies of itself, but it is not a cross-location clone.
    const result = detectDuplication([file("a.ts", Array(12).fill("same"))], 5);
    expect(result.clones).toEqual([]);
    // Stats reflect only reported clones, so this self-overlap counts as 0.
    expect(result.duplicatedLines).toBe(0);
    expect(result.perFile).toEqual([]);
  });

  it("filters by minCopies and reflects it in every stat", () => {
    const trio = ["t1", "t2", "t3", "t4", "t5"];
    const pair = ["q1", "q2", "q3", "q4", "q5"];
    const files = [
      file("t1.ts", trio),
      file("t2.ts", trio),
      file("t3.ts", trio),
      file("p1.ts", pair),
      file("p2.ts", pair),
    ];

    const r2 = detectDuplication(files, 5, 2);
    expect(r2.clones).toHaveLength(2);
    expect(r2.duplicatedLines).toBe(25);
    expect(r2.perFile).toHaveLength(5);

    const r3 = detectDuplication(files, 5, 3);
    expect(r3.clones).toHaveLength(1);
    expect(r3.clones[0]!.fragments).toHaveLength(3);
    // Stats now reflect only the 3× clone: 3 files × 5 lines.
    expect(r3.duplicatedLines).toBe(15);
    expect(r3.perFile).toHaveLength(3);
  });

  it("ranks larger clones first", () => {
    const big = ["b1", "b2", "b3", "b4", "b5", "b6"];
    const small = ["s1", "s2", "s3", "s4", "s5"];
    const result = detectDuplication(
      [file("a.ts", [...big, "x", ...small]), file("b.ts", [...big, "y", ...small])],
      5,
    );
    expect(result.clones).toHaveLength(2);
    expect(result.clones[0]!.lineCount).toBe(6);
    expect(result.clones[1]!.lineCount).toBe(5);
  });
});
