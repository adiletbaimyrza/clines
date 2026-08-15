import { describe, expect, it } from "vitest";
import {
  commitsOf,
  fileChanges,
  halfLifeOf,
  isBot,
  parseHistory,
  renamePair,
} from "../src/core/history.js";
import { BASE_TIME, DAY, botLog, fakeLog } from "./helpers/history.js";

describe("isBot", () => {
  it("recognises the [bot] suffix on a name", () => {
    expect(isBot("dependabot[bot]", "anything@example.com")).toBe(true);
    expect(isBot("Renovate Bot[bot]", "x@y.z")).toBe(true);
  });

  it("recognises the known automation accounts by email", () => {
    expect(isBot("Renovate", "renovate[bot]@users.noreply.github.com")).toBe(true);
    expect(isBot("CI", "github-actions@github.com")).toBe(true);
    expect(isBot("Snyk", "snyk-bot@snyk.io")).toBe(true);
  });

  it("leaves humans alone, including ones with bot in their name", () => {
    expect(isBot("Abbot Robertson", "abbot@example.com")).toBe(false);
    expect(isBot("A Developer", "dev@example.com")).toBe(false);
  });
});

describe("renamePair", () => {
  it("passes an ordinary path straight through", () => {
    expect(renamePair("src/a.ts")).toEqual({ from: "src/a.ts", to: "src/a.ts" });
  });

  it("reads a plain rename", () => {
    expect(renamePair("a.ts => b.ts")).toEqual({ from: "a.ts", to: "b.ts" });
  });

  it("reads a rename inside a directory", () => {
    expect(renamePair("dir/{old.ts => new.ts}")).toEqual({
      from: "dir/old.ts",
      to: "dir/new.ts",
    });
  });

  it("reads a move between directories", () => {
    expect(renamePair("{dir => other}/f.ts")).toEqual({ from: "dir/f.ts", to: "other/f.ts" });
  });

  it("reads a move out of the root without leaving a stray slash", () => {
    expect(renamePair("{ => sub}/f.ts")).toEqual({ from: "f.ts", to: "sub/f.ts" });
  });

  it("falls back to the plain form when the braces are unbalanced", () => {
    expect(renamePair("a{.ts => b.ts")).toEqual({ from: "a{.ts", to: "b.ts" });
  });

  // a filename is whatever the repository we were pointed at contains
  it("does not blow up on a pathological filename", () => {
    const nasty = `{{${"{a".repeat(6000)} => ${"a}".repeat(6000)}`;
    const started = process.hrtime.bigint();

    renamePair(nasty);

    const ms = Number(process.hrtime.bigint() - started) / 1e6;
    expect(ms).toBeLessThan(200);
  });
});

describe("parseHistory", () => {
  it("reads hashes, times, authors and line counts", () => {
    const history = parseHistory(
      fakeLog({ files: [["a.ts", 10, 3]], time: 42, email: "dev@example.com", name: "Dev" }),
    );

    expect(history.commits).toHaveLength(1);
    expect(history.commits[0]).toMatchObject({
      time: 42,
      email: "dev@example.com",
      name: "Dev",
      bot: false,
      files: [{ path: "a.ts", added: 10, deleted: 3 }],
    });
  });

  it("counts binary files as zero rather than NaN", () => {
    const history = parseHistory(`\x1eabc\x1f1\x1fd@e.f\x1fD\n-\t-\timage.png\n`);

    expect(history.commits[0]!.files[0]).toEqual({ path: "image.png", added: 0, deleted: 0 });
  });

  it("ignores blank blocks and malformed rows", () => {
    const history = parseHistory(`\x1eabc\x1f1\x1fd@e.f\x1fD\nnot-a-numstat-row\n\n\x1e\n`);

    expect(history.commits).toHaveLength(1);
    expect(history.commits[0]!.files).toEqual([]);
  });

  it("returns nothing for empty output", () => {
    expect(parseHistory("")).toEqual({ commits: [] });
  });

  it("carries a renamed file's history under its current name", () => {
    // newest first, the way git log emits it
    const history = parseHistory(
      fakeLog(
        { files: ["src/new.ts"] },
        { files: ["src/{old.ts => new.ts}"] },
        { files: ["src/old.ts"] },
      ),
    );

    const paths = history.commits.flatMap((commit) => commit.files.map((file) => file.path));
    expect(paths).toEqual(["src/new.ts", "src/new.ts", "src/new.ts"]);
  });

  it("follows a file renamed twice", () => {
    const history = parseHistory(
      fakeLog(
        { files: ["c.ts"] },
        { files: ["b.ts => c.ts"] },
        { files: ["a.ts => b.ts"] },
        { files: ["a.ts"] },
      ),
    );

    const paths = history.commits.flatMap((commit) => commit.files.map((file) => file.path));
    expect(paths).toEqual(["c.ts", "c.ts", "c.ts", "c.ts"]);
  });

  it("does not loop when a file is renamed back and forth", () => {
    const history = parseHistory(
      fakeLog({ files: ["a.ts => b.ts"] }, { files: ["b.ts => a.ts"] }, { files: ["a.ts"] }),
    );

    expect(history.commits.flatMap((c) => c.files.map((f) => f.path))).toHaveLength(3);
  });
});

