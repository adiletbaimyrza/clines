import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  run,
  runComments,
  runComplexity,
  runContext,
  runDup,
  runRefactor,
} from "../src/cli/run.js";
import { ClinesError } from "../src/util/errors.js";
import { changedFiles, repoState } from "../src/util/git.js";
import { fakeLog } from "./helpers/history.js";
import { captureIO, TempProject } from "./helpers/tmp.js";

let project: TempProject;

beforeEach(() => {
  project = new TempProject();
});
afterEach(() => {
  project.cleanup();
});

const CLONE = "const one = 1;\nconst two = 2;\nconst three = 3;\nconst four = 4;\n";

function changed(...files: string[]) {
  return { diff: "main", diffReader: async () => files };
}

describe("--diff", () => {
  it("counts only the files the diff touched", async () => {
    project.file("changed.ts", "const a = 1;\n");
    project.file("untouched.ts", "const b = 2;\nconst c = 3;\nconst d = 4;\n");
    const { io, out, err } = captureIO();

    await run({ dir: project.root, readme: false, json: true, ...changed("changed.ts") }, io);

    expect(JSON.parse(out.join("\n")).result).toMatchObject({ totalFiles: 1, totalCode: 1 });
    expect(err.join("\n")).toContain("Diff vs main: 1 changed file");
  });

  it("pluralises the scope line", async () => {
    project.file("a.ts", "const a = 1;\n");
    project.file("b.ts", "const b = 2;\n");
    const { io, err } = captureIO();

    await run({ dir: project.root, readme: false, ...changed("a.ts", "b.ts") }, io);

    expect(err.join("\n")).toContain("Diff vs main: 2 changed files");
  });

  it("scopes the role breakdown to the diff as well as the totals", async () => {
    project.file("changed.ts", "const a = 1;\n");
    project.file("untouched.ts", "const b = 2;\n");
    project.file("untouched.test.ts", "const c = 3;\n");
    project.file("notes.md", "# hello\n");
    const { io, out } = captureIO();

    await run({ dir: project.root, readme: false, json: true, ...changed("changed.ts") }, io);
    const result = JSON.parse(out.join("\n")).result as {
      totalFiles: number;
      roles: { role: string; files: number }[];
    };

    // the roles used to describe the whole tree while the totals described the diff
    expect(result.totalFiles).toBe(1);
    expect(result.roles).toEqual([{ role: "source", files: 1, code: 1 }]);
  });

  it("counts renamed clone groups in the same scope as the exact ones", async () => {
    const shape = (n: string) =>
      `const one${n} = 1;\nconst two${n} = 2;\nconst three${n} = 3;\nconst four${n} = 4;\n`;
    project.file("changed.ts", shape("A"));
    project.file("partner.ts", shape("B"));
    const { io, out } = captureIO();

    await runDup(
      {
        dir: project.root,
        top: 10,
        minLines: 3,
        minCopies: 2,
        open: false,
        renamed: true,
        json: true,
        ...changed("changed.ts"),
      },
      io,
    );
    const result = JSON.parse(out.join("\n")).result as {
      renamedGroups: number;
      clones: unknown[];
    };

    // identifiers differ, so these match only once renamed: one group, no exact clones
    expect(result.clones).toHaveLength(0);
    expect(result.renamedGroups).toBe(1);
  });

  it("reports no renamed groups when the diff touches none of them", async () => {
    const shape = (n: string) =>
      `const one${n} = 1;\nconst two${n} = 2;\nconst three${n} = 3;\nconst four${n} = 4;\n`;
    project.file("elsewhere-a.ts", shape("A"));
    project.file("elsewhere-b.ts", shape("B"));
    project.file("changed.ts", "const solo = 9;\n");
    const { io, out } = captureIO();

    await runDup(
      {
        dir: project.root,
        top: 10,
        minLines: 3,
        minCopies: 2,
        open: false,
        renamed: true,
        json: true,
        ...changed("changed.ts"),
      },
      io,
    );

    expect((JSON.parse(out.join("\n")).result as { renamedGroups: number }).renamedGroups).toBe(0);
  });

  it("ranks only changed files in cx and ctx", async () => {
    project.file("changed.ts", "if (a && b) { c(); }\n");
    project.file("untouched.ts", "if (d && e) { f(); }\n");

    const cx = captureIO();
    await runComplexity(
      {
        dir: project.root,
        sort: "raw",
        minLines: 1,
        top: 20,
        open: false,
        json: true,
        ...changed("changed.ts"),
      },
      cx.io,
      () => {},
    );

    const ctx = captureIO();
    await runContext(
      {
        dir: project.root,
        window: 200000,
        budget: 50000,
        top: 20,
        open: false,
        json: true,
        ...changed("changed.ts"),
      },
      ctx.io,
      () => {},
    );

    const paths = (result: string) =>
      (JSON.parse(result).result.files as { path: string }[]).map((file) => file.path);
    expect(paths(cx.out.join("\n"))).toEqual(["changed.ts"]);
    expect(paths(ctx.out.join("\n"))).toEqual(["changed.ts"]);
  });

  it("keeps detecting clones across the whole tree but reports only the ones a change touches", async () => {
    project.file("changed.ts", CLONE);
    project.file("partner.ts", CLONE);
    project.file("elsewhere-a.ts", "const x = 9;\nconst y = 8;\nconst z = 7;\nconst w = 6;\n");
    project.file("elsewhere-b.ts", "const x = 9;\nconst y = 8;\nconst z = 7;\nconst w = 6;\n");
    const { io, out } = captureIO();

    await runDup(
      {
        dir: project.root,
        top: 10,
        minLines: 3,
        minCopies: 2,
        open: false,
        json: true,
        ...changed("changed.ts"),
      },
      io,
    );
    const result = JSON.parse(out.join("\n")).result as {
      clones: { fragments: { path: string }[] }[];
      perFile: { path: string }[];
      percentage: number;
    };

    expect(result.clones).toHaveLength(1);
    // the other copy is still named, which is the point of reporting the group
    expect(result.clones[0]!.fragments.map((f) => f.path).sort()).toEqual([
      "changed.ts",
      "partner.ts",
    ]);
    expect(result.perFile.map((file) => file.path)).toEqual(["changed.ts"]);
    expect(result.percentage).toBe(100);
  });

  it("reports zero duplication when a changed file has none", async () => {
    project.file("changed.ts", "const solo = 1;\n");
    project.file("a.ts", CLONE);
    project.file("b.ts", CLONE);
    const { io, out } = captureIO();

    await runDup(
      {
        dir: project.root,
        top: 10,
        minLines: 3,
        minCopies: 2,
        open: false,
        json: true,
        ...changed("changed.ts"),
      },
      io,
    );
    const result = JSON.parse(out.join("\n")).result as { percentage: number; clones: unknown[] };

    expect(result.clones).toHaveLength(0);
    expect(result.percentage).toBe(0);
  });

  it("reports zero duplication when the diff is empty", async () => {
    project.file("a.ts", CLONE);
    project.file("b.ts", CLONE);
    const { io, out } = captureIO();

    await runDup(
      {
        dir: project.root,
        top: 10,
        minLines: 3,
        minCopies: 2,
        open: false,
        json: true,
        ...changed(),
      },
      io,
    );

    expect((JSON.parse(out.join("\n")).result as { percentage: number }).percentage).toBe(0);
  });

  it("refuses to write a diff-scoped count into the README", async () => {
    project.file("a.ts", "const a = 1;\n");
    project.file("README.md", "# Demo\n");
    const { io } = captureIO();

    await expect(run({ dir: project.root, readme: true, ...changed("a.ts") }, io)).rejects.toThrow(
      /cannot be combined with --diff/,
    );
    // and it fails before touching the file
    expect(readFileSync(project.path("README.md"), "utf8")).toBe("# Demo\n");
  });

  it("explains how to fix a diff git cannot resolve", async () => {
    project.file("a.ts", "const a = 1;\n");
    const { io } = captureIO();

    await expect(
      run(
        {
          dir: project.root,
          readme: false,
          diff: "origin/main",
          diffReader: async () => undefined,
        },
        io,
      ),
    ).rejects.toThrow(/fetch-depth: 0/);
  });

  it("throws a ClinesError so the CLI exits 1, not 2", async () => {
    project.file("a.ts", "const a = 1;\n");
    const { io } = captureIO();

    await expect(
      run(
        { dir: project.root, readme: false, diff: "nope", diffReader: async () => undefined },
        io,
      ),
    ).rejects.toBeInstanceOf(ClinesError);
  });
});

