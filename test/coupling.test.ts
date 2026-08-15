import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runCoupling } from "../src/cli/run.js";
import { analyzeCoupling, DEFAULT_LIMITS } from "../src/core/analyzers/coupling.js";
import { commitsOf, parseHistory } from "../src/core/history.js";
import { fakeLog, type FakeCommit } from "./helpers/history.js";
import { captureIO, TempProject } from "./helpers/tmp.js";

let project: TempProject;

beforeEach(() => {
  project = new TempProject();
});
afterEach(() => {
  project.cleanup();
});

function commits(...entries: FakeCommit[]) {
  return commitsOf(parseHistory(fakeLog(...entries)));
}

function times(count: number, files: string[]): FakeCommit[] {
  return Array.from({ length: count }, () => ({ files }));
}

const LOOSE = { minRevisions: 2, minShared: 2, minStrength: 50 };

describe("analyzeCoupling", () => {
  it("pairs files that keep changing together", () => {
    const result = analyzeCoupling(commits(...times(4, ["a.ts", "b.ts"])), LOOSE);

    expect(result.pairs).toHaveLength(1);
    expect(result.pairs[0]).toMatchObject({ a: "a.ts", b: "b.ts", shared: 4, strength: 100 });
  });

  it("measures strength against the average revision count", () => {
    // a.ts changes six times, b.ts three, three of them together
    const result = analyzeCoupling(
      commits(...times(3, ["a.ts", "b.ts"]), ...times(3, ["a.ts"])),
      LOOSE,
    );

    // 3 shared / ((6 + 3) / 2) = 66.7%
    expect(result.pairs[0]!.strength).toBeCloseTo(66.67, 1);
    expect(result.pairs[0]).toMatchObject({ revisionsA: 6, revisionsB: 3 });
  });

  it("never reports a strength above 100%", () => {
    const result = analyzeCoupling(commits(...times(5, ["a.ts", "b.ts"])), LOOSE);

    expect(result.pairs.every((pair) => pair.strength <= 100)).toBe(true);
  });

  it("drops pairs below the shared-commit threshold", () => {
    const result = analyzeCoupling(commits(...times(3, ["a.ts", "b.ts"])), {
      ...LOOSE,
      minShared: 10,
    });

    expect(result.pairs).toEqual([]);
  });

  it("drops files that have barely changed", () => {
    const result = analyzeCoupling(commits(...times(3, ["a.ts", "b.ts"])), {
      ...LOOSE,
      minRevisions: 10,
    });

    expect(result.pairs).toEqual([]);
  });

  it("drops weak couples", () => {
    const result = analyzeCoupling(
      commits(...times(2, ["a.ts", "b.ts"]), ...times(20, ["a.ts"])),
      LOOSE,
    );

    expect(result.pairs).toEqual([]);
  });

  it("skips sweeps that would couple everything to everything", () => {
    const sweep = Array.from({ length: 40 }, (_, i) => `f${i}.ts`);
    const result = analyzeCoupling(commits(...times(4, sweep)), LOOSE);

    expect(result.pairs).toEqual([]);
    expect(result.skipped).toBe(4);
    expect(result.commits).toBe(0);
  });

  it("raising the sweep limit lets those commits back in", () => {
    const sweep = Array.from({ length: 40 }, (_, i) => `f${i}.ts`);
    const result = analyzeCoupling(commits(...times(4, sweep)), {
      ...LOOSE,
      maxCommitSize: 100,
    });

    expect(result.skipped).toBe(0);
    expect(result.pairs.length).toBeGreaterThan(0);
  });

  it("counts a file listed twice in one commit only once", () => {
    const result = analyzeCoupling(commits(...times(3, ["a.ts", "a.ts", "b.ts"])), LOOSE);

    expect(result.pairs[0]).toMatchObject({ shared: 3, revisionsA: 3 });
  });

  it("ignores empty commits", () => {
    const result = analyzeCoupling(commits({ files: [] }, ...times(2, ["a.ts", "b.ts"])), LOOSE);

    expect(result.commits).toBe(2);
  });

  it("ranks files by how many partners they drag along", () => {
    const result = analyzeCoupling(
      commits(...times(3, ["hub.ts", "a.ts"]), ...times(3, ["hub.ts", "b.ts"])),
      { minRevisions: 2, minShared: 2, minStrength: 40 },
    );

    expect(result.files[0]).toMatchObject({ path: "hub.ts", partners: 2, sumOfCoupling: 6 });
  });

  it("uses the documented defaults when none are given", () => {
    expect(analyzeCoupling([]).limits).toEqual(DEFAULT_LIMITS);
  });

  it("sorts by strength, then shared count, then path", () => {
    const result = analyzeCoupling(
      commits(...times(4, ["a.ts", "b.ts"]), ...times(2, ["c.ts", "d.ts"]), ...times(2, ["c.ts"])),
      LOOSE,
    );

    expect(result.pairs.map((pair) => pair.a)).toEqual(["a.ts", "c.ts"]);
  });
});

