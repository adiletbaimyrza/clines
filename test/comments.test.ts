import { describe, expect, it } from "vitest";
import { measureDrift, summarizeDrift } from "../src/core/analyzers/comments.js";
import type { LineKind } from "../src/core/model.js";
import { parseBlame, blameFile } from "../src/util/git.js";

const YEAR = 365 * 24 * 60 * 60;

function kinds(spec: string): LineKind[] {
  return [...spec].map((c) => (c === "c" ? "comment" : c === "b" ? "blank" : "code"));
}

describe("measureDrift", () => {
  it("counts nothing when there are no comments", () => {
    expect(measureDrift(kinds("xxx"), [1, 2, 3], YEAR)).toEqual({ blocks: 0, drifted: 0 });
  });

  it("flags a block whose following code is newer than the threshold", () => {
    const result = measureDrift(kinds("cx"), [0, 5 * YEAR], 3 * YEAR);
    expect(result).toEqual({ blocks: 1, drifted: 1 });
  });

  it("does not flag a block within the threshold", () => {
    expect(measureDrift(kinds("cx"), [0, YEAR], 3 * YEAR)).toEqual({ blocks: 1, drifted: 0 });
  });

  it("treats consecutive comment lines as one block and uses its newest line", () => {
    const result = measureDrift(kinds("cccx"), [0, 0, 4 * YEAR, 5 * YEAR], 3 * YEAR);
    expect(result).toEqual({ blocks: 1, drifted: 0 });
  });

  it("ignores a trailing comment with no code beneath it", () => {
    expect(measureDrift(kinds("xc"), [0, 0], YEAR)).toEqual({ blocks: 0, drifted: 0 });
    expect(measureDrift(kinds("xcb"), [0, 0, 0], YEAR)).toEqual({ blocks: 0, drifted: 0 });
  });

  it("looks past blank lines to find the code a comment describes", () => {
    const result = measureDrift(kinds("cbx"), [0, 0, 9 * YEAR], 3 * YEAR);
    expect(result).toEqual({ blocks: 1, drifted: 1 });
  });

  it("counts several blocks in one file", () => {
    const result = measureDrift(kinds("cxbcx"), [0, 9 * YEAR, 0, 0, 0], 3 * YEAR);
    expect(result).toEqual({ blocks: 2, drifted: 1 });
  });

  it("treats missing blame entries as time zero", () => {
    expect(measureDrift(kinds("cx"), [], 3 * YEAR)).toEqual({ blocks: 1, drifted: 0 });
  });
});

describe("summarizeDrift", () => {
  it("returns empty totals when no file has comment blocks", () => {
    expect(summarizeDrift([{ path: "a.ts", blocks: 0, drifted: 0 }], 3)).toEqual({
      filesChecked: 0,
      blocks: 0,
      drifted: 0,
      years: 3,
      files: [],
    });
  });

  it("ranks files by drifted share", () => {
    const health = summarizeDrift(
      [
        { path: "a.ts", blocks: 10, drifted: 1 },
        { path: "b.ts", blocks: 10, drifted: 9 },
        { path: "c.ts", blocks: 10, drifted: 5 },
        { path: "d.ts", blocks: 10, drifted: 4 },
        { path: "e.ts", blocks: 10, drifted: 0 },
      ],
      3,
    );

    expect(health).toMatchObject({ filesChecked: 5, blocks: 50, drifted: 19 });
    expect(health.files.map((f) => f.path)).toEqual(["b.ts", "c.ts", "d.ts", "a.ts", "e.ts"]);
  });

  it("breaks ties on drifted count and then path", () => {
    const health = summarizeDrift(
      [
        { path: "b.ts", blocks: 10, drifted: 5 },
        { path: "a.ts", blocks: 10, drifted: 5 },
      ],
      1,
    );

    expect(health.files.map((f) => f.path)).toEqual(["a.ts", "b.ts"]);
  });
});

describe("parseBlame", () => {
  it("pairs each content line with the preceding author-time", () => {
    const output = [
      "abc 1 1 2",
      "author-time 100",
      "filename a.ts",
      "\tconst a = 1;",
      "author-time 200",
      "\tconst b = 2;",
    ].join("\n");

    expect(parseBlame(output)).toEqual([100, 200]);
  });

  it("returns nothing for empty output", () => {
    expect(parseBlame("")).toEqual([]);
  });
});

describe("blameFile", () => {
  it("returns a timestamp per line for a tracked file", async () => {
    const times = await blameFile(process.cwd(), "package.json");

    expect(Array.isArray(times)).toBe(true);
    expect((times as number[]).length).toBeGreaterThan(0);
    expect(typeof (times as number[])[0]).toBe("number");
  });

  it("returns undefined when the file is not tracked", async () => {
    expect(await blameFile(process.cwd(), "definitely-not-here.txt")).toBeUndefined();
  });
});
