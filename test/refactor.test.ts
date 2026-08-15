import { describe, expect, it } from "vitest";
import { judge, type RefactorInput } from "../src/core/analyzers/refactor.js";
import { changeLog } from "../src/util/git.js";
import { TempProject } from "./helpers/tmp.js";

function file(path: string, over: Partial<RefactorInput> = {}): RefactorInput {
  const changes = over.changes ?? 1;
  return {
    path,
    complexity: 10,
    code: 100,
    density: 10,
    tokens: 1000,
    changes,
    churn: changes * 10,
    // Undecayed by default, so these fixtures read as "all of it just happened".
    momentum: changes,
    lastChange: 1_700_000_000,
    ...over,
  };
}

function verdicts(files: RefactorInput[]): Record<string, string> {
  const report = judge(files, "2 years ago", 10);
  return Object.fromEntries(report.candidates.map((c) => [c.path, c.verdict]));
}

describe("judge", () => {
  it("ignores files with no decision points", () => {
    const report = judge([file("data.json", { complexity: 0, density: 0 })], "2 years ago", 3);

    expect(report.measured).toBe(0);
    expect(report.candidates).toEqual([]);
    expect(report.limits).toEqual({ busy: 0, dense: 0, costly: 0 });
  });

  it("prices each file by tokens times changes and ranks by it", () => {
    const report = judge(
      [
        file("small.ts", { tokens: 100, changes: 50 }),
        file("big.ts", { tokens: 5000, changes: 20 }),
      ],
      "6 months ago",
      42,
    );

    expect(report.since).toBe("6 months ago");
    expect(report.commits).toBe(42);
    expect(report.candidates.map((c) => c.path)).toEqual(["big.ts", "small.ts"]);
    expect(report.candidates.map((c) => c.recurringTokens)).toEqual([100000, 5000]);
  });

  it("breaks cost ties on path", () => {
    const report = judge([file("b.ts"), file("a.ts")], "2 years ago", 1);

    expect(report.candidates.map((c) => c.path)).toEqual(["a.ts", "b.ts"]);
  });

  it("names an untouched file inert and counts it", () => {
    const report = judge(
      [file("cold.ts", { changes: 0 }), file("warm.ts", { changes: 4 })],
      "2 years ago",
      5,
    );

    expect(report.inert).toBe(1);
    expect(report.measured).toBe(2);
    expect(verdicts([file("cold.ts", { changes: 0 })])["cold.ts"]).toBe("inert");
  });

  it("separates the verdicts by density, cost and change rate", () => {
    const rows = [
      file("hot-dense.ts", { changes: 9, density: 40, tokens: 9000 }),
      file("hot-big.ts", { changes: 9, density: 1, tokens: 9000 }),
      file("hot-small.ts", { changes: 9, density: 1, tokens: 10 }),
      file("cool.ts", { changes: 1, density: 40, tokens: 9000 }),
      file("cold.ts", { changes: 0, density: 40, tokens: 9000 }),
    ];

    expect(verdicts(rows)).toEqual({
      "hot-dense.ts": "refactor",
      "hot-big.ts": "split",
      "hot-small.ts": "watch",
      "cool.ts": "quiet",
      "cold.ts": "inert",
    });
  });

  it("never calls a file busy below two changes, however quiet the repo", () => {
    const report = judge([file("a.ts", { changes: 1 }), file("b.ts", { changes: 1 })], "1 day", 2);

    // every file clears the median, so only the two-change floor keeps them quiet
    expect(report.limits.busy).toBe(1);
    expect(report.candidates.every((c) => c.verdict === "quiet")).toBe(true);
  });

  it("cools off a file whose changes have all stopped", () => {
    const rows = [
      file("stale.ts", { changes: 9, density: 40, momentum: 0.2 }),
      file("live.ts", { changes: 9, density: 40, momentum: 9 }),
    ];

    expect(verdicts(rows)).toEqual({ "stale.ts": "quiet", "live.ts": "refactor" });
  });

  it("reports no churn share for an empty file", () => {
    const report = judge([file("a.ts", { code: 0, churn: 50, complexity: 3 })], "2 years ago", 1);

    expect(report.candidates[0]!.churnRatio).toBe(0);
  });

  it("reports churn as a share of the file", () => {
    const report = judge([file("a.ts", { code: 200, churn: 50 })], "2 years ago", 1);

    expect(report.candidates[0]!.churnRatio).toBe(25);
  });
});

describe("changeLog", () => {
  it("reads history from a git repository", async () => {
    const output = await changeLog(process.cwd(), "10 years ago");

    expect(output).toContain("package.json");
  });

  it("returns undefined outside a git repository", async () => {
    const project = new TempProject();
    try {
      expect(await changeLog(project.path("nope"), "1 year ago")).toBeUndefined();
    } finally {
      project.cleanup();
    }
  });
});