describe("commitsOf", () => {
  const mixed = `${fakeLog({ files: ["a.ts"] })}${botLog({ files: ["a.ts"] })}`;

  it("drops bot commits by default", () => {
    expect(commitsOf(parseHistory(mixed))).toHaveLength(1);
  });

  it("keeps them when asked", () => {
    expect(commitsOf(parseHistory(mixed), { includeBots: true })).toHaveLength(2);
  });
});

describe("halfLifeOf", () => {
  it("anchors on the newest commit, not the wall clock", () => {
    const commits = commitsOf(
      parseHistory(
        fakeLog({ files: ["a.ts"], time: BASE_TIME }, { files: ["a.ts"], time: BASE_TIME - 400 }),
      ),
    );

    expect(halfLifeOf(commits)).toEqual({ now: BASE_TIME, halfLife: 100 });
  });

  it("copes with a history that has no usable times", () => {
    expect(halfLifeOf([])).toEqual({ now: 0, halfLife: 0 });
  });
});

describe("fileChanges", () => {
  it("totals commits and churn per file", () => {
    const commits = commitsOf(
      parseHistory(
        fakeLog(
          { files: [["a.ts", 5, 2]] },
          {
            files: [
              ["a.ts", 1, 1],
              ["b.ts", 3, 0],
            ],
          },
        ),
      ),
    );
    const changes = fileChanges(commits);

    expect(changes.get("a.ts")).toMatchObject({ commits: 2, churn: 9 });
    expect(changes.get("b.ts")).toMatchObject({ commits: 1, churn: 3 });
  });

  it("weights a recent change above an old one", () => {
    const commits = commitsOf(
      parseHistory(
        fakeLog(
          { files: ["fresh.ts"], time: BASE_TIME },
          { files: ["stale.ts"], time: BASE_TIME - 400 * DAY },
        ),
      ),
    );
    const changes = fileChanges(commits);

    expect(changes.get("fresh.ts")!.momentum).toBe(1);
    expect(changes.get("stale.ts")!.momentum).toBeCloseTo(0.0625, 4);
  });

  it("weights everything equally when the whole history is one moment", () => {
    const commits = commitsOf(parseHistory(fakeLog({ files: ["a.ts"], time: BASE_TIME })));

    expect(fileChanges(commits).get("a.ts")!.momentum).toBe(1);
  });

  it("records when a file was last touched", () => {
    const commits = commitsOf(
      parseHistory(
        fakeLog({ files: ["a.ts"], time: BASE_TIME }, { files: ["a.ts"], time: BASE_TIME - 900 }),
      ),
    );

    expect(fileChanges(commits).get("a.ts")!.lastChange).toBe(BASE_TIME);
  });
});
