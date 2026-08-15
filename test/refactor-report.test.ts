import { describe, expect, it } from "vitest";
import type { RefactorCandidate, RefactorReport, Verdict } from "../src/core/analyzers/refactor.js";
import { renderRefactor } from "../src/report/format/refactor.js";

function candidate(
  path: string,
  verdict: Verdict,
  changes: number,
  tokens: number,
): RefactorCandidate {
  return {
    path,
    verdict,
    changes,
    tokens,
    complexity: 20,
    code: 100,
    density: 20,
    recurringTokens: tokens * changes,
    churn: changes * 10,
    churnRatio: changes * 10,
    momentum: changes,
    lastChange: 1_700_000_000,
  };
}

function report(candidates: RefactorCandidate[], inert = 0): RefactorReport {
  const verdicts: Record<Verdict, number> = {
    refactor: 0,
    split: 0,
    watch: 0,
    quiet: 0,
    inert: 0,
  };
  for (const file of candidates) {
    verdicts[file.verdict] += 1;
  }
  return {
    candidates,
    since: "2 years ago",
    commits: 1200,
    inert,
    measured: candidates.length + inert,
    limits: { busy: 3, dense: 12.5, costly: 2400 },
    verdicts,
  };
}

describe("renderRefactor", () => {
  it("says so when git history is missing", () => {
    expect(renderRefactor(undefined)).toContain("need git history");
  });

  it("says so when nothing was measured", () => {
    expect(renderRefactor(report([]))).toContain("No files found.");
  });

  it("says so when no file changed in the window", () => {
    const output = renderRefactor(report([candidate("cold.ts", "inert", 0, 500)]));

    expect(output).toContain("Nothing changed since 2 years ago.");
    expect(output).not.toContain("Ranked by");
  });

  it("shows the thresholds it judged against", () => {
    // the sentence is wrapped to the terminal, so compare it unwrapped
    const output = renderRefactor(report([candidate("a.ts", "refactor", 8, 3000)])).replace(
      /\s+/g,
      " ",
    );

    expect(output).toContain("changed often means a recency-weighted 3.0+ changes");
    expect(output).toContain("dense means 12.5 cx per 100 lines");
    expect(output).toContain("means 2,400 tokens");
  });

  it("counts every verdict present and leaves out the rest", () => {
    const output = renderRefactor(
      report([
        candidate("a.ts", "refactor", 8, 3000),
        candidate("b.ts", "refactor", 7, 2500),
        candidate("c.ts", "watch", 4, 100),
      ]),
    );

    expect(output).toContain("refactor       2 files   complex and changed often");
    expect(output).toContain("watch          1 files   changed often but cheap to read");
    expect(output).not.toContain("quiet");
  });

  it("ranks by recurring cost and scales the numbers", () => {
    const output = renderRefactor(
      report([
        candidate("huge.ts", "refactor", 200, 60000),
        candidate("mid.ts", "split", 10, 4000),
        candidate("tiny.ts", "watch", 3, 120),
      ]),
    );

    expect(output).toContain("Ranked by what re-reading them has cost, in tokens");
    expect(output).toContain("12.0M");
    expect(output).toContain("40k");
    expect(output).toContain("360");
  });

  it("prices the re-reads per million tokens when asked", () => {
    const priced = report([
      candidate("huge.ts", "refactor", 200, 60000),
      candidate("mid.ts", "split", 10, 4000),
    ]);

    expect(renderRefactor(priced)).not.toContain("$");
    const output = renderRefactor(priced, { price: 10 });

    expect(output).toContain("Cost");
    expect(output).toContain("$120");
    expect(output).toContain("$0.40");
  });

  it("truncates the list and reports what is left", () => {
    const output = renderRefactor(
      report([
        candidate("a.ts", "refactor", 8, 3000),
        candidate("b.ts", "refactor", 7, 2500),
        candidate("c.ts", "watch", 4, 100),
      ]),
      { top: 2 },
    );

    expect(output).toContain("b.ts");
    expect(output).not.toContain("c.ts");
    expect(output).toContain("… and 1 more files.");
  });

  it("ranks by lines changed when asked", () => {
    const rows = [candidate("cheap.ts", "watch", 20, 100), candidate("churny.ts", "watch", 2, 100)];
    rows[1]!.churn = 5000;

    const output = renderRefactor(report(rows), { sort: "churn" });

    expect(output).toContain("Ranked by how many lines have changed");
    expect(output.indexOf("churny.ts")).toBeLessThan(output.indexOf("cheap.ts"));
  });

  it("ranks by recency when asked", () => {
    const rows = [candidate("old.ts", "watch", 20, 100), candidate("new.ts", "watch", 2, 100)];
    rows[0]!.momentum = 0.1;
    rows[1]!.momentum = 9;

    const output = renderRefactor(report(rows), { sort: "recent" });

    expect(output).toContain("Ranked by how recently the changes arrived");
    expect(output.indexOf("new.ts")).toBeLessThan(output.indexOf("old.ts"));
  });

  it("breaks churn and recency ties on path", () => {
    const rows = [candidate("z.ts", "watch", 5, 100), candidate("a.ts", "watch", 5, 100)];

    for (const sort of ["churn", "recent"] as const) {
      const output = renderRefactor(report(rows), { sort });
      expect(output.indexOf("a.ts"), sort).toBeLessThan(output.indexOf("z.ts"));
    }
  });

  it("adds churn and recency columns under --explain", () => {
    const output = renderRefactor(report([candidate("a.ts", "refactor", 8, 3000)]), {
      explain: true,
    });

    expect(output).toContain("Churn");
    expect(output).toContain("Churn%");
    expect(output).toContain("Recent");
    // the churn share of a 100-line file with 80 lines changed
    expect(output).toContain("80%");
  });

  it("tells the reader to leave untouched files alone", () => {
    const output = renderRefactor(report([candidate("a.ts", "refactor", 8, 3000)], 250));

    expect(output).toContain("250 of 251 files did not change since 2 years ago");
    expect(output).toContain("they cost you nothing");
  });
});