describe("shallow clones", () => {
  it("warns before reading history for refactor", async () => {
    project.file("a.ts", "if (a) { b(); }\n");
    const { io, err } = captureIO();

    await runRefactor(
      { dir: project.root, since: "2 years ago", top: 20, stateReader: async () => "shallow" },
      io,
      async () => fakeLog({ files: ["a.ts"] }),
    );

    expect(err.join("\n")).toContain("fetch-depth: 0");
  });

  it("warns before blaming for comments", async () => {
    project.file("a.ts", "// a comment\nconst a = 1;\n");
    const { io, err } = captureIO();

    await runComments(
      { dir: project.root, top: 20, scan: 10, years: 3, stateReader: async () => "shallow" },
      io,
      { blamer: async () => [1, 2] },
    );

    expect(err.join("\n")).toContain("fetch-depth: 0");
  });

  it("says nothing when the clone is complete", async () => {
    project.file("a.ts", "// a comment\nconst a = 1;\n");
    const { io, err } = captureIO();

    await runComments(
      { dir: project.root, top: 20, scan: 10, years: 3, stateReader: async () => "ok" },
      io,
      { blamer: async () => [1, 2] },
    );

    expect(err.join("\n")).not.toContain("fetch-depth: 0");
  });
});

describe("the real diff reader", () => {
  it("scopes a run to what git reports as changed", async () => {
    const { io, err } = captureIO();

    await run({ dir: process.cwd(), readme: false, json: true, diff: "HEAD~1" }, io);

    expect(err.join("\n")).toMatch(/Diff vs HEAD~1: \d+ changed files?/);
  });
});

describe("git helpers", () => {
  it("lists the files a ref changed", async () => {
    const files = await changedFiles(process.cwd(), "HEAD~1");

    expect(Array.isArray(files)).toBe(true);
    expect(files).not.toContain("");
  });

  it("returns undefined for a ref git cannot resolve", async () => {
    expect(await changedFiles(process.cwd(), "no-such-ref-anywhere")).toBeUndefined();
  });

  it("recognises a complete working tree", async () => {
    expect(await repoState(process.cwd())).toBe("ok");
  });

  it("recognises a directory that is not a repository", async () => {
    expect(await repoState(project.root)).toBe("none");
  });

  it("recognises a shallow clone", async () => {
    const clone = project.path("shallow");
    execFileSync("git", ["clone", "--depth", "1", "--no-local", process.cwd(), clone], {
      stdio: "ignore",
    });

    expect(await repoState(clone)).toBe("shallow");
  });
});
