import { describe, expect, it } from "vitest";
import {
  type DupFile,
  detectDuplication,
  normalizeLine,
  toDupFile,
} from "../src/core/analyzers/duplication.js";

function file(name: string, texts: string[]): DupFile {
  return { path: name, codeLines: texts.map((text, i) => ({ line: i + 1, text })) };
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
});

describe("detectDuplication", () => {
  it("returns an empty result for no files", () => {
    expect(detectDuplication([], 5)).toEqual({
      minLines: 5,
      totalLines: 0,
      duplicatedLines: 0,
      percentage: 0,
      clones: [],
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
    expect(result.clones[0]).toEqual({
      lineCount: 6,
      fragments: [
        { path: "a.ts", startLine: 1, endLine: 6 },
        { path: "b.ts", startLine: 1, endLine: 6 },
      ],
    });
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