describe("runCoupling", () => {
  it("prints the pairs and where to start", async () => {
    const { io, out } = captureIO();

    const code = await runCoupling(
      {
        dir: project.root,
        since: "2 years ago",
        top: 20,
        minRevisions: 2,
        minShared: 2,
        minStrength: 50,
        maxCommitSize: 30,
      },
      io,
      async () => fakeLog(...times(4, ["a.ts", "b.ts"])),
    );

    expect(code).toBe(0);
    expect(out.join("\n")).toContain("Files that keep changing together");
    expect(out.join("\n")).toContain("Where to start");
  });

  it("names the flags to lower when nothing meets the thresholds", async () => {
    const { io, out } = captureIO();

    await runCoupling(
      {
        dir: project.root,
        since: "2 years ago",
        top: 20,
        ...DEFAULT_LIMITS,
      },
      io,
      async () => fakeLog(...times(3, ["a.ts", "b.ts"])),
    );

    expect(out.join("\n")).toContain("--min-revisions 3 --min-shared 3");
  });

  it("reports the sweeps it skipped", async () => {
    const sweep = Array.from({ length: 40 }, (_, i) => `f${i}.ts`);
    const { io, out } = captureIO();

    await runCoupling(
      {
        dir: project.root,
        since: "2 years ago",
        top: 20,
        minRevisions: 2,
        minShared: 2,
        minStrength: 50,
        maxCommitSize: 30,
      },
      io,
      async () => fakeLog(...times(2, sweep)),
    );

    expect(out.join("\n")).toContain("Skipped 2 commits");
  });

  it("truncates the pair list and says how much is left", async () => {
    const { io, out } = captureIO();
    const pairs = [
      ...times(4, ["a.ts", "b.ts"]),
      ...times(4, ["c.ts", "d.ts"]),
      ...times(4, ["e.ts", "f.ts"]),
    ];

    await runCoupling(
      {
        dir: project.root,
        since: "2 years ago",
        top: 1,
        minRevisions: 2,
        minShared: 2,
        minStrength: 50,
        maxCommitSize: 30,
      },
      io,
      async () => fakeLog(...pairs),
    );

    expect(out.join("\n")).toMatch(/… and \d+ more pairs\./);
  });

  it("reads git itself when no reader is injected", async () => {
    const { io, out } = captureIO();

    const code = await runCoupling(
      {
        dir: process.cwd(),
        since: "2 years ago",
        top: 5,
        ...DEFAULT_LIMITS,
      },
      io,
    );

    expect(code).toBe(0);
    expect(out.join("\n")).toContain("Change coupling:");
  });

  it("says so without git", async () => {
    const { io, out } = captureIO();

    await runCoupling(
      {
        dir: project.root,
        since: "2 years ago",
        top: 20,
        ...DEFAULT_LIMITS,
      },
      io,
      async () => undefined,
    );

    expect(out.join("\n")).toContain("needs git history");
  });

  it("emits JSON, and null when git is missing", async () => {
    const ok = captureIO();
    await runCoupling(
      { dir: project.root, since: "2y", top: 20, ...DEFAULT_LIMITS, json: true },
      ok.io,
      async () => fakeLog(...times(12, ["a.ts", "b.ts"])),
    );

    const missing = captureIO();
    await runCoupling(
      { dir: project.root, since: "2y", top: 20, ...DEFAULT_LIMITS, json: true },
      missing.io,
      async () => undefined,
    );

    expect(JSON.parse(ok.out.join("\n")).result.pairs).toHaveLength(1);
    expect(JSON.parse(missing.out.join("\n"))).toMatchObject({
      result: null,
      unavailable: "no-git",
    });
  });

  it("counts bot commits only when asked", async () => {
    const log = `${fakeLog(...times(6, ["a.ts", "b.ts"]))}${fakeLog(
      ...times(6, ["a.ts", "b.ts"]).map((commit) => ({
        ...commit,
        name: "dependabot[bot]",
        email: "dependabot[bot]@users.noreply.github.com",
      })),
    )}`;
    const limits = {
      dir: project.root,
      since: "2y",
      top: 20,
      minRevisions: 2,
      minShared: 2,
      minStrength: 50,
      json: true,
      maxCommitSize: 30,
    };

    const humans = captureIO();
    await runCoupling(limits, humans.io, async () => log);
    const all = captureIO();
    await runCoupling({ ...limits, includeBots: true }, all.io, async () => log);

    expect(JSON.parse(humans.out.join("\n")).result.pairs[0].shared).toBe(6);
    expect(JSON.parse(all.out.join("\n")).result.pairs[0].shared).toBe(12);
  });
});
